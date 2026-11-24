import * as THREE from "three";
import { STAGES } from "../timeline";

// What the scene looks like at a point of the scroll: a pure function of the
// stage progresses (timeline.js), the time (for life) and the screen's shape.
// Everything that moves reads it — the hands, the energy, the portal, the
// camera — so the whole experience is one continuous, reversible motion.
//
// The world: the point of contact C at the origin, the portal opening in the
// plane z = 0 facing the camera (which looks down −z and travels through it).

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;

export const CONTACT = new THREE.Vector3(0, 0, 0);

// (how much of the portal stage the shockwave takes to run through the hands)
const SHOCK_SPAN = 0.6;

// The hands' reach: one motion over every stage before the contact (the
// distance, the approach, the anticipation and the touch — they meet as it
// ends), each by its share of the scroll (timeline.js) — so from the
// first scroll to the touch they come together in a single sweep.
const SHARE = Object.fromEntries(STAGES.map((s) => [s.key, s.share]));
const REACH_LEN = SHARE.distance + SHARE.approach + SHARE.anticipation + SHARE.touch;
// (under way from the first scroll — they come into view at once — and
// easing out into the touch, never pausing in between)
const sweep = (x) => 1 - Math.pow(1 - clamp01(x), 2.2);

// How far back along a hand's reach (`dir`, towards the contact) its
// fingertip must be to be out of the frame: where its line leaves the view
// (the camera `dist` from the contact, looking at it down −z, with its
// vertical `fov` and `aspect`), counting the depth it gains or loses on the
// way, then a margin — its whole hand beyond the edge with it.
const ENTRY_MARGIN = 3;
function offFrame(dir, dist, fov, aspect) {
  const ty = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tx = ty * aspect;
  // (its distance from the camera grows by dir.z for each cm back along it)
  const exitAt = (lateral, t) => {
    const den = Math.abs(lateral) - dir.z * t;
    return den > 1e-3 ? (dist * t) / den : Infinity;
  };
  const e = Math.min(exitAt(dir.x, tx), exitAt(dir.y, ty));
  return (Number.isFinite(e) ? e : dist) + ENTRY_MARGIN;
}

// camera keys: [position, fov] at the end of each stage (looking at C)
const KEYS = {
  // (a little below the hands, tilted up to them: the horizon low in the frame)
  // (a wider lens: the ground spreads down the frame, the rivers winding across it)
  shot: { p: [0.4, -5.2, 42.5], fov: 44 },
};

export function createLook() {
  return {
    gap: 18, // between the fingertips (cm)
    extend: 0, // the index straightening out
    curl: 0, // the other fingers' extra curl
    energy: 0, // the light gathering at the fingertips
    flash: 0, // the moment of contact
    shock: 0, // the shockwave's run (0 → 1)
    portalT: 0, // the portal stage's progress
    spread: 0, // the hands drawn apart to the portal's edge, then out of frame
    handsFade: 1,
    travel: 0, // the camera's passage through the portal (0 → 1)
    speed: 0, // how fast it travels (streaks)
    tunnel: 0, // inside the portal
    glow: 0, // the orange light on the whole space
    chroma: 0,
    cam: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 30,
    u: new THREE.Vector3(), // the line the fingers reach along (A → B)
    dirA: new THREE.Vector3(),
    dirB: new THREE.Vector3(),
    palmA: new THREE.Vector3(),
    palmB: new THREE.Vector3(),
    tipA: new THREE.Vector3(),
    tipB: new THREE.Vector3(),
    reveal: 0,
    pointer: new THREE.Vector3(), // x, y on screen (−1..1), presence (0..1)
  };
}

const v = new THREE.Vector3();

