import gsap from "gsap";
import { T } from "./tuning";
import { CUT_FROM, CUT_TO, OPENING_NOMINAL as O, P, SCROLL_VH, afterAt, eventAt, zoneAt } from "./config";

// Plain mutable state the master timeline writes and the 3D scene reads in
// useFrame. Values here are the State 01 (monolith) pose.
export function createJourneyState() {
  return {
    progress: 0, // scroll fraction p of the pinned hero (the master timeline's progress)
    // camera (world metres / degrees)
    camX: 0,
    camY: 7,
    camZ: 155,
    tgtX: 0,
    tgtY: 26.9,
    tgtZ: 0,
    fov: 45.9,
    orbit: 1, // how much of the cursor's pull moves the camera rather than only turning it (world/magnet.js)
    // energy
    intro: 0, // 1 skips the beam's load-in race (review frames)
    enterAt: 0, // when the visitor entered (s, page clock): the beam's race starts from it (Infinity while the loader is up)
    reveal: 0, // the loader opening over the scene (0..1, as Loader.jsx draws it; 0 when there is no loader)
    arrive: 1, // the camera's arrival from far off as the visitor enters (0 → 1; the loader sets it going)
    forgeReady: false, // set by Scene once the forge is built (or found missing)
    warmup: 4, // frames the oasis draws in full at the start, so its materials compile behind the loader
    sceneVersion: 0, // bumped when something that casts shadows arrives (the shadows are redrawn)
    beam: 0, // the beam's travel along its whole path, from the hero to the core
    beamSparks: 0, // particles running along the line while it travels
    beamFade: 0, // the line on the stone goes as the stone breaks away
    sphere: 0.3, // the core's glow (ember → blazing)
    pulse: 0, // the flash as the beam merges into the core
    spineGlow: 0, // the Spine crack, foot → core, lit first (its climb is J.beam 0.5 → 1)
    crackSpread: 0, // glow growing out from the core through the slab's cracks
    crackGlow: 0, // brightness of the lit cracks on the excess rock
    logoCrackGlow: 0, // ...on the logo core (they stay lit)
    crack: 0, // activation level (sound)
    eventT: 0, // the forging event's own clock (0 at the core → 1 forged)
    fracture: 0, // breakup of the excess rock (0..1; see deriveBreak)
    breakBurst: 0, // its impact: the burst of energy as the rock blasts off (0..1, dying away)
    orbitSpeed: 0, // pace of the swirl's sound once the rock breaks (0 → cruising)
    // through the mark, on into the oasis
    align: 0, // shots corrected onto the real opening (see CameraRig)
    beamVis: 1, // the beam into the core (stays lit: the beam runs on out of the core past the mark)
    duneBeam: 0, // the beam running on out of the core ahead of the camera, past the mark
    innerGlow: 0, // the forged mark's cube outline lit from within (the light in its openings)
    logoTilt: 0, // how much the forged mark turns towards the cursor (scene/Forge.jsx)
    cut: 0, // the glass-tile transition from the logo to the valley (0..1; scene/CutTransition.js)
    revealR: 0, // the oasis rising out of the desert: radius its front has spread to (m)
    amber: 0, // the tree's amber glow, first seen beyond the dunes
    treeGlow: 0, // its aura, the light in its roots and trunk
    converge: 0, // the beam running on into the tree's core (0..1)
    treeFillFrom: 0, // set by Streaks: the p at which the beam first touches a root (the tree's light climbs from there)
    beamInTree: 0, // set by Streaks: how far the beam has run from a root's tip up into the core (0..1)
    fill: 0, // how far up the tree of light its glow has climbed (its flow: 0.5 the trunk's foot, 1 the crown's tips)
    corePulse: 0, // (no flash as they meet: kept at 0)
    outro: 0, // the light opening onto the site at the end (1 = all light)
    shock: 0, // shockwave across the dunes as the beam merges into the core (0 → spent)
    jolt: 0, // the camera's jolt at that impact
    edgeFx: 0, // motion blur + chromatic aberration at the frame's edges, through the event
    // world
    dust: 1,
    bloom: 1,
    vignette: 0.6,
  };
}

