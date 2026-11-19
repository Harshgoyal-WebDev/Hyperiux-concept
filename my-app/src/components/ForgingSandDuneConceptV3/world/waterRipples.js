import * as THREE from "three";

// The oasis water's ripples: a wave simulation on a grid over a square of
// the water (world x → u, world z → v), as the garden's pond has it, but
// stepped at a fixed rate of time — not once per ring dropped — and with
// every ring of a frame dropped in the same step. (Stepping once per drop
// made a fast stroke fast-forward the whole surface: every ring already
// spreading jumped on by as many steps as the stroke dropped rings, so the
// water seemed to forget what it was doing.) Rings that are dropped far
// apart in one frame (a quick flick across the lake) all land.
//
// r: height, g: velocity.

const MAX_DROPS = 24;
const STEP_HZ = 60;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uPrev;
  uniform vec2 uTexel;
  uniform vec4 uDrops[${MAX_DROPS}]; // uv x, y, strength, radius (uv)
  uniform int uCount;
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
    for (int i = 0; i < ${MAX_DROPS}; i++) {
      if (i >= uCount) break;
      vec4 d = uDrops[i];
      float k = length(vUv - d.xy) / d.w;
      h += d.z * exp(-k * k * 3.0);
    }
    // fade out at the grid's edge
    vec2 e = min(vUv, 1.0 - vUv);
    h *= smoothstep(0.0, 0.03, min(e.x, e.y));
    gl_FragColor = vec4(h, v, 0.0, 1.0);
  }
`;

// rect: (minX, minZ, sizeX, sizeZ) in world metres (may be moved: see recentre)
export function createWaterRipples(rect, size = 768) {
  const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  const targets = [new THREE.WebGLRenderTarget(size, size, opts), new THREE.WebGLRenderTarget(size, size, opts)];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPrev: { value: null },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDrops: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4()) },
      uCount: { value: 0 },
      uDamping: { value: 0.985 },
      uSpeed: { value: 0.55 },
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
  let debt = 0; // time owed to the simulation (s)

  const clear = (gl) => {
    const c = gl.getClearColor(new THREE.Color());
    const a = gl.getClearAlpha();
    gl.setClearColor(0x000000, 0);
    for (const t of targets) {
      gl.setRenderTarget(t);
      gl.clear(true, false, false);
    }
    gl.setClearColor(c, a);
  };

  return {
    rect,
    size,
    texture: targets[0].texture,
    uv(x, z) {
      return [(x - rect.x) / rect.z, (z - rect.y) / rect.w];
    },
    // idle: no ring dropped for a while (everything has died away)
    idle() {
      return performance.now() - lastDrop > 7000;
    },
    // move the square (only when idle: the rings would jump with it), and
    // size it (m: the same grid over more water when the camera is far off)
    recentre(x, z, size = rect.z) {
      rect.z = rect.w = size;
      rect.x = x - rect.z / 2;
      rect.y = z - rect.w / 2;
      cleared = false;
    },
    // drops: [[u, v, strength, radius m], ...] this frame; dt: seconds
    step(gl, drops, dt, { damping = 0.985, speed = 0.55 } = {}) {
      const now = performance.now();
      if (drops.length) lastDrop = now;
      if (cleared && now - lastDrop > 7000) {
        debt = 0;
        return this.texture;
      }
      u.uDamping.value = damping;
      u.uSpeed.value = speed;
      const prev = gl.getRenderTarget();
      if (!cleared) {
        clear(gl);
        cleared = true;
      }
      // a fixed rate: the waves spread at the same pace however the frames come
      debt = Math.min(debt + dt, 4 / STEP_HZ);
      let steps = Math.floor(debt * STEP_HZ);
      // (rings dropped this frame always land, in the first step)
      if (drops.length && steps === 0) steps = 1;
      debt -= steps / STEP_HZ;
      for (let k = 0; k < steps; k++) {
        const n = k === 0 ? Math.min(drops.length, MAX_DROPS) : 0;
        for (let i = 0; i < n; i++) {
          const d = drops[i];
          u.uDrops.value[i].set(d[0], d[1], d[2], d[3] / rect.z);
        }
        u.uCount.value = n;
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
