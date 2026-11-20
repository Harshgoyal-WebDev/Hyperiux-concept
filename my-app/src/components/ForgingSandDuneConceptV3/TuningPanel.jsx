"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { STATES } from "./config";

// Three Leva panels for every look property in tuning.js, in one column down
// the right: the forge (slab, energy, beam, past the mark, post), the
// breakup (every stage's start and end, the blast, the streams of sand and
// the sand and gravel), and atmosphere, sand and audio. Controls are
// transient (onChange writes into T), so tuning never re-renders the page.
// Press "h" to show / hide them all.
const OBJECT_SCHEMA = {
  "Slab & core": {
    innerGlow: [0, 4, 0.01],
    innerGlowColor: "color",
    logoParallax: [0, 3, 0.01],
    logoYaw: [0, 30, 0.1],
    logoPitch: [0, 20, 0.1],
    fissureGlow: [0, 8, 0.05],
    crackSpread: [0, 1.5, 0.01],
    engrave: [0, 1, 0.01],
    crackGlow: [0, 3, 0.01],
    crackColor: "color",
    sphereGlow: [0, 3, 0.01],
    pocketHeat: [0, 3, 0.01],
    coreLight: [0, 4, 0.01],
  },
  "Scroll sequence": {
    forgeDuration: [2, 14, 0.1],
    forgeReverse: [0.5, 8, 0.1],
  },
  Entering: {
    arriveDuration: [0.5, 8, 0.05],
    arriveDistance: [0, 600, 1],
    arriveLift: [0, 200, 1],
    loaderReveal: [0.4, 5, 0.05],
    revealWarp: [0, 3, 0.01],
    revealBlur: [0, 3, 0.01],
    revealChroma: [0, 3, 0.01],
  },
  "Beam to the core": {
    cameraSettle: [0.01, 0.6, 0.01],
  },
  "Beam — single or streaks": {
    beamStreaks: "bool",
    beamStart: [0, 0.98, 0.001],
    beamFootAt: [0.05, 1, 0.01],
    oasisBeam: [0, 3, 0.01],
    oasisBeamLead: [0.2, 3, 0.01],
    "Single beam": {
      beamIntensity: [0, 4, 0.01],
      beamWidth: [0.1, 4, 0.01],
      oasisBeamWidth: [0.1, 4, 0.01],
      beamCoreRatio: [0.05, 0.8, 0.005],
      beamCoreBright: [0, 6, 0.01],
      beamGlowBright: [0, 6, 0.01],
      beamFlicker: [0, 3, 0.01],
      beamCoreColor: "color",
      beamGlowColor: "color",
    },
    Streaks: {
      streakIntensity: [0, 8, 0.01],
      streakWidth: [0.1, 5, 0.01],
      streakFlow: [0, 4, 0.01],
      streakSpread: [0, 3, 0.01],
      streakDashSpacing: [1, 150, 0.1],
      streakDashLength: [0.01, 1, 0.01],
      streakBase: [0, 2, 0.01],
      streakColor: "color",
      streakHotColor: "color",
    },
  },
  "Breakup sand": {
    sandBrightness: [0, 3, 0.01],
    swirlSpeed: [0, 3, 0.01],
  },
  Post: {
    bloomIntensity: [0, 3, 0.01],
    bloomThreshold: [0, 3, 0.01],
    bloomRadius: [0, 1, 0.01],
    vignette: [0, 2, 0.01],
  },
};

