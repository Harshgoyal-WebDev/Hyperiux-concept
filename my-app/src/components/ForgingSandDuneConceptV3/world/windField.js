import * as THREE from "three";

// The pointer's stir through the broken rock round the mark: every grain of
// sand, every bit of gravel and every broken piece has its own push — how far
// it has been knocked from where its stream would have it (in the screen's
// plane) and how fast it is going — that it carries with it as it goes round
// the mark. While the pointer moves, an invisible ball follows it; whatever
// it hits is flung off along the stroke and out from its line, harder the
// faster the stroke (heavier bits less). From then on each bit only coasts
// out and comes home on a critically damped spring: it goes out, slows,
// and eases back to exactly its own place in its stream — no overshoot, no
// circling, no swinging back and forth. A resting pointer touches nothing.
//
// Units: the ball's radius (T.breakStirRadius of the screen's height) in
// both x and y of the screen.
//
// The sand and gravel are drawn in their shaders with no state of their own,
// so each layer keeps its bits' pushes in a small float texture, one texel a
// bit (xy: the push, zw: its velocity), stepped once a frame by drawing each
// bit as a point onto its own texel (createStirState) with the layer's own
// flow — so the step knows where its stream has it — and read back when the
// layer is drawn (world/breakup.js breakupStirAt). The broken pieces are few:
// each runs the same on the CPU (stirPiece).

// The ball, kept by BreakupStir each frame (field units) and read by every
// layer's step and the pieces.
export const STIR_BALL = {
  on: false, // stepping (something has been stirred and is still settling)
  pos: new THREE.Vector2(),
  prev: new THREE.Vector2(),
  vel: new THREE.Vector2(),
  presence: 0, // its reach (radii): from its speed, 0 at rest
  radius: 0.12, // screen heights
  aspect: 1,
  throw: 1, // how hard it flings what it hits
  omega: 1.2, // the spring home (1/s): critically damped
  spread: 0.4, // how unevenly bits are flung (0 = all alike)
  mass: 1, // how much more slowly heavy bits answer
};

// The step, shared by the GPU (each layer) and the CPU (the pieces): the
// ball meeting a bit (q: where it is now, field units) — the velocity it is
// flung towards and how strongly — and then the spring home.
const STEP_GLSL = /* glsl */ `
uniform vec2 uBall;
uniform vec2 uBallPrev;
uniform vec2 uBallVel;
uniform float uPresence;
uniform float uThrow;
uniform float uOmega;
uniform float uSpread;
uniform float uMassK;
uniform float uDt;
uniform float uAspect;
uniform float uR;
vec4 stirStep(vec4 st, vec3 world, float seed, float inertia, bool live) {
  vec2 d = st.xy;
  vec2 v = st.zw;
  if (!live) return vec4(0.0);
  vec4 clip = projectionMatrix * viewMatrix * vec4(world, 1.0);
  float speed = length(uBallVel);
  if (clip.w > 0.0 && uPresence > 0.0 && speed > 1e-3) {
    vec2 x = vec2((clip.x / clip.w * 0.5 + 0.5) * uAspect, clip.y / clip.w * 0.5 + 0.5) / uR;
    vec2 q = x + d;
    // (against the stroke it swept this frame: a fast one is a tunnel, not dots)
    vec2 sw = uBall - uBallPrev;
    float h = clamp(dot(q - uBallPrev, sw) / max(dot(sw, sw), 1e-8), 0.0, 1.0);
    vec2 rel = q - (uBallPrev + sw * h);
    float r = length(rel);
    float reach = uPresence;
    if (r < reach) {
      vec2 dir = uBallVel / speed;
      vec2 across = vec2(-dir.y, dir.x);
      float side = dot(rel, across) >= 0.0 ? 1.0 : -1.0;
      float j1 = fract(seed * 23.17);
      float j2 = fract(seed * 61.31);
      float m = max(1.0 + (inertia - 1.0) * uMassK, 0.5);
      // carried along the stroke and parted out from its line, like dust
      // in a gust (each a little differently)
      vec2 target = (dir * (0.8 + uSpread * (j1 - 0.5)) + across * side * (0.5 + uSpread * j2)) * speed * uThrow * inversesqrt(m);
      float hit = 1.0 - smoothstep(reach * 0.35, reach, r);
      v = mix(v, target, hit * (1.0 - exp(-uDt * 16.0 / m)));
    }
  }
  // home on a critically damped spring (exact over the step: never
  // overshoots, never circles)
  float w = uOmega;
  float e = exp(-w * uDt);
  vec2 b = v + w * d;
  vec2 d1 = (d + b * uDt) * e;
  vec2 v1 = (v - w * b * uDt) * e;
  // (settled: let go)
  if (dot(d1, d1) < 1e-8 && dot(v1, v1) < 1e-8) return vec4(0.0);
  return vec4(d1, v1);
}
`;

