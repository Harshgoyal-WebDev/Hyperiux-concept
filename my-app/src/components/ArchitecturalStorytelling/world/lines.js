import * as THREE from "three";

// Every line in the world is one segment of one batch, drawn on the GPU as a
// screen-space quad (so a line keeps its pixel weight at any distance). A
// segment carries its own schedule in world time W (one unit per frame of
// the page): it draws from its start to its end between `t0` and `t1`, and,
// if it has an `out`, undraws the same way. The scene only ever sets W, so
// every line follows the scroll exactly, both ways.
export const TONE = { ink: 0, guide: 1, accent: 2, faint: 3 };
const NEVER = 1e6;

export class Lines {
  constructor() {
    this.pos = [];
    this.draw = [];
    this.style = [];
    this.hi = [];
  }

  get count() {
    return this.pos.length / 6;
  }

  // a → b, drawn over [t0, t1]; optionally undrawn over `out`, lit orange
  // over `hi`, or carrying a running signal (`run`: its place along a loop)
  seg(a, b, { t0 = -1, t1 = -0.5, out, tone = "ink", w, hi, run } = {}) {
    if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-6) return this;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.draw.push(t0, Math.max(t1 - t0, 1e-4), out ? out[0] : NEVER, out ? Math.max(out[1] - out[0], 1e-4) : 1);
    const tn = TONE[tone];
    this.style.push(tn, w ?? [1.15, 1, 2, 1][tn], run ? run[0] : 0, run ? run[1] : 0);
    this.hi.push(hi ? hi[0] : NEVER, hi ? hi[1] : NEVER);
    return this;
  }

  // a polyline, drawn point to point across [t0, t1] by length
  path(points, { t0, t1, ...o }) {
    const lens = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
      lens.push(d);
      total += d;
    }
    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      const s = t0 + ((t1 - t0) * acc) / total;
      acc += lens[i - 1];
      const e = t0 + ((t1 - t0) * acc) / total;
      this.seg(points[i - 1], points[i], { t0: s, t1: e, ...o });
    }
    return this;
  }

  geometry() {
    const g = new THREE.InstancedBufferGeometry();
    // the quad of a segment (LineSegmentsGeometry's): x across, y along,
    // y < 0 and y > 1 the square caps
    g.setIndex([0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5]);
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, 2, 0, 1, 2, 0, -1, 1, 0, 1, 1, 0, -1, 0, 0, 1, 0, 0, -1, -1, 0, 1, -1, 0], 3));
    const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(this.pos), 6, 1);
    g.setAttribute("instanceStart", new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute("instanceEnd", new THREE.InterleavedBufferAttribute(ib, 3, 3));
    g.setAttribute("aDraw", new THREE.InstancedBufferAttribute(new Float32Array(this.draw), 4));
    g.setAttribute("aStyle", new THREE.InstancedBufferAttribute(new Float32Array(this.style), 4));
    g.setAttribute("aHi", new THREE.InstancedBufferAttribute(new Float32Array(this.hi), 2));
    g.instanceCount = this.count;
    return g;
  }
}

// The uniforms every material in the world shares: world time, the theme's
// colours, the screen, and the fog (centred where the camera looks, so what
// is far from the subject fades into the ground, near or far).
export function worldUniforms() {
  return {
    uW: { value: -1 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPx: { value: 1 },
    uWidth: { value: 1 },
    uNear: { value: 0.1 },
    uInk: { value: new THREE.Color("#ffffff") },
    uGuide: { value: new THREE.Color("#777777") },
    uAccent: { value: new THREE.Color("#ff5f00") },
    uBg: { value: new THREE.Color("#111111") },
    // alpha of ink, guide, accent, faint
    uTone: { value: new THREE.Vector4(0.92, 0.55, 1, 0.22) },
    uFocus: { value: new THREE.Vector3() },
    uFog: { value: new THREE.Vector2(8, 30) },
  };
}

const vertexShader = /* glsl */ `
  attribute vec3 instanceStart;
  attribute vec3 instanceEnd;
  attribute vec4 aDraw;
  attribute vec4 aStyle;
  attribute vec2 aHi;
  uniform float uW;
  uniform vec2 uRes;
  uniform float uPx;
  uniform float uWidth;
  uniform float uNear;
  uniform vec3 uInk;
  uniform vec3 uGuide;
  uniform vec3 uAccent;
  uniform vec4 uTone;
  uniform vec3 uFocus;
  uniform vec2 uFog;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRun;
  varying float vIsRun;

  void main() {
    float pin = clamp((uW - aDraw.x) / aDraw.y, 0.0, 1.0);
    float pout = clamp((uW - aDraw.z) / aDraw.w, 0.0, 1.0);
    float fa = pout;
    float fb = max(pin, pout);
    vec3 a = mix(instanceStart, instanceEnd, fa);
    vec3 b = mix(instanceStart, instanceEnd, fb);
    float vis = step(0.0005, fb - fa);

    vec4 sa = modelViewMatrix * vec4(a, 1.0);
    vec4 sb = modelViewMatrix * vec4(b, 1.0);
    // keep in front of the camera
    float nz = -uNear;
    if (sa.z > nz && sb.z > nz) vis = 0.0;
    else if (sa.z > nz) sa.xyz = mix(sa.xyz, sb.xyz, (sa.z - nz) / (sa.z - sb.z));
    else if (sb.z > nz) sb.xyz = mix(sb.xyz, sa.xyz, (sb.z - nz) / (sb.z - sa.z));

    vec4 ca = projectionMatrix * sa;
    vec4 cb = projectionMatrix * sb;
    float aspect = uRes.x / uRes.y;
    vec2 dir = (cb.xy / cb.w - ca.xy / ca.w) * vec2(aspect, 1.0);
    float dl = length(dir);
    dir = dl > 1e-6 ? dir / dl : vec2(1.0, 0.0);
    vec2 off = vec2(dir.y, -dir.x);
    if (position.x < 0.0) off = -off;
    if (position.y < 0.0) off -= dir;
    else if (position.y > 1.0) off += dir;
    off.x /= aspect;
    off *= (aStyle.y * uPx * uWidth) / uRes.y;
    vec4 clip = position.y < 0.5 ? ca : cb;
    clip.xy += off * clip.w;
    gl_Position = vis > 0.5 ? clip : vec4(2.0, 2.0, 2.0, 1.0);

    int tone = int(aStyle.x + 0.5);
    vec3 col = tone == 0 ? uInk : (tone == 2 ? uAccent : uGuide);
    float al = tone == 0 ? uTone.x : (tone == 1 ? uTone.y : (tone == 2 ? uTone.z : uTone.w));
    float lit = step(aHi.x, uW) * (1.0 - step(aHi.y, uW));
    vColor = mix(col, uAccent, lit);
    al = mix(al, 1.0, lit);
    vec3 wp = (modelMatrix * vec4(position.y < 0.5 ? a : b, 1.0)).xyz;
    float fog = smoothstep(uFog.x, uFog.y, distance(wp, uFocus));
    vAlpha = al * (1.0 - fog);
    vIsRun = step(0.0001, aStyle.w);
    vRun = aStyle.z + aStyle.w * (position.y < 0.5 ? fa : fb);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRun;
  varying float vIsRun;

  void main() {
    float a = vAlpha * uOpacity;
    // a running signal: one short bright stretch travelling round its loop
    if (vIsRun > 0.5) {
      float f = fract(vRun - uTime * 0.28);
      a *= smoothstep(0.0, 0.02, f) * (1.0 - smoothstep(0.07, 0.1, f));
    }
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

export function linesMaterial(shared, { opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: opacity } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
}