export function choreograph(S, t, aspect, L) {
  const { distance, approach, anticipation, touch, portal } = S;
  // ---- the composition (steeper on tall screens, so both hands fit) --------
  const tall = smooth(1.25, 0.56, aspect);
  // (A reaching in from the left, a little up; B reaching down from the upper
  // right, more steeply — nearly along one line, as in The Creation of Adam)
  const theta = THREE.MathUtils.degToRad(lerp(14, 56, tall));
  const phi = THREE.MathUtils.degToRad(8);
  L.dirA.set(Math.cos(theta) * Math.cos(phi), Math.sin(theta) * Math.cos(phi), -Math.sin(phi));
  const thB = theta + THREE.MathUtils.degToRad(lerp(9, 8, tall));
  const phB = THREE.MathUtils.degToRad(13);
  L.dirB.set(-Math.cos(thB) * Math.cos(phB), -Math.sin(thB) * Math.cos(phB), Math.sin(phB));
  L.u.copy(L.dirA);
  // (both with their backs to us, knuckles up: their palms turned down and away)
  L.palmA.set(0.0, -0.76, -0.65).normalize();
  L.palmB.set(-0.08, -0.84, -0.54).normalize();

  // ---- the hands' reach: in from their own edges --------------------------
  // At the start the scene is empty: each hand waits out of frame, along its
  // own arm's line — A beyond the bottom left, B beyond the top right — and as
  // the page is scrolled they slide in along their arms and meet, in a single
  // sweep from the first scroll to the touch (no pause partway, no second
  // rush at the end); they hold the touch to the end: the page opens round it.
  const reach = (distance * SHARE.distance + approach * SHARE.approach + anticipation * SHARE.anticipation + touch * SHARE.touch) / REACH_LEN;
  const away = 1 - sweep(reach);
  const camDist = KEYS.shot.p[2] * lerp(1, 1.7, tall);
  const offA = offFrame(L.dirA, camDist, KEYS.shot.fov, aspect) * away;
  const offB = offFrame(L.dirB, camDist, KEYS.shot.fov, aspect) * away;
  L.spread = 0;
  L.gap = offA + offB;
  // (the pose held throughout: the index pointing, the others relaxed)
  L.extend = 1;
  L.curl = 0;

  // ---- the energy ----------------------------------------------------------
  // (a small glint between the fingertips from the start, gathering as they near)
  L.energy = 0.32 + Math.pow(anticipation, 1.6) * 0.45 + touch * 0.2;
  // ---- the collision: the one moment everything starts from ----------------
  // The fingertips meet as the touch stage ends; from that instant, together
  // and from the one point, the flash, the shockwave
  // through both hands and the portal opening (all on the portal stage).
  const hit = smooth(0, 0.04, portal);
  // the flash, settling to a soft glow, gone as the portal opens
  L.flash = hit * (1 - 0.7 * smooth(0.04, 0.3, portal)) * (1 - smooth(0.3, 0.7, portal));
  // the shockwave: from the fingertips back through both hands to the ends of
  // their arms, at an even, unhurried pace — over most of the portal's opening
  L.shock = clamp01(portal / SHOCK_SPAN);
  L.portalT = portal;
  L.glow = L.energy * 0.22 + L.flash * 0.45;
  L.chroma = L.flash * 0.5;

  // ---- the camera: one shot, held still — the hands only come closer --------
  // (on tall screens, further back: the hands stay in frame)
  const back = lerp(1, 1.7, tall);
  v.set(...KEYS.shot.p);
  v.z *= back;
  const fov = KEYS.shot.fov;
  L.travel = 0;
  L.speed = 0;
  L.tunnel = 0;
  L.handsFade = 1;
  L.fov = fov;
  L.cam.copy(v);
  L.target.copy(CONTACT);
  // (the meeting point a little right of and above the frame's centre)
  L.target.x -= 1.5 * (1 - tall);
  L.target.y -= 1.0;

  // ---- the fingertips' places --------------------------------------------
  // (each back along its own reach: A's from the bottom left, B's from the top right)
  L.tipA.copy(CONTACT).addScaledVector(L.dirA, -offA);
  L.tipB.copy(CONTACT).addScaledVector(L.dirB, -offB);
  // the portal: as the scroll goes on, the contact page opening through the
  // glass, out from the touch
  // (under way the instant they collide, in step with the shockwave, and
  // settling as the page comes fully open)
  L.reveal = 1 - Math.pow(1 - clamp01(portal), 2);
  return L;
}