// Adds an explicit from→to segment for one channel. fromTo with
// immediateRender:false keeps every segment independent, so scrubbing
// backwards replays exactly the same values.
function seg(tl, target, key, from, to, start, end, ease = "none") {
  tl.fromTo(target, { [key]: from }, { [key]: to, duration: end - start, ease, immediateRender: false }, start);
}

// Channel → list of [time, value] stops with an ease per span.
function track(tl, target, key, stops, ease = "sine.inOut") {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, v0] = stops[i];
    const [t1, v1, e] = stops[i + 1];
    seg(tl, target, key, v0, v1, t0, t1, e || ease);
  }
}

// Camera stops: [p, position, target, fov, ease into this stop]. The low
// sand-dune hero, a slow push in while the beam travels and climbs, then one
// still, square-on shot of the whole slab for the entire forging event;
// after the reveal it eases into the forged hero. (From the first scroll to
// the core it is one uninterrupted dolly: no stop on the way.) Then a slow
// advance on the cube outline's opening (O), straight through it — level,
// along its centre, gathering pace — and on out of it without a pause, over
// the open dunes beyond.
const EVENT_SHOT = [[0, 28, 114], [0, 28.5, 0], 45];
// One continuous move: gathers pace over the first stretch, holds it, and
// eases off into the next stop (a trapezoid speed profile — the speed never
// drops back to zero on the way, so there is no stop-and-go).
const glide = (rise, settle) => {
  const v = 1 / (1 - rise / 2 - settle / 2);
  return (x) =>
    x < rise ? (v * x * x) / (2 * rise) : x <= 1 - settle ? v * (x - rise / 2) : 1 - (v * (1 - x) * (1 - x)) / (2 * settle);
};
// Where the broken rock has ground away into sand (the impact spent, the
// pieces thrown out and worn to grains): the end of the auto-scrolled part
// of the forging event (ForgingConcept), and where the camera sets off for
// the logo — so the visitor's own scroll moves it straight away.
export function brokenAt() {
  const end = Math.max(T.breakEnd, T.breakStart + 0.02);
  return eventAt(T.breakStart + Math.max(T.breakBurstEnd, T.breakBlastEnd, T.breakGrindEnd) * (end - T.breakStart));
}

// the run at the opening: under way from the first scroll (a steady share),
// gathering pace into the opening
const runIn = (x) => 0.4 * x + 0.6 * (1 - Math.cos((x * Math.PI) / 2));
// ...and how fast it arrives there, × its mean pace (runIn's slope at 1): the
// camera carries on into the oasis at that speed (world/oasisCamera.js)
export const RUN_ARRIVAL = 0.4 + 0.6 * (Math.PI / 2);

const shots = () => [
  [0, [0, 7, 155], [0, 26.9, 0], 45.9], // 01 the sand-dune hero: low, square on, sun to the right
  // 02–03 from the first scroll, one uninterrupted rise and push in to the
  // still shot as the beam reaches the core
  [P.core, ...EVENT_SHOT, glide(0.08, Math.min(Math.max(T.cameraSettle, 0.01), 0.6))],
  [Math.min(brokenAt(), P.forged), ...EVENT_SHOT], // 04–06 still, through the impact and the grinding
  // 07–13: as soon as the rock has ground to sand (the visitor scrolling
  // again), one straight run at the cube outline's opening — no swing, no
  // stop — gathering pace into it and on through
  [P.through, [O.x, O.y, 0.3], [O.x, O.y - 0.6, -40], 44, runIn],
  // 13– on into the oasis: one continuous move from the scroll
  // (world/oasisCamera.js), taken over by the CameraRig
];