const WORLD_SCHEMA = {
  Audio: {
    masterVolume: [0, 1.5, 0.01],
    musicVolume: [0, 1.5, 0.01],
    musicTempo: [50, 120, 1],
    pulseDepth: [0, 0.8, 0.01],
    arpVolume: [0, 2, 0.01],
    bassVolume: [0, 2, 0.01],
    chordBars: [1, 8, 1],
    sandVolume: [0, 2, 0.01],
    beamVolume: [0, 2, 0.01],
    crackVolume: [0, 2, 0.01],
    warpVolume: [0, 2, 0.01],
    impactVolume: [0, 2, 0.01],
    breakVolume: [0, 2, 0.01],
    swirlVolume: [0, 2, 0.01],
    lightVolume: [0, 2, 0.01],
    vanishVolume: [0, 2, 0.01],
    vanishStart: [0.6, 1, 0.001],
    vanishEnd: [0.6, 1, 0.001],
  },
  "Night mode": {
    night: "bool",
    moonIntensity: [0, 6, 0.01],
    moonColor: "color",
    nightAmbient: [0, 4, 0.01],
    nightAmbientColor: "color",
    stars: [0, 3, 0.01],
  },
  "Lighting & atmosphere": {
    exposure: [0.3, 2.5, 0.01],
    sunIntensity: [0, 8, 0.05],
    sunColor: "color",
    hemiIntensity: [0, 3, 0.01],
    hemiSky: "color",
    hemiGround: "color",
    fillIntensity: [0, 4, 0.01],
    fillColor: "color",
    envIntensity: [0, 2, 0.01],
    fogDensity: [0, 0.004, 0.0001],
  },
  Rocks: {
    stoneColor: "color",
    stoneRoughness: [0.2, 1, 0.01],
    crackScale: [0.3, 3, 0.01],
    crackDepth: [0, 3, 0.01],
  },
  Sand: {
    sandColor: "color",
    rippleStrength: [0, 3, 0.01],
    sandRippleSize: [0.5, 12, 0.05],
    sandRippleDepth: [0, 3, 0.01],
  },
  Impact: {
    shockStrength: [0, 3, 0.01],
    shockShake: [0, 3, 0.01],
    edgeBlur: [0, 3, 0.01],
    edgeChroma: [0, 2, 0.01],
  },
  "Sand interaction": {
    stirRadius: [0.3, 3, 0.01],
    stirStrength: [0, 3, 0.01],
    lineWidth: [0.1, 2, 0.01],
    lineDepth: [0, 3, 0.01],
    lineMerge: [0.5, 20, 0.1],
    grainOpacity: [0, 3, 0.01],
    grainSize: [0.2, 3, 0.01],
    grainColorDay: "color",
    grainColorNight: "color",
  },
  Air: {
    dust: [0, 3, 0.01],
  },
};

