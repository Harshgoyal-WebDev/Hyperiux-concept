import * as THREE from "three";
import { sandNoise } from "./forgeAsset";
import { T } from "../tuning";

// The broken rock's flight, and what it turns into. Every stage has its own
// start and end in the panel (shares of a piece's own breakup progress,
// which runs with the breakup: the pieces only come loose a beat apart).
//
// pieceFlight: the breakup is an impact — every excess piece is blasted off
// at once (by T.breakBlastEnd), out to its own place on one of the sand
// streams' loops, but far out (T.breakSpread × the loop), shrinking as it
// breaks and tumbling hard. From then on it rides round with its stream —
// the same clock, the same loop, just wider — spiralling in towards it
// (T.breakGather of the way, over T.breakGatherStart → End) while it grinds
// away into sand and gravel (T.breakGrindStart → End). The streams run on
// one shared clock that picks up speed (Forge keeps it).
//
// The streams (T.streams of them): like gusts of wind carrying sand round
// the mark, each a dense head trailing a tail that thins and widens behind
// it (T.streamTail of a turn, T.streamWidth), sweeping round on its own
// path — a loop round the mark that tilts and turns as it goes (T.streamTilt,
// T.streamWobble), swelling in and out and rising and falling on the way
// (T.streamHeight) — so they pass in front of the mark and behind it,
// crossing each other; a share of the grains (T.streamLoose) drift loose
// all round. The same path in GLSL (STREAM_GLSL) and JS (streamPath).
//
// The sand and gravel: bits sampled once over every piece's surface. Each
// sits on its piece (spinning with it) until the piece has worn away to it
// in the shared sand pattern (exactly where the stone shader wears the
// stone away); then (over T.breakSandFlow) it is flung off into its piece's
// stream: it starts exactly where it left its rock, in the same turning
// frame (so rock and grains move as one), then spirals in from the rock's
// wider loop to the stream's own and spreads back along its tail, and keeps
// flowing round the Hyperiux mark. A function of each piece's own progress, so scrolling back
// gathers it back into the stone. Shared by the sand (CrumbleSand) and the
// gravel (Gravel).
//
// The pointer stirs them: a field over the screen (BreakupStir brushes it
// along the pointer's path) pushes each grain in the screen's plane — along
// the pointer's motion and parted from its line — and lights it white-hot;
// as the field relaxes the grains ease back into their streams.

const DEG = Math.PI / 180;
const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 5);
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, Math.max(b, a + 1e-3));

// The streams' shared uniforms (Forge writes the panel's values in each
// frame; the sand and gravel read them by reference).
export const FLOW_UNIFORMS = {
  uFlowTime: { value: 0 }, // the streams' own time (their paths drift with it)
  uBreakAngle: { value: 0 }, // how far round the streams have come (the shared clock)
  uStreams: { value: 3 },
  uStreamRadius: { value: 30 },
  uStreamTilt: { value: 0 },
  uStreamWobble: { value: 0.35 },
  uStreamHeight: { value: 4 },
  uStreamTail: { value: 0.45 },
  uStreamWidth: { value: 6 },
  uStreamLoose: { value: 0.15 },
  uGrind: { value: new THREE.Vector3(0.4, 0.84, 0.16) }, // grind start, end, sand flow
};
export function syncFlow(dt, f) {
  const u = FLOW_UNIFORMS;
  u.uFlowTime.value += dt;
  // drifting through the blast, the spin takes hold and races up to speed
  // (T.breakSpinStart → End of the breakup), and keeps on going
  if (f <= 0) u.uBreakAngle.value = 0;
  else u.uBreakAngle.value += dt * T.breakSpin * (0.12 + 2.5 * smooth(f, T.breakSpinStart, T.breakSpinEnd));
  u.uStreams.value = Math.min(Math.max(Math.round(T.streams), 1), 8);
  u.uStreamRadius.value = T.streamRadius;
  u.uStreamTilt.value = T.streamTilt * DEG;
  u.uStreamWobble.value = T.streamWobble * DEG;
  u.uStreamHeight.value = T.streamHeight;
  u.uStreamTail.value = T.streamTail;
  u.uStreamWidth.value = T.streamWidth;
  u.uStreamLoose.value = T.streamLoose;
  u.uGrind.value.set(T.breakGrindStart, Math.max(T.breakGrindEnd, T.breakGrindStart + 0.01), Math.max(T.breakSandFlow, 0.01));
}