const FRAGMENT = /* glsl */ `
varying vec4 vState;
void main() { gl_FragColor = vState; }
`;

// A layer's pushes: count bits, the layer's flow (breakupGLSL), its
// attributes (aLocal, aMain: piece, threshold, size, …, aDrift) and how a
// bit's seed and inertia are worked out from them (GLSL expressions).
export const STIR_W = 256;
export function createStirState({ count, flowGLSL, uniforms, attributes, seed, inertia }) {
  const W = STIR_W;
  const H = Math.max(Math.ceil(count / W), 1);
  const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false };
  const targets = [new THREE.WebGLRenderTarget(W, H, opts), new THREE.WebGLRenderTarget(W, H, opts)];
  const stepUniforms = {
    uState: { value: targets[0].texture },
    uStateSize: { value: new THREE.Vector2(W, H) },
    uBall: { value: new THREE.Vector2() },
    uBallPrev: { value: new THREE.Vector2() },
    uBallVel: { value: new THREE.Vector2() },
    uPresence: { value: 0 },
    uThrow: { value: 1 },
    uOmega: { value: 1.2 },
    uSpread: { value: 0.4 },
    uMassK: { value: 1 },
    uDt: { value: 1 / 60 },
    uAspect: { value: 1 },
    uR: { value: 0.12 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...stepUniforms },
    vertexShader: /* glsl */ `
      ${flowGLSL}
      ${STEP_GLSL}
      attribute vec3 aLocal;
      attribute vec4 aMain;
      attribute vec4 aDrift;
      uniform sampler2D uState;
      uniform vec2 uStateSize;
      varying vec4 vState;
      void main() {
        int id = gl_VertexID;
        ivec2 tx = ivec2(id % ${W}, id / ${W});
        gl_Position = vec4((vec2(tx) + 0.5) / uStateSize * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = 1.0;
        vec3 p;
        float g = breakupFlow(int(aMain.x + 0.5), aLocal, aMain.y, aDrift, p);
        vState = stirStep(texelFetch(uState, tx, 0), p, ${seed}, ${inertia}, g >= 0.0);
      }`,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  for (const [name, array, size] of attributes) geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  // (stepped with the frame's camera, whatever layers it has on)
  points.layers.mask = 0xffffffff;
  const scene = new THREE.Scene();
  scene.add(points);
  let read = 0;
  const clearAll = (gl) => {
    const color = gl.getClearColor(new THREE.Color());
    const alpha = gl.getClearAlpha();
    const prev = gl.getRenderTarget();
    gl.setClearColor(0x000000, 0);
    for (const t of targets) {
      gl.setRenderTarget(t);
      gl.clear(true, false, false);
    }
    gl.setRenderTarget(prev);
    gl.setClearColor(color, alpha);
  };
  let cleared = false;
  const api = {
    texture: targets[0].texture,
    // one step of dt for the first n bits, with the frame's camera (where
    // each bit's stream has it on screen)
    step(gl, camera, n, dt) {
      if (!cleared) {
        clearAll(gl);
        cleared = true;
      }
      const B = STIR_BALL;
      const u = stepUniforms;
      u.uState.value = targets[read].texture;
      u.uBall.value.copy(B.pos);
      u.uBallPrev.value.copy(B.prev);
      u.uBallVel.value.copy(B.vel);
      u.uPresence.value = B.presence;
      u.uThrow.value = B.throw;
      u.uOmega.value = B.omega;
      u.uSpread.value = B.spread;
      u.uMassK.value = B.mass;
      u.uDt.value = dt;
      u.uAspect.value = B.aspect;
      u.uR.value = B.radius;
      geometry.setDrawRange(0, Math.min(n, count));
      const prev = gl.getRenderTarget();
      const color = gl.getClearColor(new THREE.Color());
      const alpha = gl.getClearAlpha();
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      gl.setClearColor(0x000000, 0);
      gl.setRenderTarget(targets[1 - read]);
      gl.clear(true, false, false);
      gl.render(scene, camera);
      gl.setRenderTarget(prev);
      gl.setClearColor(color, alpha);
      gl.autoClear = autoClear;
      read = 1 - read;
      this.texture = targets[read].texture;
      return this.texture;
    },
    // (back to nothing stirred)
    reset(gl) {
      clearAll(gl);
      cleared = true;
    },
    dispose() {
      targets.forEach((t) => t.dispose());
      material.dispose();
      geometry.dispose();
    },
    // (?debug: read back, measuring)
    probe(gl, n) {
      const buf = new Uint16Array(W * H * 4);
      gl.readRenderTargetPixels(targets[read], 0, 0, W, H, buf);
      let maxD = 0;
      let sumD = 0;
      let moved = 0;
      for (let i = 0; i < Math.min(n, W * H); i++) {
        const x = THREE.DataUtils.fromHalfFloat(buf[i * 4]);
        const y = THREE.DataUtils.fromHalfFloat(buf[i * 4 + 1]);
        const d = Math.hypot(x, y);
        if (d > maxD) maxD = d;
        sumD += d;
        if (d > 0.05) moved++;
      }
      return { maxD, meanD: sumD / Math.max(n, 1), moved };
    },
  };
  if (typeof window !== "undefined" && window.__seek) (window.__stirStates ??= []).push(api);
  return api;
}

