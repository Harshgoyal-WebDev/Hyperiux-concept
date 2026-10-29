import * as THREE from "three";

// The pointer's wind over the garden, as a field: a small float texture
// laid over the meadow (world x → u, world z → v) that every frame
//   relaxes  – the wind dies away (over the hover linger) and spreads a
//              little to its neighbours, so a stroke leaves a soft wake;
//   is brushed – along the pointer's path over the ground since the last
//              frame (a capsule, not a dot, so a quick stroke is unbroken):
//              the plants there are pushed along its motion and parted
//              out from its line, harder the faster it goes.
// r, g: the push at a plant's tip (metres, world x / z); b: how lit the
// plants are by the pointer's passing (only while it moves — it fades as
// soon as it stops). Every swaying material samples it once per vertex
// (gardenAsset.js POINTER_WIND_GLSL), however many strokes there are.

const SIZE = 256;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAGMENT = /* glsl */ `
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uA; // the pointer's path this frame, from (field uv)...
uniform vec2 uB; // ...to
uniform vec2 uVel; // its speed over the ground (m/s, world x / z)
uniform float uPush; // how far it pushes the plants (m)
uniform float uRadius; // its reach (field uv)
uniform float uGlowRadius;
uniform float uGlow; // how lit its path is (0 when it isn't moving)
uniform float uRelax; // share of the wind left after this frame
uniform float uFade; // ...and of the glow
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uPrev, vUv);
  vec4 n = (texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)) + texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)) +
            texture2D(uPrev, vUv + vec2(0.0, uTexel.y)) + texture2D(uPrev, vUv - vec2(0.0, uTexel.y))) * 0.25;
  c = mix(c, n, 0.3);
  c.rg *= uRelax;
  c.b *= uFade;
  // the brush: the distance to the pointer's path this frame
  vec2 pa = vUv - uA;
  vec2 ba = uB - uA;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
  vec2 off = pa - ba * h;
  float d = length(off);
  float w = exp(-pow(d / uRadius, 2.0) * 2.2);
  float speed = length(uVel);
  if (speed > 1e-3 && w > 1e-3) {
    // along its motion, and parted out from its line
    vec2 along = uVel / speed;
    vec2 away = d > 1e-6 ? off / d : vec2(0.0);
    vec2 push = (along * 0.75 + away * 0.55) * uPush * min(speed / 6.0, 1.0);
    c.rg = mix(c.rg, push, w * 0.55);
  }
  float wg = exp(-pow(d / uGlowRadius, 2.0) * 2.2);
  c.b = max(c.b, wg * uGlow);
  gl_FragColor = c;
}
`;

// rect: the field's extent over the ground (world: minX, minZ, sizeX, sizeZ)
export function createWindField(rect) {
  const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const targets = [new THREE.WebGLRenderTarget(SIZE, SIZE, opts), new THREE.WebGLRenderTarget(SIZE, SIZE, opts)];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPrev: { value: null },
      uTexel: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) },
      uA: { value: new THREE.Vector2(-9, -9) },
      uB: { value: new THREE.Vector2(-9, -9) },
      uVel: { value: new THREE.Vector2() },
      uPush: { value: 0.7 },
      uRadius: { value: 0.02 },
      uGlowRadius: { value: 0.015 },
      uGlow: { value: 0 },
      uRelax: { value: 0.95 },
      uFade: { value: 0.95 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let read = 0;
  let cleared = false;
  const toUv = (x, z, out) => out.set((x - rect.x) / rect.z, (z - rect.y) / rect.w);

  return {
    rect,
    texture: targets[0].texture,
    // one step: the pointer's path (world x, z from → to; null when it
    // isn't over the ground), its speed, the reach of its push and glow (m)
    step(gl, { from, to, vel, push, radius, glowRadius, glow, relax, fade }) {
      const u = material.uniforms;
      if (from && to) {
        toUv(from.x, from.z, u.uA.value);
        toUv(to.x, to.z, u.uB.value);
      } else {
        u.uA.value.set(-9, -9);
        u.uB.value.set(-9, -9);
      }
      u.uVel.value.copy(vel);
      u.uPush.value = push;
      u.uRadius.value = radius / rect.z;
      u.uGlowRadius.value = glowRadius / rect.z;
      u.uGlow.value = glow;
      u.uRelax.value = relax;
      u.uFade.value = fade;
      const prev = gl.getRenderTarget();
      if (!cleared) {
        for (const t of targets) {
          gl.setRenderTarget(t);
          gl.clear();
        }
        cleared = true;
      }
      u.uPrev.value = targets[read].texture;
      gl.setRenderTarget(targets[1 - read]);
      gl.render(scene, camera);
      gl.setRenderTarget(prev);
      read = 1 - read;
      this.texture = targets[read].texture;
      return this.texture;
    },
    dispose() {
      targets.forEach((t) => t.dispose());
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