export const STREAM_GLSL = /* glsl */ `
uniform float uFlowTime;
uniform float uBreakAngle;
uniform float uStreams;
uniform float uStreamRadius;
uniform float uStreamTilt;
uniform float uStreamWobble;
uniform float uStreamHeight;
uniform float uStreamTail;
uniform float uStreamWidth;
uniform float uStreamLoose;
uniform vec3 uGrind;
// stream j's head, as an angle round its loop
float streamHead(float j) { return uBreakAngle * (1.0 + 0.12 * j) + j * 2.4; }
// a point on stream j's path at angle phi (from the mark)
vec3 streamPath(float j, float phi) {
  float t = uFlowTime;
  float n = max(uStreams, 1.0);
  float tilt = uStreamTilt + sin(t * 0.19 + j * 2.3) * uStreamWobble;
  float turn = (j - (n - 1.0) * 0.5) * 0.55 + sin(t * 0.13 + j * 1.7) * uStreamWobble * 0.6;
  float r = uStreamRadius * (0.8 + 0.3 * sin(phi * 2.0 + j * 1.9 + t * 0.27));
  // (a loop wider than it is deep, so it sweeps across the frame)
  vec3 p = vec3(cos(phi) * r * 1.35, sin(phi * 3.0 + j * 2.0 + t * 0.4) * uStreamHeight, sin(phi) * r);
  float c = cos(tilt), s = sin(tilt);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  c = cos(turn); s = sin(turn);
  return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}
`;
const U = FLOW_UNIFORMS;
const streamHead = (j) => U.uBreakAngle.value * (1 + 0.12 * j) + j * 2.4;
function streamPath(j, phi, out) {
  const t = U.uFlowTime.value;
  const n = Math.max(U.uStreams.value, 1);
  const tilt = U.uStreamTilt.value + Math.sin(t * 0.19 + j * 2.3) * U.uStreamWobble.value;
  const turn = (j - (n - 1) * 0.5) * 0.55 + Math.sin(t * 0.13 + j * 1.7) * U.uStreamWobble.value * 0.6;
  const r = U.uStreamRadius.value * (0.8 + 0.3 * Math.sin(phi * 2 + j * 1.9 + t * 0.27));
  let x = Math.cos(phi) * r * 1.35;
  let y = Math.sin(phi * 3 + j * 2 + t * 0.4) * U.uStreamHeight.value;
  let z = Math.sin(phi) * r;
  let c = Math.cos(tilt);
  let s = Math.sin(tilt);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(turn);
  s = Math.sin(turn);
  [x, y] = [x * c - y * s, x * s + y * c];
  return out.set(x, y, z);
}

const rest = new THREE.Vector3();
const onStream = new THREE.Vector3();
// each piece's place: where the blast throws it (from the mark), its stream
// and how far back along it it rides
function placeOf(forge, c) {
  const n = U.uStreams.value;
  const key = `${n}|${T.breakSpread}|${T.streamWidth}|${T.streamTail}`;
  if (c.place?.key === key) return c.place;
  // how much wider than its stream's loop the blast throws it
  const spread = Math.max(T.breakSpread * (0.75 + 0.5 * c.seed), 0.2);
  const j = c.index % n;
  // strung along the front half of its stream, a little off its line
  const rank = Math.floor(c.index / n);
  const mates = Math.ceil((forge.chunks.length - j) / n);
  const lag = (rank / Math.max(mates, 1)) * T.streamTail * 0.8;
  const off = c.axis.clone().multiplyScalar(T.streamWidth * 0.3 * c.seed);
  c.place = { key, spread, j, lag, off };
  return c.place;
}