// Past the mark: the oasis, the beam through it, the water, the tree.
const OASIS_SCHEMA = {
  "Timeline points (p)": {
    tlCutStart: [0, 1, 0.0005],
    tlCutEnd: [0, 1, 0.0005],
    tlOrbShow: [0, 1, 0.0005],
    tlBeamToTreeStart: [0, 1, 0.0005],
    tlBeamToTreeEnd: [0, 1, 0.0005],
    orbBurstSpan: [0.002, 0.1, 0.0005],
    syncFallReveal: "bool",
    revealSpan: [0.005, 0.3, 0.0005],
    treeGrowSpan: [0.005, 0.3, 0.0005],
    tlRevealStart: [0, 1, 0.0005],
    tlRevealEnd: [0, 1, 0.0005],
    tlTreeGrowStart: [0, 1, 0.0005],
    tlTreeGrowEnd: [0, 1, 0.0005],
    tlTreeLightEnd: [0, 1, 0.0005],
    tlOrbitStart: [0, 1, 0.0005],
    tlOrbitEnd: [0, 1, 0.0005],
    tlOutroStart: [0, 1, 0.0005],
    tlOutroEnd: [0, 1, 0.0005],
  },
  "Core orb & cube": {
    orbRadius: [1, 20, 0.1],
    orbHeight: [2, 40, 0.1],
    orbGlow: [0, 4, 0.01],
    orbHalo: [0, 4, 0.01],
    orbColor: "color",
    orbHotColor: "color",
    orbRingSize: [0.2, 4, 0.01],
    orbPourSpread: [0.1, 5, 0.01],
    orbPourReach: [20, 600, 1],
    orbFlash: [0, 4, 0.01],
    orbWave: [0, 4, 0.01],
    cubeSize: [0.5, 10, 0.05],
    cubeGlow: [0, 5, 0.01],
    cubeColor: "color",
    cubeTilt: [0, 45, 0.5],
    cubeFadeFrom: [0, 1, 0.01],
    cubeFadeTo: [0, 1, 0.01],
    cubeMelt: "bool",
    cubeMeltTravel: [0.02, 0.5, 0.005],
    cubeMeltGlow: [0, 5, 0.01],
  },
  "Reveal threads (V2)": {
    revealRing: [0, 3, 0.01],
    revealRivulets: "bool",
    revealSwirls: "bool",
    rivuletColor: "color",
  },
  "Tree": {
    treeGrowJitter: [0, 1, 0.01],
    treeLeafGlow: [0, 4, 0.01],
    treeLeafLit: [0, 6, 0.01],
    treeLeafColor: "color",
  },
  "Cut & outro glass": {
    cutGlass: [0, 3, 0.01],
    cutChroma: [0, 0.6, 0.005],
    outroGlass: [0, 3, 0.01],
    outroChroma: [0, 0.6, 0.005],
    outroCell: [0.04, 0.4, 0.005],
    outroGlassCover: [0.05, 1, 0.01],
    outroWhiteFrom: [0, 0.9, 0.01],
    outroWhiteFill: [0.05, 0.9, 0.01],
    outroRandom: [0, 1, 0.01],
  },
  "Scroll pace": {
    scrollFixedPace: "bool",
    scrollPace: [10, 300, 1],
    scrollHold: [0.04, 0.6, 0.01],
    scrollRampIn: [0.02, 1, 0.01],
    scrollRampOut: [0.02, 1.5, 0.01],
    scrollDuration: [0.3, 3, 0.05],
    scrollStep: [20, 400, 5],
    scrollLead: [0.2, 3, 0.05],
    scrollBoost: [1, 2, 0.01],
  },
  "Tree & cursor": {
    strandPush: [0, 6, 0.05],
    strandPushRadius: [1, 40, 0.5],
  },
  "Camera to the core & round the tree": {
    camCoreDist: [5, 150, 0.5],
    camCoreLift: [-10, 30, 0.1],
    orbitSweep: [-720, 720, 1],
    orbitRadius: [20, 220, 1],
    orbitRise: [2, 80, 0.5],
    orbitLookTop: [10, 100, 0.5],
    orbitFov: [40, 80, 0.5],
  },
  Camera: {
    eyePassage: [1.5, 12, 0.1],
    eyeLake: [2, 30, 0.1],
  },
  "Camera magnet (cursor, both scenes)": {
    magnet: [0, 3, 0.01],
    magnetYaw: [0, 25, 0.1],
    magnetPitch: [0, 15, 0.1],
    magnetBank: [-10, 10, 0.1],
    magnetSwing: [-10, 10, 0.1],
    magnetEdge: [0, 1, 0.01],
    magnetDamping: [0.5, 12, 0.1],
    magnetReach: [10, 200, 1],
    magnetDip: [0, 6, 0.05],
  },
  Water: {
    oasisStreamWidth: [0.4, 4, 0.01],
    valleyWidth: [0.5, 1.5, 0.01],
    waterShallow: "color",
    waterDeep: "color",
    waterShore: "color",
    waterMirror: [0, 1.5, 0.01],
    waterWaves: [0, 3, 0.01],
  },
  "Water ripples (cursor)": {
    waterRipple: [0, 3, 0.01],
    waterRippleRadius: [0.3, 3, 0.01],
    waterRippleDamping: [0.95, 0.998, 0.001],
    waterRippleSpeed: [0.1, 0.95, 0.01],
  },
  "Ground & plants": {
    grassColor: "color",
    soilColor: "color",
    foliage: [0.2, 3, 0.01],
    leafGlow: [0, 3, 0.01],
    leafTint: "color",
  },
  "Tree of light": {
    strandGain: [0, 2, 0.01],
    strandDim: [0, 1, 0.01],
    strandPulseSpeed: [0, 1.5, 0.01],
    strandFill: [-1, 1, 0.01],
    treeGlow: [0, 3, 0.01],
    treeAura: [0, 3, 0.01],
    treeLight: [0, 3, 0.01],
    embers: [0, 3, 0.01],
  },
};

