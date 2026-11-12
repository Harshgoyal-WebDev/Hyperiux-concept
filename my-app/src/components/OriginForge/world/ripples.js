import * as THREE from "three";

// The water's ripples, as the garden's pond has them (ForgingConcept
// GardenPond): a wave simulation on a fine grid over the plaza (world x →
// u, world z → v), slow enough for the rings to be seen spreading. The
// pointer drops rings into it all along its path over the water, stronger
// the faster it moves; they spread, cross and die away. One simulation step
// is taken for each drop (at least one a frame), and once the last ring has
// died away (a few seconds after the last drop) it does no work at all.
//
// r: height, g: velocity.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uPrev;
  uniform vec2 uTexel;
  uniform vec3 uDrop; // uv x, y, strength
  uniform float uDropRadius; // in uv
  uniform float uDamping;
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uPrev, vUv);
    float avg = (
      texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r + texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r +
      texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r + texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r
    ) * 0.25;
    float v = (c.g + (avg - c.r) * uSpeed) * uDamping;
    float h = c.r + v;
    float d = length(vUv - uDrop.xy) / uDropRadius;
    h += uDrop.z * exp(-d * d * 3.0);
    // fade out at the grid's edge
    vec2 e = min(vUv, 1.0 - vUv);
    h *= smoothstep(0.0, 0.03, min(e.x, e.y));
    gl_FragColor = vec4(h, v, 0.0, 1.0);
  }
`;

// rect: (minX, minZ, sizeX, sizeZ) in world metres
export function createRipples(rect, size = 512) {
  const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  const targets = [new THREE.WebGLRenderTarget(size, size, opts), new THREE.WebGLRenderTarget(size, size, opts)];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPrev: { value: null },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDrop: { value: new THREE.Vector3() },
      uDropRadius: { value: 0.02 },
      uDamping: { value: 0.98 },
      uSpeed: { value: 0.6 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geo, material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const u = material.uniforms;
  let read = 0;
  let cleared = false;
  let lastDrop = -1e9;

  return {
    rect,
    size,
    texel: rect.z / size, // metres per grid cell
    texture: targets[0].texture,
    // world (x, z) → the grid's uv
    uv(x, z) {
      return [(x - rect.x) / rect.z, (z - rect.y) / rect.w];
    },
    // drops: [[u, v, strength], ...] this frame
    step(gl, drops, { radius, damping, speed }) {
      const now = performance.now();
      if (drops.length) lastDrop = now;
      if (cleared && now - lastDrop > 6000) return this.texture;
      u.uDamping.value = damping;
      u.uSpeed.value = speed;
      u.uDropRadius.value = radius / rect.z;
      const prev = gl.getRenderTarget();
      if (!cleared) {
        const c = gl.getClearColor(new THREE.Color());
        const a = gl.getClearAlpha();
        gl.setClearColor(0x000000, 0);
        for (const t of targets) {
          gl.setRenderTarget(t);
          gl.clear(true, false, false);
        }
        gl.setClearColor(c, a);
        cleared = true;
      }
      const steps = Math.max(drops.length, 1);
      for (let k = 0; k < steps; k++) {
        const d = drops[k];
        if (d) u.uDrop.value.set(d[0], d[1], d[2]);
        else u.uDrop.value.z = 0;
        u.uPrev.value = targets[read].texture;
        gl.setRenderTarget(targets[1 - read]);
        gl.render(scene, camera);
        read = 1 - read;
      }
      gl.setRenderTarget(prev);
      this.texture = targets[read].texture;
      return this.texture;
    },
    dispose() {
      targets.forEach((t) => t.dispose());
      material.dispose();
      geo.dispose();
    },
  };
}
