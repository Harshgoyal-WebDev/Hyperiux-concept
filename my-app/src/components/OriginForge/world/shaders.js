import * as THREE from "three";

// Shared GLSL for the forge's energy: flowing streams, traced edges, the
// particle field, the sky and the light discs. Colours are linear HDR: the
// bloom pass picks up anything brighter than ~1.

export const ORANGE = new THREE.Color("#FF5F00");
export const MOLTEN = new THREE.Color("#FF7A18");
export const AMBER = new THREE.Color("#FF9A35");
export const HOT = new THREE.Color("#FFC080");
export const COPPER = new THREE.Color("#C87543");
export const IVORY = new THREE.Color("#F4F0E9");
export const WARM_WHITE = new THREE.Color("#FAF9F6");

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
};

// A stream of energy along a tube: pulses run its length; `uReveal` draws it.
// `onLight`: normal blending, for the ivory hall (additive vanishes on white)
export function energyFlowMaterial({ color = MOLTEN, density = 3, speed = 0.6, onLight = false } = {}) {
  return new THREE.ShaderMaterial({
    ...additive,
    ...(onLight ? { blending: THREE.NormalBlending } : {}),
    defines: onLight ? { ON_LIGHT: 1 } : {},
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 1 },
      uAlpha: { value: 1 },
      uDensity: { value: density },
      uSpeed: { value: speed },
      uColor: { value: color.clone().multiplyScalar(2.2) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uReveal, uAlpha, uDensity, uSpeed;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        if (vUv.x > uReveal) discard;
        float head = smoothstep(uReveal - 0.06, uReveal, vUv.x) * step(uReveal, 0.999);
        float flow = pow(0.5 + 0.5 * sin((vUv.x * uDensity - uTime * uSpeed) * 6.2831853), 8.0);
        float a = (0.18 + flow * 0.9 + head * 2.0) * uAlpha;
        #ifdef ON_LIGHT
        gl_FragColor = vec4(uColor * (0.7 + flow * 0.6 + head * 1.5), clamp(a, 0.0, 1.0));
        #else
        gl_FragColor = vec4(uColor * a, a);
        #endif
      }`,
  });
}

// Edge lines drawn progressively (attribute aT from world/logo.js traceEdges).
export function traceMaterial(color = MOLTEN) {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: {
      uProgress: { value: 0 },
      uIntensity: { value: 1 },
      uColor: { value: color.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aT;
      varying float vT;
      void main() {
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress, uIntensity;
      uniform vec3 uColor;
      varying float vT;
      void main() {
        if (vT > uProgress) discard;
        float head = smoothstep(uProgress - 0.12, uProgress, vT) * step(uProgress, 0.999);
        gl_FragColor = vec4(uColor * uIntensity * (1.0 + head * 3.0), 1.0);
      }`,
  });
}

