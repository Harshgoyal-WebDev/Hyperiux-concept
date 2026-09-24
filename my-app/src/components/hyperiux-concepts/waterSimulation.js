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
  uniform float uRippleTime;
  uniform float uRippleStrength;
  uniform float uRippleFrequency;
  uniform float uRippleSpeed;
  uniform float uRippleDecay;
  uniform vec2 uRippleOrigin;

  void main() {
    vec2 cellSize = 1.0 / resolution.xy;
    vec2 uv = gl_FragCoord.xy * cellSize;

    vec4 heightmapValue = texture2D(heightmap, uv);

    vec4 north = texture2D(heightmap, uv + vec2(0.0, cellSize.y));
    vec4 south = texture2D(heightmap, uv + vec2(0.0, -cellSize.y));
    vec4 east = texture2D(heightmap, uv + vec2(cellSize.x, 0.0));
    vec4 west = texture2D(heightmap, uv + vec2(-cellSize.x, 0.0));

    float newHeight = ((north.x + south.x + east.x + west.x) * 0.5 - heightmapValue.y) * uViscosity;

    // A continuous train of concentric ripples expanding outward from a
    // single fixed point — like a spring or a slow drip constantly
    // feeding the surface, rather than one-off stamped ripples. Distance
    // from the origin sets the ring phase (uRippleFrequency = how tightly
    // packed the rings are, i.e. 1/wavelength), and subtracting time*speed
    // from that phase is what makes the whole ring pattern visibly travel
    // outward frame to frame. uRippleDecay exponentially fades each ring's
    // amplitude the farther it's traveled from the source, so what reaches
    // the far shore is a faint trace rather than the same strength ring
    // that started at the center — matching how real ripples weaken as
    // they spread.
    float rippleDist = length(uv - uRippleOrigin);
    float ripplePhase = rippleDist * uRippleFrequency - uRippleTime * uRippleSpeed;
    float rippleDecay = exp(-rippleDist * uRippleDecay);
    newHeight += cos(ripplePhase) * rippleDecay * uRippleStrength;

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
    uRippleTime: { value: 0 },
    uRippleStrength: { value: 0.12 },
    uRippleFrequency: { value: 60 },
    uRippleSpeed: { value: 4 },
    uRippleDecay: { value: 2.2 },
    uRippleOrigin: { value: new THREE.Vector2(0.5, 0.5) },
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
      rippleStrength,
      rippleFrequency,
      rippleSpeed,
      rippleDecay,
      rippleOriginX,
      rippleOriginY,
    }) {
      const uniforms = heightmapVariable.material.uniforms;
      if (mouseSize !== undefined) uniforms.uMouseSize.value = mouseSize;
      if (mouseIntensity !== undefined) uniforms.uMouseIntensity.value = mouseIntensity;
      if (viscosity !== undefined) uniforms.uViscosity.value = viscosity;
      if (rippleStrength !== undefined) uniforms.uRippleStrength.value = rippleStrength;
      if (rippleFrequency !== undefined) uniforms.uRippleFrequency.value = rippleFrequency;
      if (rippleSpeed !== undefined) uniforms.uRippleSpeed.value = rippleSpeed;
      if (rippleDecay !== undefined) uniforms.uRippleDecay.value = rippleDecay;
      if (rippleOriginX !== undefined) uniforms.uRippleOrigin.value.x = rippleOriginX;
      if (rippleOriginY !== undefined) uniforms.uRippleOrigin.value.y = rippleOriginY;
    },
    setTime(t) {
      heightmapVariable.material.uniforms.uRippleTime.value = t;
    },
  };
}