// The breakup, from the event's clock and the breakup controls (T.breakStart
// / T.breakEnd: shares of the event), so it can be retimed live: the excess
// rock breaks away, the line on the stone goes with it, and the swirl it
// turns into picks up speed. Called after every timeline update.
const sineOut = (x) => Math.sin((Math.min(Math.max(x, 0), 1) * Math.PI) / 2);
// The breakup's timing, set in the panel as vh of scroll after the core
// (T.seq*), into the shares the breakup runs on (T.breakStart … T.breakSandFlow).
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
export function syncSequence() {
  const E = SCROLL_VH.event;
  const a = Math.min(Math.max(T.seqBreak, 0), E - 4);
  const b = Math.min(Math.max(T.seqBreakEnd, a + 4), E);
  const share = (vh) => clamp01((vh - a) / (b - a));
  T.breakStart = a / E;
  T.breakEnd = b / E;
  T.breakBurstEnd = Math.max(share(T.seqImpactEnd), 0.01);
  T.breakBlastEnd = Math.max(share(T.seqBlastEnd), 0.01);
  T.breakGatherStart = share(T.seqGatherStart);
  T.breakGatherEnd = Math.max(share(T.seqGatherEnd), T.breakGatherStart + 0.01);
  T.breakSpinStart = share(T.seqSpinStart);
  T.breakSpinEnd = Math.max(share(T.seqSpinEnd), T.breakSpinStart + 0.01);
  T.breakGrindStart = share(T.seqGrindStart);
  T.breakGrindEnd = Math.max(share(T.seqGrindEnd), T.breakGrindStart + 0.01);
  T.breakSandFlow = Math.min(Math.max(T.seqSandFlow / (b - a), 0.01), 1);
}
syncSequence();

export function deriveBreak(J) {
  syncSequence();
  const start = T.breakStart;
  const end = Math.max(T.breakEnd, start + 0.02);
  const t = J.eventT;
  J.fracture = Math.min(Math.max((t - start) / (end - start), 0), 1);
  J.beamFade = 1 - Math.cos((Math.min(Math.max((t - start) / 0.08, 0), 1) * Math.PI) / 2);
  J.orbitSpeed = t <= start ? 0 : 0.35 + 0.65 * sineOut((t - start) / (1 - start));
  // the impact: in at once, dissipating by T.breakBurstEnd of the breakup
  // (the rig jolts the camera, flares the bloom and smears the frame's edges with it)
  const f = J.fracture;
  J.breakBurst = f > 0 ? Math.min(f / 0.004, 1) * Math.pow(1 - Math.min(f / Math.max(T.breakBurstEnd, 0.01), 1), 2) : 0;
}