// A soft round glow (light at the end of the corridor, the summit): radial
// falloff from a hot centre, scaled by uIntensity.
export function glowDiscMaterial({ inner = HOT, outer = ORANGE } = {}) {
  return new THREE.ShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    uniforms: {
      uIntensity: { value: 1 },
      uInner: { value: inner.clone() },
      uOuter: { value: outer.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform vec3 uInner, uOuter;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float core = smoothstep(0.55, 0.0, d);
        float halo = smoothstep(1.0, 0.1, d);
        vec3 col = mix(uOuter * halo, uInner * 3.0, core);
        float a = clamp(halo * 0.9 + core, 0.0, 1.0) * uIntensity;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
}

// The sky: a dark, clouded dome with molten light on the horizon (toward
// the forge, -z), turning to warm ivory as the ascent begins.
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uHorizon: { value: 0.4 },
      uLight: { value: 0 },
      uTop: { value: new THREE.Color("#060505") },
      uMid: { value: new THREE.Color("#171210") },
      uGlow: { value: new THREE.Color("#FF6A12") },
      uIvoryLow: { value: IVORY.clone() },
      uIvoryHigh: { value: WARM_WHITE.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHorizon, uLight;
      uniform vec3 uTop, uMid, uGlow, uIvoryLow, uIvoryHigh;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uMid, uTop, smoothstep(0.0, 0.55, h));
        vec3 flatDir = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
        float toward = pow(max(dot(flatDir, vec3(0.0, 0.0, -1.0)), 0.0), 2.5);
        float band = exp(-abs(h - 0.015) * 16.0);
        vec3 glow = uGlow * band * (0.18 + 1.6 * toward) * uHorizon;
        // clouds, lit from below near the glow
        vec2 cp = d.xz / max(h + 0.18, 0.06);
        float n = fbm(vec3(cp * 0.9, uTime * 0.01));
        float cloud = smoothstep(0.42, 0.85, n) * smoothstep(-0.05, 0.3, h);
        col = mix(col, uMid * 1.6, cloud * 0.55);
        col += uGlow * cloud * exp(-max(h, 0.0) * 5.0) * (0.06 + 0.5 * toward) * uHorizon;
        col += glow;
        vec3 ivory = mix(uIvoryLow, uIvoryHigh, smoothstep(-0.05, 0.6, h));
        col = mix(col, ivory, uLight);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// The particle field's choreography, shared by the drawing shader and the
// pointer simulation (world/particleSim.js): free drift → spiral into the
// core → orbits round the forming mark → settle on the mark's outline →
// rush through the opened gate. Pure function of the timeline's channels.
export const PARTICLE_PATH_GLSL = /* glsl */ `
  uniform float uTime, uAttract, uOrbit, uOrbitR, uForge, uDisperse, uPlaza, uCorr;
  uniform vec3 uCore, uMark;
  mat3 pRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 pRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  // returns the position; fade, glowK and alpha describe how it is drawn
  vec3 particlePath(vec3 home, vec4 seed, vec3 tgt, float group, out float fade, out float glowK, out float alpha) {
    float s0 = seed.x, s1 = seed.y, s2 = seed.z, s3 = seed.w;
    // drift: rise slowly through a band and wrap, swaying
    float span = 14.0;
    float k = fract(s2 + uTime * (0.006 + 0.012 * s1));
    vec3 p = home;
    p.y += (k - 0.5) * span;
    p.x += sin(uTime * 0.31 + s0 * 40.0) * 0.5;
    p.z += cos(uTime * 0.27 + s1 * 40.0) * 0.5;
    fade = smoothstep(0.0, 0.12, k) * smoothstep(1.0, 0.85, k);
    glowK = 0.0;
    alpha = 1.0;
    #ifndef LIGHT
    if (group < 0.5) {
      // 1. spiral into the core
      vec2 d = p.xz - uCore.xz;
      float ang = atan(d.y, d.x) + uTime * (0.25 + 0.5 * s2);
      float rr = 0.9 + s1 * 5.5;
      vec3 pc = vec3(uCore.x + cos(ang) * rr, uCore.y + (s3 - 0.5) * 2.4 + sin(uTime + s0 * 6.0) * 0.3, uCore.z + sin(ang) * rr);
      float ka = smoothstep(s0 * 0.4, s0 * 0.4 + 0.6, uAttract);
      p = mix(p, pc, ka);
      // 2. orbits around the forming mark, on a few tilted planes
      float oa = s0 * 6.2831853 + uTime * (0.22 + 0.3 * s1) * (s2 > 0.5 ? 1.0 : -1.0);
      float orad = uOrbitR * (0.82 + 0.36 * s1);
      vec3 po = vec3(cos(oa) * orad, 0.0, sin(oa) * orad);
      po = pRotZ((floor(s3 * 5.0) - 2.0) * 0.32) * pRotX(0.25 + (s2 - 0.5) * 0.5) * po;
      po += uMark + vec3(0.0, sin(uTime * 0.7 + s0 * 9.0) * 0.25, 0.0);
      float ko = smoothstep(s1 * 0.4, s1 * 0.4 + 0.6, uOrbit);
      p = mix(p, po, ko);
      // 3. settle on the mark
      vec3 pt = tgt + vec3(sin(uTime * 1.3 + s0 * 30.0), cos(uTime * 1.1 + s1 * 30.0), sin(uTime * 0.9 + s2 * 30.0)) * 0.035;
      float kf = smoothstep(s2 * 0.55, s2 * 0.55 + 0.45, uForge);
      p = mix(p, pt, kf);
      // 4. drawn through the opened gate
      float kd = smoothstep(s3 * 0.45, s3 * 0.45 + 0.55, uDisperse);
      p.xy = mix(p.xy, uMark.xy + (p.xy - uMark.xy) * 0.35, kd);
      p.z -= kd * kd * (26.0 + 46.0 * s1);
      fade = mix(fade, 1.0, max(max(ka, ko), kf));
      glowK = max(ka * 0.6, kf);
      alpha = uPlaza * (1.0 - smoothstep(0.75, 1.0, kd));
    } else {
      alpha = uCorr;
    }
    #endif
    return p;
  }
`;

// the uniforms the choreography reads (shared with the simulation by reference)
export const PARTICLE_PATH_UNIFORMS = ["uTime", "uAttract", "uOrbit", "uOrbitR", "uForge", "uDisperse", "uPlaza", "uCorr", "uCore", "uMark"];

// The particle field, drawn. Each particle sits on its choreographed path
// plus the offset the pointer simulation has given it (tOff: xyz offset,
// w glow), and blows out toward white-hot while stirred.
export function particleMaterial({ light = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
    defines: light ? { LIGHT: 1 } : {},
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 1 },
      uAttract: { value: 0 },
      uOrbit: { value: 0 },
      uOrbitR: { value: 12 },
      uForge: { value: 0 },
      uDisperse: { value: 0 },
      uPlaza: { value: 1 },
      uCorr: { value: 0 },
      uAlpha: { value: 1 },
      uCore: { value: new THREE.Vector3() },
      uMark: { value: new THREE.Vector3() },
      uColorA: { value: light ? COPPER.clone() : MOLTEN.clone().multiplyScalar(1.6) },
      uColorB: { value: light ? new THREE.Color("#9a5a33") : HOT.clone().multiplyScalar(2.4) },
      // stirred: white-hot in the forge, a bright ember on the ivory
      uHotColor: { value: light ? ORANGE.clone().multiplyScalar(1.15) : new THREE.Color(2.2, 1.95, 1.65) },
      // the pointer simulation (world/particleSim.js)
      tOff: { value: null },
      tVel: { value: null },
      uSim: { value: 0 },
      uDensity: { value: 1 },
      uBright: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aHome;
      attribute vec4 aSeed;
      attribute vec3 aTarget;
      attribute float aGroup;
      attribute vec2 aRef;
      uniform float uPixelRatio, uSize, uAlpha, uSim, uDensity, uBright;
      uniform vec3 uColorA, uColorB, uHotColor;
      uniform sampler2D tOff, tVel;
      ${PARTICLE_PATH_GLSL}
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        // only a share of them is drawn (T.particleDensity); the rest are
        // parked off-screen, unrasterised
        if (fract(aSeed.x * 7.31 + aSeed.z * 3.17) > uDensity) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          vColor = vec3(0.0);
          vAlpha = 0.0;
          return;
        }
        float fade, glowK, alpha;
        vec3 p = particlePath(aHome, aSeed, aTarget, aGroup, fade, glowK, alpha);
        float stir = 0.0;
        if (uSim > 0.5) {
          vec4 O = texture2D(tOff, aRef);
          p += O.xyz + texture2D(tVel, aRef).xyz * 0.016; // a touch ahead, so motion reads smooth
          stir = O.w;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blow = smoothstep(0.15, 0.9, stir);
        float size = uSize * (0.45 + aSeed.y * 1.1) * (1.0 + glowK * 0.4) * (1.0 + stir * 0.45);
        gl_PointSize = min(size * uPixelRatio * (210.0 / -mv.z), 48.0);
        vColor = mix(mix(uColorA, uColorB, aSeed.x * aSeed.x) * (1.0 + glowK * 1.2) * uBright, uHotColor, blow);
        vAlpha = min(1.0, fade * alpha * uAlpha * (0.45 + 0.55 * aSeed.w) * (1.0 + blow * 0.8));
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        if (a * vAlpha < 0.004) discard;
        #ifdef LIGHT
        gl_FragColor = vec4(vColor, a * vAlpha);
        #else
        gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
        #endif
      }`,
  });
}