// One piece at its own progress u: its world position into out.position,
// its turn and size into out.quaternion / out.scale (the mesh's asset space
// is the caller's); returns how far it has ground away into sand (0..1).
// Its stream, place on it and size go to forge.pieceStream for the sand.
export function pieceFlight(forge, c, u, out) {
  const L = forge.world.logo;
  const { spread, j, lag, off } = placeOf(forge, c);
  rest.copy(c.rest).multiplyScalar(forge.scale).add(forge.object.position);
  if (u <= 0) {
    out.position.copy(rest);
    out.quaternion.identity();
    out.scale.setScalar(1);
    forge.pieceStream[c.index].set(j, lag, 1, spread);
    return 0;
  }
  const b = ease(u / Math.max(T.breakBlastEnd, 0.01));
  const size = 1 + (T.breakShrink - 1) * b;
  // its loop's width now: thrown far out, spiralling in towards its stream
  const wide = spread + (1 - spread) * smooth(u, T.breakGatherStart, T.breakGatherEnd) * T.breakGather;
  forge.pieceStream[c.index].set(j, lag, size, wide);
  out.scale.setScalar(size);
  // its place on its stream's loop, that much wider, riding round with it
  streamPath(j, streamHead(j) - lag * Math.PI * 2, onStream).multiplyScalar(wide).add(off).add(L);
  // (the blast throws it there from the slab)
  out.position.lerpVectors(rest, onStream, b);
  out.quaternion.setFromAxisAngle(c.axis, c.spin * (5 * b + U.uBreakAngle.value * 2 * T.breakTumble) * Math.max(T.breakTumble, 0.2));
  return THREE.MathUtils.clamp((u - T.breakGrindStart) / Math.max(T.breakGrindEnd - T.breakGrindStart, 0.01), 0, 1);
}

// count points, area-weighted over every piece's triangles, in the piece's
// own (pivot-relative) space: { local, piece, threshold }
export function samplePieceSurfaces(forge, count, rng) {
  const tris = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  forge.chunks.forEach((piece) => {
    const g = piece.mesh.geometry;
    const pos = g.attributes.position;
    const index = g.index;
    const n = index ? index.count : pos.count;
    for (let k = 0; k < n; k += 3) {
      a.fromBufferAttribute(pos, index ? index.getX(k) : k);
      b.fromBufferAttribute(pos, index ? index.getX(k + 1) : k + 1);
      c.fromBufferAttribute(pos, index ? index.getX(k + 2) : k + 2);
      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
      if (area > 1e-6) tris.push({ piece, a: a.clone(), b: b.clone(), c: c.clone(), area });
    }
  });
  const cumulative = new Float64Array(tris.length);
  let total = 0;
  tris.forEach((t, i) => (cumulative[i] = total += t.area));

  const local = new Float32Array(count * 3);
  const piece = new Float32Array(count);
  const threshold = new Float32Array(count);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // binary search the cumulative areas
    const r = rng() * total;
    let lo = 0;
    let hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const t = tris[lo];
    let u = rng();
    let v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    p.copy(t.a).addScaledVector(ab.subVectors(t.b, t.a), u).addScaledVector(ac.subVectors(t.c, t.a), v);
    local.set([p.x, p.y, p.z], i * 3);
    piece[i] = t.piece.index;
    // its threshold in the shared sand pattern, at its rest position
    const rest = t.piece.rest;
    threshold[i] = sandNoise(p.x + rest.x, p.y + rest.y, p.z + rest.z);
  }
  return { local, piece, threshold };
}

// A direction to puff out in as it comes off: mostly out of the face and up.
export function puffDirection(rng, out) {
  return out.set(rng() - 0.5, rng() * 0.7, 0.35 + rng() * 0.65).normalize();
}

// The pointer's stir over the screen (BreakupStir keeps it).
export const STIR_UNIFORMS = {
  uStir: { value: null },
  uStirOn: { value: 0 },
  uStirGlow: { value: 0 },
  uStirSpread: { value: 0.3 },
};

// Uniforms the flow reads (by reference: the forge updates them in place).
export function breakupUniforms(forge, shared) {
  return {
    uPiece: { value: forge.swirlSource },
    uPieceQ: { value: forge.pieceQuat },
    uPieceU: { value: forge.pieceProgress },
    uPieceStream: { value: forge.pieceStream },
    ...FLOW_UNIFORMS,
    ...STIR_UNIFORMS,
    uStirAmount: { value: 1 }, // (each layer's own)
    uS: { value: forge.scale },
    uCenter: { value: forge.world.logo.clone() },
    uTime: shared.uTime,
  };
}

