import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";

// Wave-equation heightmap sim, same technique as
// three/examples/webgl_gpgpu_water.html: each texel averages its four
// neighbors against its own previous value, damped by viscosity, with an
// extra cosine bump stamped in wherever the pointer is held down.
const heightmapFragmentShader = /* glsl */ `
  #include <common>

  uniform vec2 uPointerUV;
  uniform float uPointerActive;
  uniform float uMouseSize;
  uniform float uMouseIntensity;
  uniform float uViscosity;
  uniform float uCurrentTime;
  uniform float uCurrentStrength;
  uniform float uCurrentFrequency;
  uniform float uCurrentStretch;
  uniform float uCurrentSpeed;
  uniform vec2 uCurrentDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 cellSize = 1.0 / resolution.xy;
    vec2 uv = gl_FragCoord.xy * cellSize;

    vec4 heightmapValue = texture2D(heightmap, uv);

    vec4 north = texture2D(heightmap, uv + vec2(0.0, cellSize.y));
    vec4 south = texture2D(heightmap, uv + vec2(0.0, -cellSize.y));
    vec4 east = texture2D(heightmap, uv + vec2(cellSize.x, 0.0));
    vec4 west = texture2D(heightmap, uv + vec2(-cellSize.x, 0.0));

    float newHeight = ((north.x + south.x + east.x + west.x) * 0.5 - heightmapValue.y) * uViscosity;

    // Constantly-moving surface current — dense, fine ripple streaks all
    // elongated and drifting in one direction, like real open water under
    // a steady breeze (as opposed to the earlier wind+wave attempt, which
    // read as undirected fuzz plus a few sparse wave crests). The trick is
    // sampling noise in a basis rotated to the current direction: high
    // frequency across the current packs many parallel ripple lines
    // together, while a much lower frequency along the current stretches
    // each one into a streak instead of a round blob; scrolling that same
    // coordinate over time is what keeps the whole field visibly flowing
    // rather than just shimmering in place.
    float alongCurrent = dot(uv, uCurrentDir) - uCurrentTime * uCurrentSpeed;
    float acrossCurrent = dot(uv, vec2(-uCurrentDir.y, uCurrentDir.x));
    vec2 currentUv = vec2(alongCurrent * uCurrentStretch, acrossCurrent * uCurrentFrequency);
    float current = valueNoise(currentUv) * 0.6 + valueNoise(currentUv * 2.3 + vec2(4.0, 9.0)) * 0.4 - 0.5;
    newHeight += current * uCurrentStrength;

    // Push the surface DOWN at the touch point (like a finger pressing in),
    // not up — the depression then rebounds outward into a ripple, same as
    // the reference demo.
    float dist = length(uv - uPointerUV);
    float mousePhase = clamp(dist * PI / uMouseSize, 0.0, PI);
    newHeight -= (cos(mousePhase) + 1.0) * uPointerActive * uMouseIntensity;

    // Hard safety net: this forcing term re-applies every frame the pointer
    // is held, with no self-decay, so it can accumulate without bound at a
    // stationary click. Clamping keeps the sim from numerically exploding
    // regardless of how uMouseIntensity is tuned or how long it's held.
    newHeight = clamp(newHeight, -3.0, 3.0);

    heightmapValue.y = heightmapValue.x;
    heightmapValue.x = newHeight;

    gl_FragColor = heightmapValue;
  }
`;

export function createWaterSimulation({ renderer, resolution = 128 }) {
  const gpuCompute = new GPUComputationRenderer(resolution, resolution, renderer);

  const heightmap0 = gpuCompute.createTexture();
  const heightmapVariable = gpuCompute.addVariable("heightmap", heightmapFragmentShader, heightmap0);
  gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

  Object.assign(heightmapVariable.material.uniforms, {
    uPointerUV: { value: new THREE.Vector2(-10, -10) },
    uPointerActive: { value: 0 },
    uMouseSize: { value: 0.05 },
    uMouseIntensity: { value: 0.4 },
    uViscosity: { value: 0.985 },
    uCurrentTime: { value: 0 },
    uCurrentStrength: { value: 0.05 },
    uCurrentFrequency: { value: 22 },
    uCurrentStretch: { value: 3 },
    uCurrentSpeed: { value: 0.12 },
    uCurrentDir: { value: new THREE.Vector2(1, 0.35).normalize() },
  });

  const error = gpuCompute.init();
  if (error !== null) {
    console.error(error);
  }

  return {
    resolution,
    compute() {
      gpuCompute.compute();
    },
    getTexture() {
      return gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
    },
    setPointer(uv, active) {
      const uniforms = heightmapVariable.material.uniforms;
      if (uv) uniforms.uPointerUV.value.copy(uv);
      uniforms.uPointerActive.value = active ? 1 : 0;
    },
    setParams({
      mouseSize,
      mouseIntensity,
      viscosity,
      currentStrength,
      currentFrequency,
      currentStretch,
      currentSpeed,
      currentAngleDeg,
    }) {
      const uniforms = heightmapVariable.material.uniforms;
      if (mouseSize !== undefined) uniforms.uMouseSize.value = mouseSize;
      if (mouseIntensity !== undefined) uniforms.uMouseIntensity.value = mouseIntensity;
      if (viscosity !== undefined) uniforms.uViscosity.value = viscosity;
      if (currentStrength !== undefined) uniforms.uCurrentStrength.value = currentStrength;
      if (currentFrequency !== undefined) uniforms.uCurrentFrequency.value = currentFrequency;
      if (currentStretch !== undefined) uniforms.uCurrentStretch.value = currentStretch;
      if (currentSpeed !== undefined) uniforms.uCurrentSpeed.value = currentSpeed;
      if (currentAngleDeg !== undefined) {
        const rad = THREE.MathUtils.degToRad(currentAngleDeg);
        uniforms.uCurrentDir.value.set(Math.cos(rad), Math.sin(rad));
      }
    },
    setTime(t) {
      heightmapVariable.material.uniforms.uCurrentTime.value = t;
    },
  };
}
