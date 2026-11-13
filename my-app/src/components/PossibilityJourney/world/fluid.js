import * as THREE from "three";

// A small stable-fluids solver in screen space (advection, vorticity,
// pressure projection), stirred by the pointer. It carries two fields:
//   velocity – the flow, in grid texels per second
//   dye      – the liquid's thickness (r), dropped along the pointer's path,
//              carried by the flow and slowly evaporating
// The Liquid effect (scene/Liquid.js) refracts the whole picture through the
// dye, as through a clear film of water drawn across the screen.

const VERT = /* glsl */ `
  uniform vec2 uTexel;
  varying vec2 vUv, vL, vR, vT, vB;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    vL = vUv - vec2(uTexel.x, 0.0);
    vR = vUv + vec2(uTexel.x, 0.0);
    vT = vUv + vec2(0.0, uTexel.y);
    vB = vUv - vec2(0.0, uTexel.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

const FRAG = {
  // carry a field through the velocity; uScale converts velocity (velocity
  // grid texels / s) into the target's uv
  advect: /* glsl */ `
    uniform sampler2D uVel, uSrc;
    uniform vec2 uVelTexel;
    uniform float uDt, uKeep;
    varying vec2 vUv;
    void main() {
      vec2 back = vUv - uDt * texture2D(uVel, vUv).xy * uVelTexel;
      gl_FragColor = uKeep * texture2D(uSrc, back);
    }`,
  // a soft capsule from uA to uB, adding uValue
  splat: /* glsl */ `
    uniform sampler2D uSrc;
    uniform vec2 uA, uB;
    uniform vec4 uValue;
    uniform float uRadius, uAspect;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - uA;
      vec2 ba = uB - uA;
      p.x *= uAspect; ba.x *= uAspect;
      float h = clamp(dot(p, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
      vec2 d = p - ba * h;
      float g = exp(-dot(d, d) / uRadius);
      gl_FragColor = texture2D(uSrc, vUv) + uValue * g;
    }`,
  curl: /* glsl */ `
    uniform sampler2D uVel;
    varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uVel, vL).y;
      float R = texture2D(uVel, vR).y;
      float T = texture2D(uVel, vT).x;
      float B = texture2D(uVel, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  vorticity: /* glsl */ `
    uniform sampler2D uVel, uCurl;
    uniform float uAmount, uDt;
    varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      f /= length(f) + 1e-4;
      f *= uAmount * C;
      f.y = -f.y;
      vec2 v = texture2D(uVel, vUv).xy + f * uDt;
      gl_FragColor = vec4(clamp(v, -2000.0, 2000.0), 0.0, 1.0);
    }`,
  divergence: /* glsl */ `
    uniform sampler2D uVel;
    varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      vec2 C = texture2D(uVel, vUv).xy;
      float L = vL.x < 0.0 ? -C.x : texture2D(uVel, vL).x;
      float R = vR.x > 1.0 ? -C.x : texture2D(uVel, vR).x;
      float T = vT.y > 1.0 ? -C.y : texture2D(uVel, vT).y;
      float B = vB.y < 0.0 ? -C.y : texture2D(uVel, vB).y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  fade: /* glsl */ `
    uniform sampler2D uSrc;
    uniform float uKeep;
    varying vec2 vUv;
    void main() { gl_FragColor = vec4(uKeep * texture2D(uSrc, vUv).x, 0.0, 0.0, 1.0); }`,
  pressure: /* glsl */ `
    uniform sampler2D uPressure, uDiv;
    varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float d = texture2D(uDiv, vUv).x;
      gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
    }`,
  gradient: /* glsl */ `
    uniform sampler2D uPressure, uVel;
    varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      gl_FragColor = vec4(texture2D(uVel, vUv).xy - 0.5 * vec2(R - L, T - B), 0.0, 1.0);
    }`,
};

const target = (w, h) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });

class PingPong {
  constructor(w, h) {
    this.read = target(w, h);
    this.write = target(w, h);
  }
  swap() {
    [this.read, this.write] = [this.write, this.read];
  }
  setSize(w, h) {
    this.read.setSize(w, h);
    this.write.setSize(w, h);
  }
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

export class LiquidSim {
  constructor({ sim = 128, dye = 512, iterations = 20 } = {}) {
    this.simRes = sim;
    this.dyeRes = dye;
    this.iterations = iterations;
    this.aspect = 1;
    this.sw = sim;
    this.sh = sim;
    this.dw = dye;
    this.dh = dye;
    this.vel = new PingPong(sim, sim);
    this.dye = new PingPong(dye, dye);
    this.pressure = new PingPong(sim, sim);
    this.div = target(sim, sim);
    this.curl = target(sim, sim);
    this.simTexel = new THREE.Vector2(1 / sim, 1 / sim);
    this.dyeTexel = new THREE.Vector2(1 / dye, 1 / dye);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.geo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.geo);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const make = (frag, uniforms, texel) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: { uTexel: { value: texel }, ...uniforms }, depthTest: false, depthWrite: false });
    const S = this.simTexel;
    this.m = {
      advectVel: make(FRAG.advect, { uVel: { value: null }, uSrc: { value: null }, uVelTexel: { value: S }, uDt: { value: 0 }, uKeep: { value: 1 } }, S),
      advectDye: make(FRAG.advect, { uVel: { value: null }, uSrc: { value: null }, uVelTexel: { value: S }, uDt: { value: 0 }, uKeep: { value: 1 } }, this.dyeTexel),
      splatVel: make(FRAG.splat, { uSrc: { value: null }, uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uValue: { value: new THREE.Vector4() }, uRadius: { value: 0.001 }, uAspect: { value: 1 } }, S),
      splatDye: make(FRAG.splat, { uSrc: { value: null }, uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uValue: { value: new THREE.Vector4() }, uRadius: { value: 0.001 }, uAspect: { value: 1 } }, this.dyeTexel),
      curl: make(FRAG.curl, { uVel: { value: null } }, S),
      vorticity: make(FRAG.vorticity, { uVel: { value: null }, uCurl: { value: null }, uAmount: { value: 24 }, uDt: { value: 0 } }, S),
      divergence: make(FRAG.divergence, { uVel: { value: null } }, S),
      fade: make(FRAG.fade, { uSrc: { value: null }, uKeep: { value: 0.8 } }, S),
      pressure: make(FRAG.pressure, { uPressure: { value: null }, uDiv: { value: null } }, S),
      gradient: make(FRAG.gradient, { uPressure: { value: null }, uVel: { value: null } }, S),
    };

    this.goal = new THREE.Vector2(0.5, 0.5);
    this.point = new THREE.Vector2(0.5, 0.5);
    this.last = new THREE.Vector2(0.5, 0.5);
    this.armed = false;
    this.energy = 0;
    this.cleared = false;
  }

  get velocity() {
    return this.vel.read.texture;
  }
  get thickness() {
    return this.dye.read.texture;
  }

  setAspect(aspect) {
    if (Math.abs(aspect - this.aspect) < 1e-3) return;
    this.aspect = aspect;
    this.sh = this.simRes;
    this.sw = Math.max(16, Math.round(this.simRes * aspect));
    this.dh = this.dyeRes;
    this.dw = Math.max(16, Math.round(this.dyeRes * aspect));
    this.vel.setSize(this.sw, this.sh);
    this.pressure.setSize(this.sw, this.sh);
    this.div.setSize(this.sw, this.sh);
    this.curl.setSize(this.sw, this.sh);
    this.dye.setSize(this.dw, this.dh);
    this.simTexel.set(1 / this.sw, 1 / this.sh);
    this.dyeTexel.set(1 / this.dw, 1 / this.dh);
    this.m.splatVel.uniforms.uAspect.value = aspect;
    this.m.splatDye.uniforms.uAspect.value = aspect;
  }

  // the pointer, in uv (0–1, origin bottom left)
  pointer(u, v) {
    this.goal.set(u, v);
    if (!this.armed) {
      this.point.copy(this.goal);
      this.last.copy(this.goal);
      this.armed = true;
    }
  }

  pass(gl, material, out) {
    this.quad.material = material;
    gl.setRenderTarget(out);
    gl.render(this.scene, this.camera);
  }

  clearAll(gl) {
    const c = gl.getClearColor(new THREE.Color());
    const a = gl.getClearAlpha();
    gl.setClearColor(0x000000, 0);
    for (const t of [this.vel.read, this.vel.write, this.dye.read, this.dye.write, this.pressure.read, this.pressure.write]) {
      gl.setRenderTarget(t);
      gl.clear(true, false, false);
    }
    gl.setClearColor(c, a);
  }

  // o: { radius (share of screen height), force, ink, trail (seconds the
  // liquid lingers), swirl, follow (how quickly the stroke follows the pointer) }
  step(gl, dt, o) {
    dt = Math.min(dt, 1 / 30);
    const prev = gl.getRenderTarget();
    const shadows = gl.shadowMap.enabled;
    const autoClear = gl.autoClear;
    gl.shadowMap.enabled = false;
    gl.autoClear = false;
    if (!this.cleared) {
      this.clearAll(gl);
      this.cleared = true;
    }

    let moving = false;
    if (this.armed) {
      this.last.copy(this.point);
      this.point.lerp(this.goal, 1 - Math.exp(-dt * o.follow));
      moving = this.point.distanceToSquared(this.last) > 1e-10;
    }
    if (moving) this.energy = 1;
    else this.energy *= Math.exp(-dt / Math.max(0.2, o.trail));
    // fully settled: nothing on screen, no work
    if (this.energy < 0.002) {
      gl.setRenderTarget(prev);
      gl.shadowMap.enabled = shadows;
      gl.autoClear = autoClear;
      return false;
    }

    const M = this.m;
    // advect the flow through itself; carry the liquid along it
    M.advectVel.uniforms.uVel.value = this.vel.read.texture;
    M.advectVel.uniforms.uSrc.value = this.vel.read.texture;
    M.advectVel.uniforms.uDt.value = dt;
    M.advectVel.uniforms.uKeep.value = 1 / (1 + dt * 1.6);
    this.pass(gl, M.advectVel, this.vel.write);
    this.vel.swap();
    M.advectDye.uniforms.uVel.value = this.vel.read.texture;
    M.advectDye.uniforms.uSrc.value = this.dye.read.texture;
    M.advectDye.uniforms.uDt.value = dt;
    M.advectDye.uniforms.uKeep.value = 1 / (1 + dt / Math.max(0.1, o.trail));
    this.pass(gl, M.advectDye, this.dye.write);
    this.dye.swap();

    // the stroke: push the flow along it, lay liquid down on it
    if (moving) {
      const r = o.radius * o.radius * 0.5;
      const dx = this.point.x - this.last.x;
      const dy = this.point.y - this.last.y;
      for (const [mat, pp] of [
        [M.splatVel, this.vel],
        [M.splatDye, this.dye],
      ]) {
        const u = mat.uniforms;
        u.uSrc.value = pp.read.texture;
        u.uA.value.copy(this.last);
        u.uB.value.copy(this.point);
        u.uRadius.value = r;
        if (pp === this.vel) u.uValue.value.set((dx * this.sw * o.force) / dt, (dy * this.sh * o.force) / dt, 0, 0);
        else u.uValue.value.set(o.ink * Math.min(1, Math.hypot(dx, dy) * 60 + 0.25), 0, 0, 0);
        this.pass(gl, mat, pp.write);
        pp.swap();
      }
    }

    // keep the swirls alive (skipped entirely when there are none)
    if (o.swirl > 0.01) {
      M.curl.uniforms.uVel.value = this.vel.read.texture;
      this.pass(gl, M.curl, this.curl);
      M.vorticity.uniforms.uVel.value = this.vel.read.texture;
      M.vorticity.uniforms.uCurl.value = this.curl.texture;
      M.vorticity.uniforms.uAmount.value = o.swirl;
      M.vorticity.uniforms.uDt.value = dt;
      this.pass(gl, M.vorticity, this.vel.write);
      this.vel.swap();
    }

    // incompressible: it flows around, not just away
    M.divergence.uniforms.uVel.value = this.vel.read.texture;
    this.pass(gl, M.divergence, this.div);
    M.fade.uniforms.uSrc.value = this.pressure.read.texture;
    this.pass(gl, M.fade, this.pressure.write);
    this.pressure.swap();
    M.pressure.uniforms.uDiv.value = this.div.texture;
    for (let i = 0; i < this.iterations; i++) {
      M.pressure.uniforms.uPressure.value = this.pressure.read.texture;
      this.pass(gl, M.pressure, this.pressure.write);
      this.pressure.swap();
    }
    M.gradient.uniforms.uPressure.value = this.pressure.read.texture;
    M.gradient.uniforms.uVel.value = this.vel.read.texture;
    this.pass(gl, M.gradient, this.vel.write);
    this.vel.swap();

    gl.setRenderTarget(prev);
    gl.shadowMap.enabled = shadows;
    gl.autoClear = autoClear;
    return true;
  }

  dispose() {
    this.vel.dispose();
    this.dye.dispose();
    this.pressure.dispose();
    this.div.dispose();
    this.curl.dispose();
    this.geo.dispose();
    Object.values(this.m).forEach((m) => m.dispose());
  }
}
