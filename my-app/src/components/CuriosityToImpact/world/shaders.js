import { DUST, ORANGE, TEX_W } from "./states";

// GLSL shared by the particles, the network's lines and the sculpture, so
// that all three agree on where everything is.

const f = (x) => x.toFixed(4);
export const COLORS = /* glsl */ `
  const vec3 C_ORANGE = vec3(1.0, 0.373, 0.122); // #FF5F1F
  const vec3 C_WHITE = vec3(0.969, 0.969, 0.961); // #F7F7F5
  const vec3 C_SILVER = vec3(0.663, 0.667, 0.678); // #A9AAAD
  const vec3 C_INK = vec3(0.067, 0.071, 0.078); // #111214
`;

// The sculpture: five silk ribbons swirling round the centre. A ribbon is a
// curve (s along it) with a width that twists round it (v across it);
// uSpread draws the layers apart (engineering), uTime keeps them flowing.
export const RIBBON = /* glsl */ `
  uniform float uTime;
  uniform float uSpread;
  vec3 ribbonCentre(float s, float id) {
    float ph = id * 1.37;
    float phi = ph + s * (3.2 + 0.25 * id) + 0.08 * sin(uTime * 0.15 + id);
    float R = (6.5 + 2.6 * sin(s * 4.08 + id)) * (1.0 + uSpread * 0.2 * id / 4.0);
    return vec3(
      R * cos(phi),
      (id - 2.0) * 0.9 * (1.0 + uSpread * 1.4) + 3.2 * (s - 0.5) * sin(ph + 1.0) + 0.7 * sin(s * 6.0 + uTime * 0.35 + id),
      R * sin(phi) * 0.6
    );
  }
  vec3 ribbon(float s, float v, float id) {
    vec3 c = ribbonCentre(s, id);
    vec3 T = normalize(ribbonCentre(s + 0.01, id) - c);
    vec3 N = normalize(cross(T, vec3(0.0, 1.0, 0.0)) + 1e-4);
    vec3 B = cross(N, T);
    float tw = id * 0.9 + s * (2.4 + 0.3 * id) + 0.15 * sin(uTime * 0.2 + id);
    float w = (2.0 + 1.1 * sin(s * 3.0 + id * 2.0)) * pow(sin(3.14159 * s), 0.7);
    return c + (cos(tw) * B + sin(tw) * N) * (v - 0.5) * w;
  }
`;

// Currents: a divergence-free field (each component independent of its own
// axis), two octaves, drifting in time: particles flow, never clump.
export const FLOW = /* glsl */ `
  vec3 flowField(vec3 p, float t) {
    return vec3(
      sin(p.y * 0.31 + t * 0.21) + sin(p.z * 0.17 - t * 0.13),
      sin(p.z * 0.27 + t * 0.17) + sin(p.x * 0.19 - t * 0.11),
      sin(p.x * 0.23 + t * 0.19) + sin(p.y * 0.15 + t * 0.23)
    ) + 0.5 * vec3(
      sin(p.y * 0.83 + t * 0.41),
      sin(p.z * 0.77 - t * 0.37),
      sin(p.x * 0.71 + t * 0.33)
    );
  }
`;