export function buildMasterTimeline(J, dom) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  seg(tl, J, "progress", 0, 1, 0, 1);
  const e = eventAt;

  // ----- camera
  const axis = (key, pick) =>
    track(
      tl,
      J,
      key,
      shots().map(([t, p, q, f, ease]) => [t, pick(p, q, f), ease])
    );
  axis("camX", (p) => p[0]);
  axis("camY", (p) => p[1]);
  axis("camZ", (p) => p[2]);
  axis("tgtX", (_p, q) => q[0]);
  axis("tgtY", (_p, q) => q[1]);
  axis("tgtZ", (_p, q) => q[2]);
  axis("fov", (_p, _q, f) => f);
  // The cursor's pull swings the camera round what it looks at
  // (world/magnet.js) all the way — except through the cube's opening,
  // which is only ±1.4 m clear: there it only turns the camera, in place
  track(tl, J, "orbit", [
    [0, 1],
    [P.held, 1],
    [P.held + (P.pass - P.held) * 0.5, 0, "sine.inOut"],
    [CUT_TO(), 0],
    [CUT_TO() + 0.004, 1, "sine.inOut"],
  ]);
  // (back off once clear of the slab: the flight's shots are its own)
  track(tl, J, "align", [
    [P.forged, 0],
    [P.held, 1],
    [P.through, 1],
    [P.out, 0],
  ]);

  // ----- 02–03: the beam runs along the sand into the slab's foot, then
  // the energy climbs the Spine crack inside the stone up to the core
  // (scene/ForgeBeam.jsx: J.beam 0 → 0.5 on the sand; scene/Forge.jsx:
  // 0.5 → 1 the Spine's lit front, foot → core). From the very first scroll,
  // at one pace with it — no wait, no ease-in: the beam moves the moment the
  // page does; up the Spine a touch quicker as it nears the core.
  {
    const t0 = 0;
    // (it reaches the slab's foot T.beamFootAt of the way to the climb, so
    // its head runs on well ahead of the camera, which gathers pace towards
    // the slab; then the Spine's climb to the core)
    const foot = t0 + 0.02 + (P.climb - t0 - 0.02) * Math.min(Math.max(T.beamFootAt, 0.05), 1);
    track(tl, J, "beam", [
      [t0, 0],
      [foot, 0.5, "none"],
      [P.core, 1, "power1.in"],
    ]);
  }
  track(tl, J, "beamSparks", [
    [P.hero * 0.5, 0],
    [P.hero, 1],
    [P.core, 1],
    [e(0.06), 0],
  ]);

  // ----- the core takes the energy and blazes
  track(tl, J, "sphere", [
    [0, 0.3],
    [P.climb, 0.4],
    [P.core, 0.9, "power2.in"],
    [e(0.06), 2.0, "power2.out"],
    [e(0.5), 2.2],
    [e(0.7), 1.7],
    // ...and goes out as the breakup finishes: nothing glows in the cube's
    // opening once the rock has broken away, nor as the camera passes it
    [e(0.95), 0, "sine.inOut"],
  ]);
  // the merge sends a shockwave and a wave of light out across the dunes,
  // jolts the camera, and the frame's edges smear and split (motion blur,
  // chromatic aberration) until the forging is done
  // (the crack glow spreads with it: same start, pace and ease)
  const SPREAD = [P.core, e(0.32), "power2.out"];
  seg(tl, J, "shock", 0, 1, ...SPREAD);
  track(tl, J, "jolt", [
    [P.core - 0.003, 0],
    [P.core + 0.002, 1, "power3.in"],
    [e(0.28), 0, "power2.out"],
  ]);
  track(tl, J, "edgeFx", [
    [P.core - 0.002, 0],
    [P.core + 0.004, 1, "power2.out"],
    [e(0.5), 0.75],
    [e(0.85), 0.55],
    [P.forged, 0],
  ]);
  track(tl, J, "pulse", [
    [P.core - 0.004, 0],
    [P.core + 0.004, 1, "power3.in"],
    [e(0.12), 0, "power2.out"],
  ]);

  // ----- 04–05: the glow grows through the cracks from the core to the
  // edges, together with the shockwave across the dunes
  seg(tl, J, "crackSpread", 0, 1, ...SPREAD);
  // the excess rock's cracks cool as it falls, to a dull ember on the sand
  track(tl, J, "crackGlow", [
    [P.core, 0],
    [e(0.04), 1, "power2.out"],
    [e(0.5), 1.15],
    [e(0.8), 0.6],
    [P.forged, 0.2],
  ]);
  // the Spine lights as the beam goes into the slab's foot, stays lit while
  // its front climbs to the core, then cools with the rest of the excess
  // rock's cracks (most of it is on chunks that break away)
  track(tl, J, "spineGlow", [
    [P.climb - 0.002, 0],
    [P.climb + 0.004, 1, "power2.out"],
    [P.core, 1.1],
    [e(0.5), 1.15],
    [e(0.8), 0.6],
    [P.forged, 0.2],
  ]);
  // the logo's cracks and outline stay lit once it is forged
  track(tl, J, "logoCrackGlow", [
    [P.core, 0],
    [e(0.04), 1, "power2.out"],
    [e(0.5), 1.15],
    [P.forged, 1.2],
  ]);
  track(tl, J, "crack", [
    [P.core, 0],
    [e(0.14), 0.6],
    [e(0.22), 1],
    [e(0.4), 0],
  ]);

  // ----- 06–08: as the glow fills the cracks, the excess rock breaks away
  // (from the centre out) and turns to sand and gravel; the logo core
  // remains. When, on the event's clock, is live-tunable: see deriveBreak.
  seg(tl, J, "eventT", 0, 1, P.core, P.forged, "none");

  // ----- through the mark, on into the oasis
  // The beam that brought the energy in stays lit all the way (J.beamVis
  // holds at 1), and runs on out of the back of the core as the camera
  // closes on the logo: one continuous line, into the core and out again,
  // racing on ahead of the camera into the passage.
  const approach = (k) => P.held + (P.pass - P.held) * k;
  // (out of the core and away down the valley before the cut shows it)
  seg(tl, J, "duneBeam", 0, 1, approach(0.15), approach(0.5), "sine.inOut");
  // ----- the cut: as the camera closes on the logo, the frame breaks into
  // cubes of the mark's own shape, and turns over onto the valley beyond
  // (there is no flight down: the camera is low in the dunes after it)
  // (spread over more scroll than the camera's run through it: the cut plays
  // a little slower, the two shots keep the same pace — world/oasisCamera.js)
  seg(tl, J, "cut", 0, 1, CUT_FROM(), CUT_TO(), "none");
  // the forged mark turns towards the cursor from the moment the rock starts
  // breaking off it, until the camera closes on its opening (only ±1.4 m clear)
  track(tl, J, "logoTilt", [
    [e(T.breakStart), 0],
    [e(Math.min(T.breakStart + 0.08, 0.99)), 1, "sine.out"],
    [approach(0.1), 1],
    [approach(0.4), 0, "sine.inOut"],
  ]);
  // the forged mark's cube outline lit from within: as the logo is forged
  // its openings fill with warm light, brightening as the camera closes on it
  track(tl, J, "innerGlow", [
    [Math.min(brokenAt(), P.forged) - 0.002, 0],
    [P.forged, 1, "sine.out"],
    [P.held, 1.1],
    [P.through, 1.5, "sine.in"],
  ]);
  // ----- the oasis rises out of the bare desert: a line of light sweeps out
  // from the glowing cube at the lake's heart across the whole desert, the
  // water and the green behind it (world/revealMap.js); then the beam runs
  // on into the cube, which turns out, and the Yggdrasil grows out of it —
  // roots first, then up — the camera going round it as it does
  // (scene/oasis/CoreOrb.jsx, Rivulets.jsx, Yggdrasil.jsx, world/oasisCamera.js)
  // (J.revealR is set with the scroll: world/oasisCamera.js revealRadiusAt)

  // ----- the tree: its amber glow first seen beyond the dunes, then its
  // aura and the light in its roots; the streaks run on into its core and
  // meet there in a flash
  track(tl, J, "amber", [
    [zoneAt("passage", 0.7), 0],
    [zoneAt("glow", 0.85), 1],
    [1, 1],
  ]);
  track(tl, J, "treeGlow", [
    [zoneAt("glow", 0.6), 0.25],
    [zoneAt("reveal", 0.8), 0.55],
    [zoneAt("canopy", 0.6), 0.75],
    [zoneAt("outro", 0.4), 1],
  ]);
  // the tree of light: its roots and foot glow as the beam nears, and once
  // the beam has reached the core the light climbs the trunk, the branches
  // and on into the crown
  // (nothing of it is lit — roots, trunk, branches alike — until the beam
  // has reached its core; then the light climbs it from the roots' ends up)
  // (one climb, roots to crown, from the moment the beam touches a root —
  // as the converge starts — at one steady pace with the scroll)
  // (tuning.js tlBeamToTreeStart / tlBeamToTreeEnd / tlTreeLightEnd)
  track(tl, J, "fill", [
    [T.tlBeamToTreeStart, 0],
    [Math.max(T.tlTreeLightEnd, T.tlBeamToTreeStart + 0.002), 1.0, "none"],
  ]);
  track(tl, J, "converge", [
    [T.tlBeamToTreeStart, 0],
    [Math.max(T.tlBeamToTreeEnd, T.tlBeamToTreeStart + 0.002), 1, "sine.inOut"],
  ]);

  // at the end: the light opens onto the site
  // the glass hexagons turning the scene over to the white site
  // (scene/CutTransition.jsx: its tiles have their own stagger and ease)
  seg(tl, J, "outro", 0, 1, T.tlOutroStart, Math.max(T.tlOutroEnd, T.tlOutroStart + 0.002), "none");

  track(tl, J, "dust", [
    [0, 1],
    [P.core, 0.6],
    [e(0.7), 1.4],
    [P.forged, 0.6],
    [1, 0.5],
  ]);
  track(tl, J, "bloom", [
    [0, 1],
    [P.core, 1.2],
    [e(0.5), 1.25],
    [P.forged, 1],
  ]);
  track(tl, J, "vignette", [
    [0, 0.6],
    [P.core, 0.75],
    [P.forged, 0.6],
  ]);

  // ----- DOM overlays
  if (dom.hero) {
    // (the scroll cue; the hero's words go on their own: ForgingSandDuneConcept)
    tl.fromTo(dom.hero, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.03, immediateRender: false }, 0.02);
  }

  // Pin the timeline length to exactly 1 so progress == p.
  tl.set({}, {}, 1);
  return tl;
}