// The breakup, in a panel of its own: every stage's start and end, the
// impact, the streams of sand, the sand and gravel.
// The feedback round's own controls (tuning.js "feedback round 2")
const FEEDBACK_SCHEMA = {
  "Cursor parallax": {
    parallaxMode: "select:shift,swing",
    parallaxShiftX: [0, 10, 0.05],
    parallaxShiftY: [0, 6, 0.05],
    parallaxLook: [0, 1, 0.01],
    magnetDamping: [0.5, 12, 0.1],
    logoParallax: [0, 3, 0.01],
  },
  "Hero beam": {
    heroBeamBehind: [0, 120, 1],
    beamBlastFade: [0.001, 0.1, 0.001],
    beamFootAt: [0.05, 1, 0.01],
    beamUpFace: "bool",
    beamFaceGap: [0, 1, 0.01],
    spineCrack: "bool",
  },
  "Sand": {
    sandInteract: "bool",
  },
  "Break": {
    breakBigVolume: [0, 11, 0.05],
    breakShatter: [0.1, 6, 0.01],
    breakShatterSpin: [0, 12, 0.1],
    edgeFxOffAt: [0.1, 1, 0.005],
    fillFront: [-0.5, 1, 0.005],
    fillDensity: [0.01, 2, 0.01],
    fillWallGlow: [0, 6, 0.05],
    fillDepth: [0, 14, 0.05],
  },
  "Transitions (bunq hexagons)": {
    cutStyle: "select:bunq,glass",
    outroStyle: "select:bunq,glass",
    transCellPx: [3, 60, 0.5],
    transSpread: [0.2, 8, 0.05],
    transJitter: [0, 0.5, 0.005],
    transOvershoot: [0, 1, 0.01],
    transRefract: [0, 20, 0.1],
    transWobble: [0, 0.5, 0.005],
    transBulge: [0, 0.6, 0.005],
    tlCutStart: [0, 1, 0.0005],
    tlCutEnd: [0, 1, 0.0005],
    tlOutroStart: [0, 1, 0.0005],
    tlOutroEnd: [0, 1, 0.0005],
  },
  "Scroll pace": {
    scrollPace: [10, 300, 1],
    paceEven: [0, 1, 0.01],
    paceApproach: [0.3, 4, 0.01],
    paceValley: [0.2, 3, 0.01],
  },
  "Valley beam": {
    valleyBeamBehind: [0, 150, 1],
    valleyBeamCatchUp: [0.002, 0.15, 0.001],
    oasisBeamLead: [0.2, 3, 0.01],
  },
};