// Where particle `idx` is: between the state it leaves and the one it goes
// to (each particle on its own delay, swirling most in mid-move), on the
// currents. g → 1 as it settles onto the page's grid (applied on screen),
// band is its weight in the white band, rib its weight on the sculpture.
export const PARTICLE = /* glsl */ `
  uniform sampler2D uStates;
  uniform float uRows;
  uniform float uStage;
  uniform float uFlow;
  ${RIBBON}
  ${FLOW}
  vec4 fetchState(float k, float idx) {
    return texelFetch(uStates, ivec2(int(mod(idx, ${TEX_W}.0)), int(k * uRows + floor(idx / ${TEX_W}.0))), 0);
  }
  vec3 place(float k, float idx) {
    vec4 d = fetchState(k, idx);
    if (k == 6.0 || k == 7.0) {
      vec4 fr = k == 6.0 ? d : fetchState(6.0, idx);
      vec3 base = fr.z < 0.0 ? fetchState(0.0, idx).xyz * 0.9 : ribbon(fr.x, fr.y, fr.z);
      return k == 6.0 ? base : base + d.xyz;
    }
    return d.xyz;
  }
  void particle(float idx, out vec3 P, out float g, out float band, out float rib, out vec4 seed) {
    seed = fetchState(10.0, idx);
    float st = clamp(uStage, 0.0, 9.0);
    float k0 = min(floor(st), 8.0);
    float f = st - k0;
    float k1 = k0 + 1.0;
    float delay = seed.x;
    // the dissolve sweeps along the ribbons, not at random
    if (k0 == 6.0) {
      vec4 fr = fetchState(6.0, idx);
      delay = fr.z < 0.0 ? seed.x : 0.75 * fr.x + 0.25 * seed.x;
    }
    float t = smoothstep(delay * 0.45, delay * 0.45 + 0.55, f);
    vec3 a = place(k0, idx);
    vec3 b = k1 == 9.0 ? a : place(k1, idx);
    g = k1 == 9.0 ? t : 0.0;
    P = mix(a, b, t);
    bool dust = seed.w > ${f(DUST)};
    rib = dust ? 0.0 : (k0 == 6.0 ? 1.0 - t : 0.0) + (k1 == 6.0 ? t : 0.0);
    band = (k0 == 8.0 ? 1.0 : 0.0) + (k1 == 8.0 ? t : 0.0);
    float amp = uFlow * 0.55 * (0.6 + seed.y * 0.8) * (1.0 + 2.2 * sin(3.14159 * t)) * mix(1.0, 0.1, rib);
    P += flowField(P * 0.35 + seed.z * 10.0, uTime) * amp;
  }
  bool isOrange(vec4 seed) { return seed.w < ${f(ORANGE)}; }
`;

export const pointsVert = /* glsl */ `
  attribute float aIndex;
  uniform float uSize;
  uniform float uPx;
  uniform float uReveal;
  uniform float uLight;
  uniform vec3 uEnergy;
  uniform float uEnergyB;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform float uAspect;
  uniform vec2 uGridX;
  varying vec3 vCol;
  varying float vA;
  ${COLORS}
  ${PARTICLE}
  void main() {
    vec3 P; float g; float band; float rib; vec4 seed;
    particle(aIndex, P, g, band, rib, seed);
    // (in the white band a share of them carries the orange)
    bool orange = isOrange(seed) || seed.w < ${f(ORANGE)} + 0.22 * band;
    // the idea passing through: particles make way for it, and light up
    vec3 de = P - uEnergy;
    float nearE = uEnergyB * smoothstep(5.0, 0.0, length(de)) * (1.0 - rib * 0.7);
    P += normalize(de + 1e-4) * nearE * 0.9;
    vec4 mv = viewMatrix * vec4(P, 1.0);
    vec4 cp = projectionMatrix * mv;
    // the cursor (or a touch) parts them, in screen space
    vec2 dm = (cp.xy / max(cp.w, 1e-3) - uMouse) * vec2(uAspect, 1.0);
    float push = uMouseOn * smoothstep(0.24, 0.0, length(dm)) * (1.0 - g);
    mv.xy += normalize(dm + 1e-5) * push * (-mv.z) * 0.05;
    cp = projectionMatrix * mv;
    float depth = -mv.z;
    float alive = cp.w > 0.0 ? 1.0 : 0.0;
    // the page's grid (16): onto its column lines, on screen
    if (g > 0.0) {
      vec4 gd = fetchState(9.0, aIndex);
      vec3 to = vec3(mix(uGridX.x, uGridX.y, gd.x / 12.0), gd.y, 0.0);
      vec3 n = cp.w > 0.0 ? cp.xyz / cp.w : to;
      cp = vec4(mix(n, to, g), 1.0);
      alive = 1.0;
    }
    gl_Position = cp;
    float sz = uSize * (0.55 + seed.y * 0.9) * (orange ? 1.5 : 1.0) * (1.0 + nearE * 0.8);
    gl_PointSize = mix(clamp(sz * uPx * 60.0 / max(depth, 0.5), 0.0, 10.0 * uPx), 1.6 * uPx, g);
    // present: in order of rank as they emerge; fewer in the calm band and on the grid
    float vis = 1.0 - smoothstep(uReveal - 0.004, uReveal, seed.z);
    vis *= mix(1.0, step(seed.z, 0.45), band);
    vis *= mix(1.0, step(seed.z, 0.16), g);
    vis *= mix(smoothstep(0.8, 3.0, depth) * smoothstep(170.0, 60.0, depth), 1.0, g);
    vec3 base = mix(C_WHITE, mix(C_SILVER, C_INK, 0.35), uLight);
    vCol = orange ? C_ORANGE : mix(base, C_ORANGE, min(nearE * 0.8, 1.0));
    vA = alive * vis * (orange ? 0.95 : (0.25 + 0.6 * seed.y) * mix(1.0, 0.7, uLight)) * mix(1.0, 0.55, g);
  }
`;

