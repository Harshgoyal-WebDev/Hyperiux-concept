import gsap from "gsap";
import { T } from "./tuning";
import { OPENING_NOMINAL as O, P, afterAt, eventAt, sectionAt } from "./config";

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
    parallax: 1, // how much mouse parallax this shot allows
    // energy
    intro: 0, // 1 skips the beam's load-in race (review frames)
    beam: 0, // the beam's travel along its whole path, from the hero to the core
    beamSparks: 0, // particles running along the line while it travels
    beamFade: 0, // the line on the stone goes as the stone breaks away
    sphere: 0.3, // the core's glow (ember → blazing)
    pulse: 0, // the flash as the beam merges into the core
    crackSpread: 0, // glow growing out from the core through the slab's cracks
    crackGlow: 0, // brightness of the lit cracks on the excess rock
    logoCrackGlow: 0, // ...on the logo core (they stay lit)
    crack: 0, // activation level (sound)
    eventT: 0, // the forging event's own clock (0 at the core → 1 forged)
    fracture: 0, // breakup of the excess rock (0..1; see deriveBreak)
    orbitSpeed: 0, // pace of the swirl the broken rock is carried into (0 → cruising)
    swirlOpen: 0, // the swirl widens to clear the camera's way through the mark
    // the garden
    align: 0, // shots corrected onto the real opening (see CameraRig)
    beamVis: 1, // the beam goes out as the camera heads for the opening
    innerGlow: 0, // the cube outline lit from within as the camera flies into it
    flash: 0, // that light filling the frame (1 = all light: the worlds switch there)
    inGarden: false, // set by WorldSwitch: the garden is the world on screen
    gardenReady: false, // set by Garden once it is built (and compiled)
    pAppear: 0, // the particle body streams in over the pond
    shapeT: 0, // ...and what it is: 0 the swirl, 1 the mark, 2 the cube, 3 the cloud, 4 the ring
    formT: 0, // set by ParticleLogo: the form as shown (past the mark it morphs on its own clock, not the scroll's)
    portal: 0, // through the ring into the light (1 = all light, onto the site)
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
// the core it is one uninterrupted dolly: no stop on the way.) Then the garden: a slow
// advance on the cube outline's opening (O), straight through it — level,
// along its centre, speeding into the window behind the ring and on out of
// it without a pause — and down into the clearing over the pond.
const EVENT_SHOT = [[0, 28, 114], [0, 28.5, 0], 45];
// One continuous move: gathers pace over the first stretch, holds it, and
// eases off into the next stop (a trapezoid speed profile — the speed never
// drops back to zero on the way, so there is no stop-and-go).
const glide = (rise, settle) => {
  const v = 1 / (1 - rise / 2 - settle / 2);
  return (x) =>
    x < rise ? (v * x * x) / (2 * rise) : x <= 1 - settle ? v * (x - rise / 2) : 1 - (v * (1 - x) * (1 - x)) / (2 * settle);
};
const SHOTS = [
  [0, [0, 7, 155], [0, 26.9, 0], 45.9], // 01 the sand-dune hero: low, square on, sun to the right
  // 02–03 from the first scroll, one uninterrupted rise and push in to the
  // still shot as the beam reaches the core
  [P.core, ...EVENT_SHOT, glide(0.08, 0.22)],
  [P.forged, ...EVENT_SHOT], // 04–08 still
  // 09–13: from the still shot, one straight run at the cube outline's
  // opening — no swing, no stop — gathering pace into it and on through
  [P.through, [O.x, O.y, 0.3], [O.x, O.y - 0.6, -40], 44, "sine.in"],
  // 14–20 the garden: one continuous path of composed shots round the pond
  // (world/gardenCamera.js, from the scroll), taken over by the CameraRig
];