const BREAK_SCHEMA = {
  "Sequence on the scroll (vh after the beam reaches the core; 200 = forged)": {
    seqBreak: [0, 120, 0.5],
    seqImpactEnd: [0, 200, 0.5],
    seqBlastEnd: [0, 200, 0.5],
    seqGatherStart: [0, 200, 0.5],
    seqGatherEnd: [0, 200, 0.5],
    seqSpinStart: [0, 200, 0.5],
    seqSpinEnd: [0, 200, 0.5],
    seqGrindStart: [0, 200, 0.5],
    seqGrindEnd: [0, 200, 0.5],
    seqSandFlow: [2, 200, 0.5],
    seqBreakEnd: [10, 200, 0.5],
    seqHold: [0, 200, 0.5],
    breakHoldOn: "bool",
    breakGather: [0, 1, 0.01],
  },
  Impact: {
    breakImpact: [0, 3, 0.01],
    breakSpread: [0.2, 3, 0.01],
    breakSandShare: [0.05, 1, 0.01],
    breakShrink: [0.2, 1, 0.01],
    breakTumble: [0, 3, 0.01],
    breakSolid: "bool",
    breakBigVolume: [0, 11, 0.05],
    breakShatter: [0.1, 3, 0.01],
  },
  Streams: {
    breakSpin: [0, 4, 0.01],
    streams: [1, 8, 1],
    streamRadius: [8, 60, 0.1],
    streamTilt: [-90, 90, 0.5],
    streamWobble: [0, 60, 0.5],
    streamHeight: [0, 20, 0.1],
    streamTail: [0.02, 1, 0.01],
    streamWidth: [0, 20, 0.1],
    streamLoose: [0, 1, 0.01],
  },
  "Pointer stir": {
    breakStirForce: [0, 4, 0.01],
    breakStirRadius: [0.01, 0.3, 0.005],
    breakStirLinger: [0.05, 4, 0.01],
    breakStirAlong: [0, 2, 0.01],
    breakStirApart: [0, 2, 0.01],
    breakStirSmooth: [0.005, 0.5, 0.005],
    breakStirWake: [0, 0.8, 0.01],
    breakStirSpread: [0, 1, 0.01],
    breakStirSand: [0, 3, 0.01],
    breakStirGravel: [0, 3, 0.01],
    breakStirEase: [0.01, 1, 0.01],
    breakStirGlow: [0, 2, 0.01],
  },
  "Sand & gravel": {
    crumbleSand: [0, 60000, 100],
    crumbleSize: [0.2, 4, 0.01],
    crumbleOpacity: [0, 1, 0.01],
    gravelCount: [0, 4000, 10],
    gravelSize: [0.2, 3, 0.01],
    gravelEmbers: [0, 1, 0.01],
    gravelEmberGlow: [0, 3, 0.01],
  },
};

// values the master timeline is built from (the beam's run, the camera's
// keyframes): changing one rebuilds it (ForgingConcept)
export const RETIME_EVENT = "forging-sand-dune-concept-v3:retime";
const RETIME = new Set(["edgeFxOffAt", "beamFootAt", "tlCutStart", "tlCutEnd", "tlBeamToTreeStart", "tlBeamToTreeEnd", "tlTreeLightEnd", "tlOutroStart", "tlOutroEnd", "cameraSettle", "seqBreak", "seqBreakEnd", "seqImpactEnd", "seqBlastEnd", "seqGrindEnd"]);

// half as wide again as Leva's default (280 px), the extra all for the labels
const PANEL_WIDTH = 420;
const THEME = { sizes: { rootWidth: `${PANEL_WIDTH}px`, controlWidth: "190px" } };

// (folders shown open)
const OPEN = new Set(["Beam — single or streaks", "Single beam", "Streaks"]);

function buildControls(schema) {
  const out = {};
  for (const [name, keys] of Object.entries(schema)) {
    const items = {};
    for (const [key, spec] of Object.entries(keys)) {
      // a nested folder
      if (spec && typeof spec === "object" && !Array.isArray(spec)) {
        Object.assign(items, buildControls({ [key]: spec }));
        continue;
      }
      const onChange = (v) => {
        T[key] = v;
        // (values the scroll timeline is built from: rebuild it)
        if (RETIME.has(key)) window.dispatchEvent(new Event(RETIME_EVENT));
        // (the land itself: the terrain, its water and plants are rebuilt)
        if (key === "oasisStreamWidth" || key === "valleyWidth") window.dispatchEvent(new Event("forging-sand-dune-concept-v3:reshape"));
      };
      if (spec === "color") items[key] = { value: T[key], onChange };
      else if (typeof spec === "string" && spec.startsWith("select:")) items[key] = { value: T[key], options: spec.slice(7).split(","), onChange };
      else if (spec === "bool") items[key] = { value: T[key], onChange: key === "night" ? setNight : onChange };
      else items[key] = { value: T[key], min: spec[0], max: spec[1], step: spec[2], onChange };
    }
    out[name] = folder(items, { collapsed: !OPEN.has(name) });
  }
  return out;
}