// premultiplied: alpha × uNormal is how much it covers, so 0 adds light
// (the dark world) and 1 paints over (the white one)
export const pointsFrag = /* glsl */ `
  uniform float uNormal;
  varying vec3 vCol;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 1.6) * vA;
    gl_FragColor = vec4(vCol * a, a * uNormal);
  }
`;

// The network's lines: each end is a particle, so they move with them;
// faint everywhere, lit and orange where the idea passes; long ones fade
// (they only belong to the network's shape).
export const linesVert = /* glsl */ `
  attribute float aIndex;
  attribute float aOther;
  uniform float uLinks;
  uniform float uLight;
  uniform vec3 uEnergy;
  varying vec3 vCol;
  varying float vA;
  ${COLORS}
  ${PARTICLE}
  void main() {
    vec3 P; float g; float band; float rib; vec4 seed;
    particle(aIndex, P, g, band, rib, seed);
    vec3 Q; float g2; float band2; float rib2; vec4 seed2;
    particle(aOther, Q, g2, band2, rib2, seed2);
    float e = smoothstep(7.0, 0.0, distance(P, uEnergy));
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
    vCol = mix(mix(C_WHITE, C_SILVER, uLight), C_ORANGE, clamp(e * 0.9 + (isOrange(seed) ? 0.6 : 0.0), 0.0, 1.0));
    vA = uLinks * smoothstep(3.2, 1.1, distance(P, Q)) * (0.32 + 0.68 * e) * (1.0 - g) * 0.6;
  }
`;
export const linesFrag = /* glsl */ `
  uniform float uNormal;
  varying vec3 vCol;
  varying float vA;
  void main() { gl_FragColor = vec4(vCol * vA, vA * uNormal); }
`;

// The glass sculpture: the ribbons as surfaces. Fresnel rims, fine silk
// striations along their length, bright edges; it appears and dissolves by
// a sweep along the ribbons broken by noise, the dissolving edge glowing.
export const sculptVert = /* glsl */ `
  ${RIBBON}
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vW;
  varying vec2 vUV;
  varying float vId;
  void main() {
    vec3 P = ribbon(position.x, position.y, position.z);
    vec3 Pu = ribbon(position.x + 0.003, position.y, position.z);
    vec3 Pv = ribbon(position.x, position.y + 0.02, position.z);
    vN = normalize(cross(Pu - P, Pv - P) + 1e-5);
    vW = P;
    vV = cameraPosition - P;
    vUV = position.xy;
    vId = position.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }
`;
export const sculptFrag = /* glsl */ `
  uniform float uSculpt;
  uniform float uDissolve;
  uniform float uAccent;
  uniform vec3 uEnergy;
  uniform float uEnergyB;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vW;
  varying vec2 vUV;
  varying float vId;
  ${COLORS}
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float silk = pow(0.5 + 0.5 * cos(vUV.y * 6.2832 * 22.0 + vUV.x * 4.0), 14.0);
    float edge = smoothstep(0.08, 0.0, vUV.y) + smoothstep(0.92, 1.0, vUV.y);
    float key = vUV.x * 0.65 + (vnoise(vUV * vec2(40.0, 6.0) + vId * 7.0) * 0.7 + vnoise(vUV * vec2(140.0, 22.0)) * 0.3) * 0.35;
    float appear = 1.0 - smoothstep(uSculpt * 1.15 - 0.1, uSculpt * 1.15, key);
    float dis = uDissolve * 1.25 - 0.1;
    float keep = smoothstep(dis, dis + 0.08, key);
    float front = smoothstep(0.018, 0.0, abs(key - dis - 0.04)) * step(0.002, uDissolve) * step(uDissolve, 0.998);
    float e = uEnergyB * smoothstep(6.0, 0.0, distance(vW, uEnergy));
    float shown = appear * keep;
    float a = (0.03 + 0.5 * rim + 0.22 * silk * (0.4 + rim) + 0.3 * edge) * shown;
    vec3 col = mix(C_WHITE, C_SILVER, 0.35) * a
      + C_ORANGE * shown * (e * 0.45 + (vId == 1.0 ? edge * uAccent * 0.7 : 0.0))
      + C_ORANGE * front * (0.3 + 0.4 * rim) * appear;
    // (the camera passes through it: nothing an arm's length away)
    gl_FragColor = vec4(col * smoothstep(1.5, 7.0, length(vV)), 0.0);
  }
`;