// The breakup, from the event's clock and the breakup controls (T.breakStart
// / T.breakEnd: shares of the event), so it can be retimed live: the excess
// rock breaks away, the line on the stone goes with it, and the swirl it
// turns into picks up speed. Called after every timeline update.
const sineOut = (x) => Math.sin((Math.min(Math.max(x, 0), 1) * Math.PI) / 2);
export function deriveBreak(J) {
  const start = T.breakStart;
  const end = Math.max(T.breakEnd, start + 0.02);
  const t = J.eventT;
  J.fracture = Math.min(Math.max((t - start) / (end - start), 0), 1);
  J.beamFade = 1 - Math.cos((Math.min(Math.max((t - start) / 0.08, 0), 1) * Math.PI) / 2);
  J.orbitSpeed = t <= start ? 0 : 0.35 + 0.65 * sineOut((t - start) / (1 - start));
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
      SHOTS.map(([t, p, q, f, ease]) => [t, pick(p, q, f), ease])
    );
  axis("camX", (p) => p[0]);
  axis("camY", (p) => p[1]);
  axis("camZ", (p) => p[2]);
  axis("tgtX", (_p, q) => q[0]);
  axis("tgtY", (_p, q) => q[1]);
  axis("tgtZ", (_p, q) => q[2]);
  axis("fov", (_p, _q, f) => f);
  // The shot holds its position through the event, but the cursor still
  // moves it a little (parallax), during the cracking, the breakup and after.
  // ...and none at all through the opening (it is only ±1.4 m clear)
  track(tl, J, "parallax", [
    [0, 1],
    [P.climb, 0.7],
    [P.core, 0.6],
    [afterAt(0.4), 0.7],
    [P.held, 0.7],
    [P.held + (P.pass - P.held) * 0.6, 0.15],
    [P.pass, 0],
    [P.out, 0],
    [P.formed, 0.45],
    [sectionAt("portal", 0.2), 0.45],
    [sectionAt("portal", 0.6), 0],
  ]);
  // (back off under the light: the garden's shots are its own)
  track(tl, J, "align", [
    [P.forged, 0],
    [P.held, 1],
    [P.through, 1],
    [P.out, 0],
  ]);

  // ----- 02–03: the beam runs along the sand, then climbs into the core
  // One continuous travel at a steady pace (by distance along the path) all
  // the way into the core, after a short ease-in whose end speed matches
  // that pace, so the beam never slows or stalls on the way.
  {
    const t0 = P.hero * 0.6;
    const d1 = 0.015; // the ease-in
    const d2 = P.core - t0 - d1;
    const k = (2 * d1) / (Math.PI * d2);
    const x1 = k / (1 + k); // distance covered by the ease-in (sine.in ends at π/2 × its mean speed)
    seg(tl, J, "beam", 0, x1, t0, t0 + d1, "sine.in");
    seg(tl, J, "beam", x1, 1, t0 + d1, P.core, "none");
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
    [P.forged, 1.5],
    // the core keeps the blaze it took from the beam, and builds again as
    // the camera flies into it on the way to the garden
    [P.held, 1.6],
    [P.pass, 2.2],
    [P.through, 2.8, "sine.in"],
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

  // ----- the garden: through the mark into daylight
  const approach = (k) => P.held + (P.pass - P.held) * k;
  seg(tl, J, "beamVis", 1, 0, approach(0.1), approach(0.6), "sine.inOut");
  seg(tl, J, "swirlOpen", 0, 1, approach(0.15), approach(0.75), "sine.inOut");
  // the cube's inner faces light up, the camera flies into the glow, the
  // light fills the frame — the garden is switched in under it — and the
  // light fades away to the garden
  track(tl, J, "innerGlow", [
    [approach(0.3), 0],
    [P.pass, 1.2, "sine.in"],
    [P.through, 4, "sine.in"],
  ]);
  track(tl, J, "flash", [
    [approach(0.8), 0],
    [P.through - 0.004, 1, "sine.in"],
    [P.through + 0.004, 1],
    [P.out, 0, "sine.out"],
  ]);
  // the particle logo gathers over the pond, forms, and settles
  // the particle body: it streams in as the light lets go and forms the
  // mark; each section then holds its form while its copy is up, and it
  // flows into the next form across the change of section
  seg(tl, J, "pAppear", 0, 1, P.through + (P.out - P.through) * 0.4, P.out + (P.formed - P.out) * 0.5, "sine.inOut");
  track(tl, J, "shapeT", [
    [P.out, 0],
    [P.formed, 1, "sine.inOut"],
    [sectionAt("mark", 0.72), 1],
    [sectionAt("cube", 0.28), 2, "sine.inOut"],
    [sectionAt("cube", 0.72), 2],
    [sectionAt("cloud", 0.28), 3, "sine.inOut"],
    [sectionAt("cloud", 0.72), 3],
    [sectionAt("ring", 0.28), 4, "sine.inOut"],
  ]);
  // through the ring: its light opens up and fills the frame, onto the site
  seg(tl, J, "portal", 0, 1, sectionAt("portal", 0.25), 1, "sine.in");

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
    tl.fromTo(dom.hero, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -60, duration: 0.04, immediateRender: false }, 0.03);
  }

  // Pin the timeline length to exactly 1 so progress == p.
  tl.set({}, {}, 1);
  return tl;
}
