import gsap from "gsap";
import { JOURNEY_TIMING } from "./config";
import { APPROACH, PASSAGE } from "./world/cameraPath";

// Plain mutable state the master timeline writes and the 3D scene reads in
// useFrame. Values here are the State 01 (hero) pose.
export function createJourneyState() {
  return {
    progress: 0, // raw scroll progress (drives scroll-velocity effects)
    // camera
    approach: 0, // hero → core (arc length 0..1)
    passage: 0, // core → through the cube → trail join (arc length 0..1)
    wB: 0, // blend A → trail-follow
    camB: 0, // trail param
    camH: 9,
    camLat: 0,
    camC: 0, // About / crane path param
    fov: 40,
    parallax: 1, // how much mouse parallax this shot allows
    // cube + energy
    cubeGlow: 1,
    energy: 0,
    arcs: 0,
    wave: 0,
    pull: 0,
    flow: 0,
    crack: 0,
    fracture: 0,
    field: 0,
    tunnel: 0, // the streak tunnel around the camera, from the break to the white-out
    // world
    intro: 0, // load-in of the front trail (time-based, set outside the scroll timeline)
    beam: 0, // the orange line drawn from the hero's view to the cube (by distance)
    crackSpread: 0, // glow creeping through the monolith's cracks
    rearBeam: 0, // the line out of the broken cube, down the far face to the back trail
    backTrail: 0,
    trailFade: 0,
    landmarks: 0,
    dust: 1,
    dissolve: 0,
    white: 0,
    flatten: 0,
    contours: 0,
    particleFade: 0,
    bloom: 1,
    vignette: 0.6,
    edge: 0, // frame edges stretched outwards while the cube breaks
    blur: 0, // radial motion blur / chromatic split
    streaks: 0, // hot particles streaking past after the break
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

export function buildMasterTimeline(J, dom, { s0 }) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  seg(tl, J, "progress", 0, 1, 0, 1);

  // ----- camera path A: one continuous dolly from the hero into the core
  // (eased in and out, so it settles to a stop in front of the cube), a
  // still hold while it charges and breaks, then on through it.
  seg(tl, J, "approach", 0, 1, APPROACH[0], APPROACH[1], "sine.inOut");
  seg(tl, J, "passage", 0, 1, PASSAGE[0], PASSAGE[1], "power1.inOut");

  // The lens settles with the camera at the core and holds through the
  // break (a widening lens there reads as the camera backing off); it only
  // opens up once we fly through.
  track(tl, J, "fov", [
    [0, 40],
    [0.11, 40],
    [0.165, 46],
    [0.245, 56, "sine.out"],
    [0.39, 56],
    [0.45, 62],
    [0.53, 52],
    [0.62, 46],
    [0.7, 44],
  ]);

  // ----- trail-follow (state 07–08)
  const { trailStart, trailLinearEnd, trailEnd, linearS } = JOURNEY_TIMING;
  seg(tl, J, "wB", 0, 1, trailStart, 0.535, "sine.inOut");
  seg(tl, J, "camB", s0, linearS, trailStart, trailLinearEnd);
  seg(tl, J, "camB", linearS, 1, trailLinearEnd, trailEnd, "sine.out");
  // One long glide down to cruising height (terrain under the trail is
  // smoothed in poseOnTrail), no bobbing.
  track(tl, J, "camH", [
    [trailStart, 13],
    [0.6, 8.5],
    [0.7, 9],
  ]);
  track(tl, J, "camLat", [
    [trailStart, 0],
    [0.6, 1.5],
    [0.7, 0],
  ]);

  // ----- About hold → crane over the dissolve (state 08 tail – 10)
  seg(tl, J, "camC", 0, 0.3333, trailEnd, 0.775, "sine.out");
  seg(tl, J, "camC", 0.3333, 0.6666, 0.775, 0.885, "sine.inOut");
  seg(tl, J, "camC", 0.6666, 1, 0.885, 0.985, "sine.inOut");

  // ----- cube & energy (states 01–06)
  track(tl, J, "cubeGlow", [
    [0, 1],
    [0.165, 1.3],
    [0.245, 2.2],
    [0.335, 3.0],
    [0.36, 4.2],
    [0.45, 1.5],
  ]);
  track(tl, J, "energy", [
    [0.1, 0],
    [0.165, 0.15],
    [0.245, 0.6],
    [0.3, 1],
    [0.36, 1],
    [0.42, 0.6],
    [0.5, 0.15],
    [0.56, 0],
  ]);
  track(tl, J, "arcs", [
    [0.2, 0],
    [0.245, 0.5],
    [0.3, 1],
  ]);
  track(tl, J, "wave", [
    [0.25, 0],
    [0.31, 1],
    [0.44, 1],
    [0.5, 0],
  ]);
  track(tl, J, "pull", [
    [0.3, 0],
    [0.4, 1],
    [0.46, 1],
    [0.52, 0],
  ]);
  seg(tl, J, "flow", 0, 6, 0.165, 0.5);
  seg(tl, J, "crack", 0, 1, 0.31, 0.345, "power1.in");
  seg(tl, J, "fracture", 0, 1, 0.345, 0.415);
  track(tl, J, "field", [
    [0.385, 0],
    [0.42, 1],
    [0.47, 1],
    [0.51, 0],
  ]);
  track(tl, J, "tunnel", [
    [0.345, 0],
    [0.375, 1],
    [0.775, 1],
    [0.83, 0],
  ]);

  // ----- world (states 07–10)
  // One continuous stroke: the line is drawn on along the dunes, up the
  // monolith's face and into the cube at its core (Trail.jsx splits the
  // distance between the two runs, so it never pauses at the join)...
  seg(tl, J, "beam", 0, 1, 0, 0.1, "sine.inOut");
  // (crackSpread — the glow filling the cracks — follows progress between
  // crackStart and crackEnd, live-tunable; see UniformSync.)
  // The trail is unrolled ahead of the camera as the energy resolves into it.
  // As the cube breaks its energy runs out of the back of the monolith and
  // on along the trail, always drawn ahead of the camera, so there's a
  // line under us all the way through.
  seg(tl, J, "rearBeam", 0, 1, 0.345, 0.385, "sine.out");
  track(tl, J, "backTrail", [
    [0.385, 0],
    [0.44, s0 + 0.06],
    [0.5, s0 + 0.18],
    [trailEnd - 0.03, 1, "none"],
  ]);
  seg(tl, J, "landmarks", 0, 1, 0.545, 0.7);
  track(tl, J, "dust", [
    [0.165, 1],
    [0.245, 0.3],
    [0.5, 0.3],
    [0.56, 1],
    [0.7, 0.35],
    [0.8, 0],
  ]);
  // State 09: the world turns white first; the dunes stay behind as a
  // contour line drawing while the monolith and rocks crumble into ash and
  // blow away (the "snap"). State 10: the contours flatten out and the
  // page resolves to white.
  track(tl, J, "white", [
    [0.775, 0],
    [0.83, 1],
  ]);
  track(tl, J, "contours", [
    [0.79, 0],
    [0.83, 1],
    [0.945, 1],
    [0.975, 0],
  ]);
  seg(tl, J, "dissolve", 0, 1, 0.8, 0.935);
  seg(tl, J, "particleFade", 0, 1, 0.94, 0.975, "sine.in");
  seg(tl, J, "flatten", 0, 1, 0.945, 0.98, "sine.inOut");
  // The orange line bows out with the dark world: nothing of it is left
  // once the page has turned white.
  seg(tl, J, "trailFade", 0, 1, 0.775, 0.83, "sine.in");
  track(tl, J, "bloom", [
    [0, 1],
    [0.3, 0.8],
    [0.35, 0.7],
    [0.39, 0.45],
    [0.5, 1],
    [0.7, 0.8],
    [0.775, 0.4],
    [0.82, 0],
  ]);
  track(tl, J, "vignette", [
    [0, 0.6],
    [0.3, 0.75],
    [0.5, 0.55],
    [0.775, 0.4],
    [0.82, 0],
  ]);

  // ----- break FX: the frame stretches open as the cube tears apart
  track(tl, J, "edge", [
    [0.3, 0],
    [0.34, 0.45],
    [0.37, 1],
    [0.41, 0.7],
    [0.47, 0],
  ]);
  // Motion blur is scaled by scroll speed and follows the scroll
  // direction (Post), so it carries on through the passage.
  track(tl, J, "blur", [
    [0.33, 0],
    [0.37, 0.7],
    [0.42, 1],
    [0.5, 1],
    [0.56, 0.6],
    [0.62, 0],
  ]);
  track(tl, J, "streaks", [
    [0.36, 0],
    [0.4, 1],
    [0.5, 1],
    [0.56, 0.5],
    [0.62, 0],
  ]);
  track(tl, J, "parallax", [
    [0, 1],
    [0.165, 0.6],
    [0.225, 0],
    [0.47, 0],
    [0.55, 0.75],
    [0.7, 0.5],
    [0.885, 0.3],
    [0.97, 0],
  ]);

  // ----- DOM overlays
  if (dom.hero) {
    tl.fromTo(dom.hero, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -60, duration: 0.04, immediateRender: false }, 0.032);
  }
  if (dom.captions) {
    dom.captions.forEach((el, i) => {
      if (!el) return;
      const t = JOURNEY_TIMING.captions[i];
      const len = JOURNEY_TIMING.captionLength;
      tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: len * 0.3, ease: "power2.out", immediateRender: false }, t);
      tl.fromTo(el, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30, duration: len * 0.25, ease: "power1.in", immediateRender: false }, t + len * 0.75);
    });
  }
  if (dom.about) {
    const { in: aIn, out: aOut } = JOURNEY_TIMING.about;
    tl.fromTo(dom.about, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, aIn);
    if (dom.aboutLines?.length) {
      tl.fromTo(
        dom.aboutLines,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.024, stagger: 0.0025, ease: "power3.out", immediateRender: false },
        aIn + 0.002
      );
    }
    tl.fromTo(dom.about, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -50, duration: 0.018, ease: "power1.in", immediateRender: false }, aOut);
  }
  if (dom.rail) {
    tl.fromTo(dom.rail, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.015, immediateRender: false }, 0.78);
  }
  if (dom.whiteout) {
    tl.fromTo(dom.whiteout, { opacity: 0 }, { opacity: 1, duration: 0.014, ease: "sine.inOut", immediateRender: false }, 0.976);
  }

  // Pin the timeline length to exactly 1 so progress == scroll fraction.
  tl.set({}, {}, 1);
  return tl;
}
