// Every value the contact page's scene reads, live: the Leva panel
// (TuningPanel.jsx, ?leva in the address) writes straight into this object.
// Values marked (rebuild) re-make the particles when changed.
import { A } from "@/components/HyperiuxAbout/tuning";

export const REBUILD_EVENT = "contact-touch:rebuild";
// (day ↔ night: the header's switch and the panel's, kept in step)
export const NIGHT_EVENT = "contact-touch:night";
export function setNight(on) {
  C.night = !!on;
  window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: C.night }));
}

export const C = {
  // ---- the hands' model (public/human_hand.glb): its pose
  armLength: 2.6, // the forearms drawn out longer (×), so they run off the screen's edge (rebuild)
  extend: 1, // the index straightened out to point (0: relaxed, as the others) (rebuild)
  leftWristBend: 0, // the hand bent at the wrist (rad; + towards the palm) (rebuild)
  rightWristBend: -0.62,

  // ---- the touch: where on the screen the fingertips meet, and how far off
  touchX: 0, // (−1 left … 1 right)
  touchY: 0, // (−1 bottom … 1 top)
  touchDepth: 32, // m in front of the camera

  // ---- the left hand: light streaks, in from the bottom left
  leftWristX: -2.5, // where its arm comes from, off screen (ndc) — its size: the arm reaches there
  leftWristY: -1.9,
  leftBack: -20, // ...how much farther back than the touch (m)
  leftAimYaw: 32, // the way its index points, turned left / right (degrees)
  leftAimPitch: 0, // ...and up / down
  leftRoll: 0, // turned about its own pointing finger (degrees)
  leftSize: 0.87, // × the size that brings its arm in from that corner
  threadCount: 2050, // the threads of light over it (rebuild)
  threadLength: 160, // ...how many steps each runs (rebuild)
  threadStep: 0.01, // ...each step (share of the hand's length) (rebuild)
  threadFollow: 0.38, // ...how closely they follow the hand's lines (its fingers' bones), not wandering (rebuild)
  streakWidth: 2.25, // the threads' width (px)
  streakSpeed: 0.22, // the light running along them (runs a second)
  pulseLength: 0.05, // ...each run of light (share of a thread's length setting)
  pulseBright: 3, // ...how much brighter it is than the thread (0: an even light)
  streakBright: 0.75,
  streakColor: "#ff8952",
  streakHot: "#ff6500", // ...towards the fingertip

  // ---- the right hand: golden sand, down from the top right towards us
  rightWristX: 0.49,
  rightWristY: 1.18,
  rightBack: 7.5,
  rightAimYaw: 1.5,
  rightAimPitch: 0,
  rightRoll: 0,
  rightSize: 1.3,
  sandCount: 90000, // (rebuild)
  sandSize: 3.35, // grain size (px at the touch's distance)
  sandBright: 3.65,
  sandColor: "#ffeb85",
  sandColor2: "#be8400", // (grains vary between the two)
  sandSparkle: 0.45, // grains catching the light
  sandDrift: 0.004, // share of grains streaming off it, falling
  sandFall: 0.25, // ...how far they fall (× the hand's reach)
  sandJitter: 0, // how much the grains shimmer in place (share of the hand's)

  // ---- depth: the near side of each hand clear, the far side faint, the edges
  // lit as an outline (so the hand and its fingers read)
  occlude: true, // the hand's near surface hides its particles behind it
  occluderInset: 0.006, // ...how far inside the surface it sits (share of the hand's length: more lets the surface's own particles through cleanly)
  backFade: 0.12, // how much of the far side shows (0 none … 1 all)
  outline: 1.2, // how bright the edges are

  // ---- the touch's light
  preTouch: 0.2, // the hands' glow (their edges' light, the runs along the threads) before they touch (× the set glow)
  touchGlow: 1.6, // ...and once they have touched (×)
  glowColor: "#ff6a1a",
  glowWidth: 0.07, // the band running back over the hands (share of the reach)
  glowBright: 1,
  flashSize: 0.16, // the flash where they meet (share of the reach)
  cutDelay: 0.04, // the change to the contact section: how long after the touch it starts (share of the scroll) — the glow still running over the hands
  cutLength: 0.3, // ...how long it takes to open right across (share of the scroll)

  // ---- day or night (the V3 world's own night: the moon, a blue haze)
  night: false,

  // ---- the camera
  parallax: 0.12, // × the about hero's pointer parallax

  // ---- the transition onto the contact section (the about page's, by default)
  transDir: A.transDir, // 0 up, 1 down, 2 from the centre, 3 diagonal, 4 from the left, 5 from the right, 6 from the edges, 7 random
  transCellPx: A.transCellPx,
  transSpread: A.transSpread,
  transJitter: A.transJitter,
  transOvershoot: A.transOvershoot,
  transRefract: A.transRefract,
  transWobble: A.transWobble,
  transBulge: A.transBulge,

  // ---- the look (the about hero's)
  bloomIntensity: A.bloomIntensity,
  bloomThreshold: A.bloomThreshold,
  vignette: A.vignette,
};
