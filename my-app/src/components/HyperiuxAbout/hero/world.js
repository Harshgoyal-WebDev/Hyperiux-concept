import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

// The about hero's world: the forging concept's dusk (same sun, same sky
// palette, same basalt and forge orange), around the Hyperiux monolith
// (public/models/hyperiux-monolith.glb). World units are metres; the
// monolith stands at the origin, its logo face towards +Z.

export const ACCENT = "#ff5f00";
// Low sunset sun behind the monolith and a little to the right of the shot
// (the concept's SUN_DIR, turned a touch into frame).
export const SUN_DIR = new THREE.Vector3(0.36, 0.07, -0.93).normalize();
// The cube's place in the logo's hexagon (hyperiux-monolith-metadata.json).
export const CUBE_POS = new THREE.Vector3(-0.0286, 6.284, 0);
export const CUBE_EDGE = 1.05;
export const CUBE_TILT = new THREE.Euler(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0);
// Haze, matched to the sky's horizon band (linear).
export const HAZE = new THREE.Color().setRGB(0.78, 0.43, 0.24);

// Scroll travel of the pinned hero, in vh (the section is this + one screen).
export const HERO_TRAVEL_VH = 200;

// ---------------------------------------------------------------------------
// Camera path: five keys at even steps of the hero's scroll (0, .25, .5,
// .75, 1), a smooth curve through them. From the dunes, in towards the
// monolith as it opens, and on into the cube's light.
// ---------------------------------------------------------------------------
export const CAMERA_KEYS = {
  position: [
    [-9, 3.4, 66],
    [-6.5, 4.4, 44],
    [4.2, 5.8, 27],
    [1.4, 6.35, 13.5],
    [0, 6.3, 3.4],
  ],
  target: [
    [0, 7.6, 0],
    [0, 7.2, 0],
    [0, 6.8, 0],
    [0, 6.35, 0],
    [0, 6.28, -6],
  ],
};

// ---------------------------------------------------------------------------
// Dunes
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

// Wind-carved dunes: long ridged crests across the wind, broad swells under
// them, a flat floor round the monolith and a low valley along the camera's
// way in, the dunes rising higher behind it against the sunset.
export function createDuneHeight(seed = 7) {
  const n = createNoise2D(mulberry32(seed));
  return (x, z) => {
    const wx = x + n(x * 0.0021, z * 0.0021) * 70;
    const wz = z + n(x * 0.0019 + 40, z * 0.0019) * 50;
    // (far off, where the mesh is coarse against the sky, the crests soften
    // into broad rounded swells: no jagged skyline)
    const far = smooth(70, 320, Math.hypot(x, z));
    const nc = n(wx * 0.0062, wz * 0.0105);
    // (a soft |n|: sharp crests near, rounded far off)
    const c = Math.max(1 - Math.sqrt(nc * nc + 0.0004 + far * 0.12), 0);
    const crest = Math.pow(c, 3 - far * 1.2) * (15 - far * 7);
    const swell = n(x * 0.0024 + 11, z * 0.0024) * 7 + 6;
    const ripple = Math.pow(1 - Math.abs(n(wx * 0.03, wz * 0.05)), 2) * 1.1 * (1 - far);
    let h = crest + swell + ripple;
    // rising behind the monolith (the skyline)
    h *= 1 + smooth(-60, -320, z) * 1.0;
    // the floor round the monolith, and the valley the camera comes in by
    const d = Math.hypot(x, z);
    const floor = smooth(16, 72, d);
    const valley = Math.max(smooth(10, 46, Math.abs(x - z * 0.12)), 1 - smooth(-50, -8, z));
    return h * Math.min(floor, valley) - 0.15;
  };
}