// The backdrop: dark, until the light opens out from where the idea is
// (14) and fills the screen (15).
export const skyVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;
export const skyFrag = /* glsl */ `
  uniform float uLight;
  uniform float uAspect;
  uniform vec2 uCentre;
  varying vec2 vUv;
  ${COLORS}
  void main() {
    float r = length((vUv - uCentre) * vec2(uAspect, 1.0));
    float glow = 1.0 - smoothstep(0.0, 0.35 + uLight * 2.6, r);
    float m = clamp(glow * glow * smoothstep(0.0, 0.6, uLight) * 1.6 + smoothstep(0.8, 1.0, uLight), 0.0, 1.0);
    vec3 dark = vec3(0.031, 0.035, 0.043); // #08090B
    vec3 col = mix(dark, C_WHITE, m) + C_ORANGE * 0.07 * m * (1.0 - m) * 4.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// The idea: a head (core, halo, and in 05 a ring) and a trail of its own
// recent path; at the end it lands on the page (uLand → its place on screen).
export const energyVert = /* glsl */ `
  attribute float aT;
  uniform float uB;
  uniform float uRing;
  uniform float uPx;
  uniform float uLand;
  uniform vec2 uLandNdc;
  varying float vT;
  void main() {
    vT = aT;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 cp = projectionMatrix * mv;
    float depth = max(-mv.z, 0.5);
    if (aT == 0.0) {
      vec3 n = cp.w > 0.0 ? cp.xyz / cp.w : vec3(uLandNdc, 0.0);
      cp = mix(cp, vec4(mix(n, vec3(uLandNdc, 0.0), uLand), 1.0), step(0.0001, uLand));
      gl_PointSize = uPx * mix(clamp(1100.0 / depth, 18.0, 64.0) * (0.55 + 0.45 * min(uB, 1.0)) * (1.0 + uRing * 0.9), 11.0, uLand);
    } else {
      gl_PointSize = uPx * clamp((5.0 * (1.0 - aT) + 1.2) * 30.0 / depth, 1.0, 9.0);
    }
    gl_Position = cp;
  }
`;
export const energyFrag = /* glsl */ `
  uniform float uB;
  uniform float uRing;
  uniform float uLand;
  uniform float uNormal;
  varying float vT;
  ${COLORS}
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    vec3 col;
    float a;
    if (vT == 0.0) {
      float core = smoothstep(mix(0.16, 0.9, uLand), 0.0, d);
      float halo = exp(-d * d * 7.0) * 0.55 * (1.0 - uLand);
      float ring = smoothstep(0.04, 0.0, abs(d - 0.66)) * uRing;
      a = clamp(core + halo + ring * 0.9, 0.0, 1.0) * min(uB, 1.0);
      col = mix(C_ORANGE, vec3(1.0, 0.86, 0.74), core * 0.55 * (1.0 - uLand)) * (1.0 + max(uB - 1.0, 0.0));
    } else {
      a = pow(1.0 - d, 2.0) * pow(1.0 - vT, 1.5) * 0.7 * min(uB, 1.0) * (1.0 - uLand);
      col = C_ORANGE;
    }
    gl_FragColor = vec4(col * a, a * uNormal);
  }
`;