export default function TuningPanel({ onScrub }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      if (e.key.toLowerCase() === "h") setHidden((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const objectStore = useCreateStore();
  const worldStore = useCreateStore();
  const breakStore = useCreateStore();
  const oasisStore = useCreateStore();
  const feedbackStore = useCreateStore();
  useControls(
    () => ({
      ...buildControls(FEEDBACK_SCHEMA),
      "Copy feedback settings": button(() => {
        const keys = Object.values(FEEDBACK_SCHEMA).flatMap((f) => Object.keys(f));
        const json = JSON.stringify(Object.fromEntries(keys.map((k) => [k, T[k]])), null, 2);
        navigator.clipboard?.writeText(json);
        console.info("[forging-sand-dune-concept-v3] feedback:\n" + json);
      }),
    }),
    { store: feedbackStore }
  );

  useControls(
    () => ({
      Timeline: folder(
        {
          progress: { value: 0, min: 0, max: 1, step: 0.001, onChange: (v, _p, ctx) => !ctx.initial && onScrub(v, true) },
          ...Object.fromEntries(STATES.map((s) => [`${s.n} ${s.label}`, button(() => onScrub(s.start + 0.002, false))])),
        },
        { collapsed: false }
      ),
      ...buildControls(OBJECT_SCHEMA),
      "Copy settings": button(() => {
        const json = JSON.stringify(T, null, 2);
        navigator.clipboard?.writeText(json);
        console.info("[forging-sand-dune-concept-v3] tuning:\n" + json);
      }),
    }),
    { store: objectStore }
  );
  useControls(() => buildControls(WORLD_SCHEMA), { store: worldStore });
  useControls(
    () => ({
      ...buildControls(OASIS_SCHEMA),
      "Copy oasis settings": button(() => {
        const keys = Object.values(OASIS_SCHEMA).flatMap((f) => Object.keys(f));
        const json = JSON.stringify(Object.fromEntries(keys.map((k) => [k, T[k]])), null, 2);
        navigator.clipboard?.writeText(json);
        console.info("[forging-sand-dune-concept-v3] oasis:\n" + json);
      }),
    }),
    { store: oasisStore }
  );
  useControls(
    () => ({
      ...buildControls(BREAK_SCHEMA),
      "Copy breakup settings": button(() => {
        const keys = Object.values(BREAK_SCHEMA).flatMap((f) => Object.keys(f));
        const json = JSON.stringify(Object.fromEntries(keys.map((k) => [k, T[k]])), null, 2);
        navigator.clipboard?.writeText(json);
        console.info("[forging-sand-dune-concept-v3] breakup:\n" + json);
      }),
    }),
    { store: breakStore }
  );

  // keep the checkbox in step with the header's day / night toggle
  useEffect(() => {
    const sync = (e) => {
      if (worldStore.get("Night mode.night") !== e.detail) worldStore.setValueAtPath("Night mode.night", e.detail, false);
    };
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, [worldStore]);

  // one column down the right, half as wide again as Leva's default so the
  // labels fit; it scrolls when the open panels run past the screen (its
  // wheel and touch are kept from the page's smooth scroll: Lenis honours
  // data-lenis-prevent, and the page's own wheel listener never hears it)
  return (
    <div
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: 84, // (below the header's controls)
        right: 10,
        width: PANEL_WIDTH,
        maxHeight: "calc(100vh - 94px)",
        overflowY: "auto",
        display: hidden ? "none" : "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1000,
      }}
    >
      {[
        [feedbackStore, "Feedback · round 2"],
        [objectStore, "Forge · energy (H)"],
        [breakStore, "Breakup · sand streams"],
        [oasisStore, "Oasis · beam · water · tree"],
        [worldStore, "Atmosphere · sand · audio"],
      ].map(([store, title]) => (
        // each panel scrolls inside itself too, so a long open one never
        // pushes the others off the screen
        <div key={title} data-lenis-prevent style={{ maxHeight: "72vh", overflowY: "auto", overscrollBehavior: "contain", flexShrink: 0, borderRadius: 10 }}>
          <LevaPanel store={store} hidden={hidden} fill collapsed theme={THEME} titleBar={{ title, drag: false }} />
        </div>
      ))}
    </div>
  );
}