export function buildDuneGeometry(height, size, segments) {
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  // (centred a little behind the monolith: more dunes towards the horizon)
  g.translate(0, 0, -size * 0.2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// Sky: the concept's dusk (Sky.jsx in forging-sand-dune-concept-v3) — slate
// blue overhead, lavender grey, peach and amber at the horizon, a low round
// sun and soft banks of cloud lit gold underneath.
// ---------------------------------------------------------------------------
export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uTime: { value: 0 },
      uHeat: { value: 0 }, // the forge's light warming the sky as it opens
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uHeat;
      varying vec3 vDir;
      float h3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float disc(vec3 d, vec3 dir, float r) {
        float a = acos(clamp(dot(d, dir), -1.0, 1.0));
        return 1.0 - smoothstep(r - 0.0012, r + 0.0012, a);
      }
      float n2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h3(vec3(i, 0.0)), h3(vec3(i + vec2(1.0, 0.0), 0.0)), f.x),
                   mix(h3(vec3(i + vec2(0.0, 1.0), 0.0)), h3(vec3(i + vec2(1.0, 1.0), 0.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += a * n2(p);
          p = p * 2.07 + vec2(3.1, 1.7);
          a *= 0.5;
        }
        return s;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sun = max(dot(d, uSunDir), 0.0);
        vec3 zenith = vec3(0.05, 0.075, 0.16);
        vec3 upper = vec3(0.2, 0.21, 0.3);
        vec3 peach = vec3(0.82, 0.5, 0.33);
        vec3 horizon = vec3(0.95, 0.50, 0.24);
        vec3 col = mix(horizon, peach, smoothstep(0.0, 0.07, h));
        col = mix(col, upper, smoothstep(0.05, 0.28, h));
        col = mix(col, zenith, smoothstep(0.25, 0.8, h));
        float band = 1.0 - smoothstep(0.0, 0.32, abs(h));
        col += vec3(1.0, 0.42, 0.12) * pow(sun, 5.0) * band * 0.9;
        col += vec3(1.0, 0.7, 0.4) * pow(sun, 60.0) * 0.45;
        col = mix(col, vec3(1.0, 0.94, 0.8) * 3.4, disc(d, uSunDir, 0.03));
        if (h > 0.0) {
          vec2 cp = d.xz / (h + 0.035);
          vec2 q = vec2(cp.x * 0.42 + uTime * 0.004, cp.y * 0.95);
          vec2 w1 = vec2(fbm(q * 0.6 + 5.0), fbm(q * 0.6 + 9.0)) - 0.5;
          q += w1 * vec2(1.4, 0.7);
          vec2 w2 = vec2(fbm(q * 1.3 + 2.0), fbm(q * 1.3 + 17.0)) - 0.5;
          q += w2 * 0.45;
          float bank = max(fbm(q * vec2(0.9, 1.2)), fbm(q * 0.7 + 31.0) * 1.08 - 0.06);
          float wisp = fbm(q * vec2(2.6, 3.4) + 13.0);
          float low = smoothstep(0.5, 0.75, bank + 0.12 * wisp) * (1.0 - smoothstep(0.12, 0.3, h));
          float high = smoothstep(0.58, 0.85, bank * 0.6 + wisp * 0.55) * smoothstep(0.1, 0.22, h) * (1.0 - smoothstep(0.55, 0.85, h));
          float cover = max(low, high * 0.75) * smoothstep(0.015, 0.06, h);
          float toSun = pow(sun, 2.5);
          float under = smoothstep(0.35, 0.75, 1.0 - wisp);
          vec3 lit = mix(vec3(0.85, 0.5, 0.42), vec3(1.2, 0.74, 0.46), toSun) * mix(0.7, 1.15, under);
          vec3 shade = mix(vec3(0.2, 0.21, 0.3), vec3(0.42, 0.32, 0.34), 1.0 - smoothstep(0.05, 0.4, h));
          vec3 cloud = mix(shade, lit, clamp(toSun * 1.4 + (1.0 - smoothstep(0.0, 0.25, h)) * 0.55, 0.0, 1.0));
          col = mix(col, cloud, cover * 0.8 * (1.0 - disc(d, uSunDir, 0.04)));
        }
        if (h < 0.0) col = mix(col, vec3(0.62, 0.33, 0.17), 1.0 - smoothstep(-0.08, 0.0, h));
        // the forge opening: a warm bloom low on the sky behind the monolith
        float behind = pow(max(dot(d, normalize(vec3(0.0, 0.12, -1.0))), 0.0), 18.0);
        col += vec3(1.0, 0.36, 0.06) * behind * uHeat * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