// GLSL: breakupFlow(piece, local, threshold, drift, out pos) → how far along
// its flow into its stream it is (0..1), or -1 while it is still stone.
export const breakupGLSL = (pieces) => /* glsl */ `
uniform vec3 uCenter; // the mark
uniform float uTime;
${STREAM_GLSL}
uniform vec4 uPiece[${pieces}]; // world position + erosion
uniform vec4 uPieceQ[${pieces}]; // orientation
uniform vec4 uPieceU[${Math.ceil(pieces / 4)}]; // each piece's own progress, four to a vec4
uniform vec4 uPieceStream[${pieces}]; // its stream, how far back along it, its size, how much wider than the stream its loop is
uniform float uS; // asset → world scale
uniform sampler2D uStir; // the pointer's stir over the screen: push (screen uv) in rg, heat in b
uniform float uStirOn;
uniform float uStirAmount; // how much this layer (sand / gravel) is stirred
uniform float uStirGlow; // how much a stirred grain lights up
uniform float uStirSpread; // how unevenly the grains are pushed (0 = all alike)
// a grain at p, stirred: pushed in the screen's plane by the field where it
// is on screen (a little more or less for each, so it parts like a fluid);
// heat: how hot the stir leaves it (0..1)
vec3 breakupStir(vec3 p, float seed, out float heat) {
  heat = 0.0;
  if (uStirOn < 0.5) return p;
  vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (clip.w <= 0.0) return p;
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return p;
  vec4 f = texture2D(uStir, uv);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float worldH = 2.0 * clip.w / projectionMatrix[1][1]; // metres per screen height there
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  heat = f.b * uStirGlow;
  return p + (right * f.r * aspect + up * f.g) * worldH * uStirAmount * (1.0 - uStirSpread + 2.0 * uStirSpread * fract(seed * 23.17));
}
vec3 bkRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
float bkProgress(int i) {
  vec4 q = uPieceU[i / 4];
  int k = i - (i / 4) * 4;
  return k == 0 ? q.x : k == 1 ? q.y : k == 2 ? q.z : q.w;
}
float breakupFlow(int i, vec3 local, float threshold, vec4 drift, out vec3 pos) {
  float u = bkProgress(i);
  float released = uGrind.x + threshold * (uGrind.y - uGrind.x);
  if (u < released) {
    pos = vec3(0.0);
    return -1.0;
  }
  float g = clamp((u - released) / uGrind.z, 0.0, 1.0);
  float e = g * g * g * (g * (g * 6.0 - 15.0) + 10.0);
  vec4 PS = uPieceStream[i];
  vec3 from = uPiece[i].xyz + bkRot(uPieceQ[i], local) * uS * PS.z;
  // its own place in its piece's stream: somewhere back along the tail
  // (denser near the head), off the line by more the further back it is
  float back = pow(fract(drift.w * 3.71 + threshold), 1.4);
  vec3 o = (fract(vec3(drift.w * 17.3, drift.w * 31.7 + threshold, drift.w * 53.1)) - 0.5) * 2.0;
  float w = uStreamWidth * (0.15 + 1.2 * back);
  // in its rock's turning frame: from the rock's place on its (wider) loop,
  // spiralling in to the stream's own loop and back along the tail
  float lag = mix(PS.y, back * uStreamTail, e);
  float phi = streamHead(PS.x) - lag * 6.2832;
  float wide = mix(PS.w, 1.0, e);
  // a share drift loose, all round
  if (fract(drift.w * 91.7) < uStreamLoose) {
    phi = mix(phi, streamHead(PS.x) * 0.35 + drift.w * 31.4, e);
    w *= mix(1.0, 3.5, e);
  }
  vec3 onLoop = uCenter + streamPath(PS.x, phi) * wide + o * w * e;
  // (where its rock sits on that loop, so it leaves the rock as one with it)
  vec3 rockOnLoop = uCenter + streamPath(PS.x, streamHead(PS.x) - PS.y * 6.2832) * PS.w;
  // flung off with a little puff that settles as it finds its place
  vec3 puff = drift.xyz * (1.0 + 2.0 * drift.w) * sin(3.14159 * min(g * 2.0, 1.0));
  pos = from + (onLoop - rockOnLoop) + puff;
  return g;
}
`;