// A broken piece in the stir: the same step on the CPU, by its own inertia.
// Its push (world, at its depth) into offset and the tilt it has been knocked
// into (about the axis across its push, as far as it has been pushed: it
// rights itself as it comes home) into turn; false when it is at rest.
const _v = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _x = new THREE.Vector2();
const _q = new THREE.Vector2();
const _rel = new THREE.Vector2();
const _dir = new THREE.Vector2();
const _target = new THREE.Vector2();
const _b = new THREE.Vector2();
export function stirPiece(c, world, inertia, dt, camera, offset, turn) {
  const B = STIR_BALL;
  if (!c.stir) c.stir = { d: new THREE.Vector2(), v: new THREE.Vector2(), seed: Math.random(), live: false };
  const s = c.stir;
  if (!B.on && !s.live) return false;
  _v.copy(world).project(camera);
  const speed = B.vel.length();
  if (B.on && _v.z < 1 && B.presence > 0 && speed > 1e-3) {
    _x.set(((_v.x * 0.5 + 0.5) * B.aspect) / B.radius, (_v.y * 0.5 + 0.5) / B.radius);
    _q.copy(_x).add(s.d);
    const sx = B.pos.x - B.prev.x;
    const sy = B.pos.y - B.prev.y;
    const h = THREE.MathUtils.clamp(((_q.x - B.prev.x) * sx + (_q.y - B.prev.y) * sy) / Math.max(sx * sx + sy * sy, 1e-8), 0, 1);
    _rel.set(_q.x - B.prev.x - sx * h, _q.y - B.prev.y - sy * h);
    const r = _rel.length();
    // (a piece is bigger than a grain: it is met a little further out)
    const reach = B.presence * 1.3;
    if (r < reach) {
      _dir.copy(B.vel).divideScalar(speed);
      const side = _rel.x * -_dir.y + _rel.y * _dir.x >= 0 ? 1 : -1;
      const m = Math.max(1 + (inertia - 1) * B.mass, 0.5);
      _target
        .set(_dir.x * 0.8 - _dir.y * side * 0.5, _dir.y * 0.8 + _dir.x * side * 0.5)
        .multiplyScalar((speed * B.throw) / Math.sqrt(m));
      const hit = 1 - THREE.MathUtils.smoothstep(r, reach * 0.35, reach);
      s.v.lerp(_target, hit * (1 - Math.exp((-dt * 16) / m)));
    }
  }
  // home: critically damped (as the grains)
  const w = B.omega;
  const e = Math.exp(-w * dt);
  _b.copy(s.v).addScaledVector(s.d, w);
  s.d.addScaledVector(_b, dt).multiplyScalar(e);
  s.v.addScaledVector(_b, -w * dt).multiplyScalar(e);
  s.live = s.d.lengthSq() > 1e-8 || s.v.lengthSq() > 1e-8;
  if (!s.live) {
    s.d.set(0, 0);
    s.v.set(0, 0);
    return false;
  }
  // field units → world, at its depth
  camera.matrixWorld.extractBasis(_right, _up, _fwd);
  const depth = Math.max(-_v.copy(world).applyMatrix4(camera.matrixWorldInverse).z, 0.1);
  const worldH = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * B.radius;
  offset.copy(_right).multiplyScalar(s.d.x * worldH).addScaledVector(_up, s.d.y * worldH);
  // tilted over as far as it is pushed (and back as it comes home)
  const len = s.d.length();
  _axis.copy(_right).multiplyScalar(-s.d.y).addScaledVector(_up, s.d.x).normalize();
  turn.setFromAxisAngle(_axis, Math.min(len * 0.6, 2.5) * (s.seed < 0.5 ? 1 : -1));
  return true;
}
