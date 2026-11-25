"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { A, FLOW, FLOW_EVENT, REBUILD, REBUILD_EVENT } from "./tuning";

// The /about page's Leva panel (shown with ?leva in the address): every
// look value in tuning.js. Controls are transient (onChange writes into A),
// so tuning never re-renders the page; counts and shapes rebuild their
// geometry. "Copy settings" puts the lot on the clipboard as JSON. Press "h"
// to hide / show.
const SCHEMA = {
  "Scroll flow (vh)": {
    flowHero: [40, 400, 1],
    flowTransition: [20, 300, 1],
    flowTeamHold: [0, 200, 1],
    flowClip: [20, 300, 1],
    flowValuesLead: [-60, 100, 1],
    flowValuesDelay: [0, 200, 1],
  },
  "Scroll (jump to)": null, // (filled in below)
  "Team light colours": {
    lineGlow: "color",
    lineBody: "color",
    lineBright: "color",
    lineHot: "color",
    lineRampGain: [0.2, 5, 0.01],
  },
  "Falling streaks": {
    streakColor: "color",
    streakHot: "color",
    streakCount: [20, 600, 1],
    streakFallEnd: [0.1, 1, 0.01],
    streakIntensity: [0, 5, 0.01],
    streakWidth: [0.1, 4, 0.01],
    streakFlow: [0, 4, 0.01],
    streakDashSpacing: [2, 160, 0.5],
    streakDashLength: [0.02, 1, 0.01],
    streakBase: [0, 3, 0.01],
    streakFootGlow: [0, 3, 0.01],
  },
  "Centre beam (fibres)": {
    beamFibers: [10, 600, 1],
    beamReach: [5, 300, 1],
    beamColumn: [0.2, 20, 0.1],
    beamBend: [1, 40, 0.5],
    beamHeight: [40, 1200, 1],
    beamFiberWidth: [0.05, 3, 0.01],
    beamIntensity: [0, 12, 0.01],
    beamFlow: [0, 4, 0.01],
    beamStreakGlow: [0, 1.5, 0.01],
    beamStreakGlowPx: [0, 30, 0.5],
    beamPool: [0, 10, 0.01],
    beamPoolRadius: [5, 200, 1],
  },
  Terrain: {
    convertStart: [0, 1, 0.01],
    convertSpan: [0.02, 1, 0.01],
    terrainGlow: [0, 4, 0.01],
    terrainCrest: [0, 3, 0.01],
    terrainWisps: [0, 3, 0.01],
    terrainBase: "color",
    terrainColor: "color",
  },
  Motes: {
    motesCount: [0, 200000, 1000],
    motesSize: [0.1, 4, 0.01],
    motesIntensity: [0, 4, 0.01],
    motesLift: [0, 8, 0.01],
    motesTwinkle: [0, 1, 0.01],
  },
  "Dust & rocks": {
    dustColor: "color",
    dustLitBright: [0, 6, 0.01],
    dustLitGain: [0, 5, 0.01],
    rockNight: "color",
    rockNightBright: [0, 1.5, 0.01],
    rockLit: [0, 1, 0.01],
  },
  "Ridge lines": {
    ridgeIntensity: [0, 3, 0.01],
    ridgeCore: [0, 10, 0.05],
    ridgeHalo: [0, 6, 0.05],
    ridgeThreshold: [0.005, 0.4, 0.005],
  },
  Atmosphere: {
    skyDark: [0, 1, 0.01],
    horizonGlow: [0, 3, 0.01],
    hazeDensity: [0, 0.012, 0.0001],
    hazeColor: "color",
  },
  "Team portrait": {
    portraitColumns: [60, 1200, 1],
    portraitDepth: [0, 5, 0.01],
    portraitRelief: [0, 2, 0.01],
    portraitThickness: [0, 1.5, 0.01],
    portraitStrandWidth: [0.1, 2, 0.01],
    portraitIntensity: [0, 10, 0.01],
    portraitColor: "color",
    portraitHot: "color",
    portraitDashSpacing: [0.2, 20, 0.1],
    portraitDashLength: [0.02, 1, 0.01],
    portraitFlow: [0, 3, 0.01],
    portraitBase: [0, 2, 0.01],
  },
  "Team backdrop": {
    teamLines: [0, 600, 1],
    teamLineIntensity: [0, 4, 0.01],
    teamLineGlow: [0, 1.5, 0.01],
    teamLineGlowPx: [0, 80, 0.5],
    teamLineBehind: [0, 1, 0.01],
    teamBackGlow: [0, 2, 0.01],
    teamBgDark: "color",
    teamBgWarm: "color",
    teamLineHeat: [0, 3, 0.01],
    teamVignette: [0, 1.5, 0.01],
    teamWaves: [0, 3, 0.01],
    teamMotes: [0, 6000, 10],
    teamMotesIntensity: [0, 4, 0.01],
    teamMotesColor: "color",
  },
  "Team portrait image": {
    portraitImage: [0, 1, 0.01],
    portraitExposure: [0.3, 1.5, 0.01],
    portraitMotes: [0, 2, 0.01],
    portraitFeather: [0, 0.5, 0.01],
    portraitStrandRest: [0, 1, 0.01],
    portraitStreaksAround: [0, 2, 0.01],
    portraitFlowLight: [0, 4, 0.01],
    portraitLightPass: [0, 2, 0.01],
    portraitParticles: [5000, 400000, 1000],
    portraitParticleSize: [0.2, 4, 0.01],
    portraitShimmer: [0, 2, 0.01],
    portraitParticleDepth: [0, 4, 0.01],
    portraitDepthInvert: "bool",
    portraitParticleGlow: [0, 4, 0.01],
    portraitParticleSpread: [0, 3, 0.01],
    teamBloomIntensity: [0, 3, 0.01],
    teamBloomThreshold: [0, 4, 0.01],
  },
  "Forming (reveal) & team copy": {
    revealDelay: [0, 0.9, 0.01],
    teamCopyAt: [0, 1, 0.01],
    teamCopyLength: [0.01, 0.5, 0.01],
    revealFly: [0.05, 0.8, 0.01],
    revealScatter: [0, 4, 0.01],
    revealLand: [0.4, 0.95, 0.01],
    revealBlend: [0.05, 0.8, 0.01],
  },
  "Point portrait": {
    dotSize: [0.2, 4, 0.01],
    dotGain: [0, 5, 0.01],
    dotAmbient: [0, 1, 0.01],
    dotDiffuse: [0, 4, 0.01],
    dotRim: [0, 3, 0.01],
    dotLightFollow: [0, 3, 0.01],
    dotColor: "color",
    dotHot: "color",
    dotBody: [0, 1, 0.01],
    dotMorphSwirl: [0, 3, 0.01],
  },
  "Changing member": {
    swapDuration: [0.4, 5, 0.01],
    swapRing: [0.1, 1.5, 0.01],
    swapGap: [0.05, 0.6, 0.01],
    swapLiftZ: [0, 3, 0.01],
    swapLiftOut: [0, 1, 0.01],
    swapCalm: [0, 1, 0.01],
  },
  "Into the light": {
    lightCream: "color",
  },
  Transition: {
    transDir: { options: { "Up from the bottom": 0, "Down from the top": 1, "Out from the centre": 2, Diagonal: 3, "From the left": 4, "From the right": 5, "In from the edges": 6, Random: 7 } },
    transCellPx: [3, 60, 0.5],
    transSpread: [0.2, 8, 0.05],
    transJitter: [0, 0.5, 0.005],
    transOvershoot: [0, 1, 0.01],
    transRefract: [0, 20, 0.1],
    transWobble: [0, 0.5, 0.005],
    transBulge: [0, 0.6, 0.005],
  },
  "Mouse parallax": {
    heroParallaxX: [0, 20, 0.1],
    heroParallaxY: [0, 10, 0.1],
    parallaxX: [0, 2, 0.01],
    parallaxY: [0, 2, 0.01],
    teamEnterX: [-2, 2, 0.01],
    teamEnterY: [-2, 2, 0.01],
    teamEnterRoll: [-15, 15, 0.1],
    teamEnterPitch: [-15, 15, 0.1],
    teamEnterYaw: [-15, 15, 0.1],
    teamEnterOpen: [0, 70, 0.5],
    parallaxEase: [0.3, 10, 0.1],
    teamBgTurn: [-60, 60, 0.5],
    teamAutoplay: [0, 15, 0.1],
  },
  Post: {
    bloomIntensity: [0, 4, 0.01],
    bloomThreshold: [0, 3, 0.01],
    vignette: [0, 1.5, 0.01],
  },
};

let rebuildTimer = 0;
let flowTimer = 0;
function buildControls(schema) {
  const out = {};
  for (const [name, keys] of Object.entries(schema)) {
    if (!keys) continue;
    const items = {};
    for (const [key, spec] of Object.entries(keys)) {
      const onChange = (v) => {
        A[key] = v;
        if (REBUILD.has(key)) {
          clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => window.dispatchEvent(new Event(REBUILD_EVENT)), 250);
        }
        if (FLOW.has(key)) {
          clearTimeout(flowTimer);
          flowTimer = setTimeout(() => window.dispatchEvent(new Event(FLOW_EVENT)), 300);
        }
      };
      if (spec === "color") items[key] = { value: A[key], onChange };
      else if (spec.options) items[key] = { value: A[key], options: spec.options, onChange };
      else if (spec === "bool") items[key] = { value: A[key], onChange };
      else items[key] = { value: A[key], min: spec[0], max: spec[1], step: spec[2], onChange };
    }
    out[name] = folder(items, { collapsed: name !== "Scroll flow (vh)" });
  }
  return out;
}

// the experience's chapters (in vh of its scroll, from the flow), to jump to
const MARKS = [
  ["01 Awakening", () => 0],
  ["Streaks falling", () => A.flowHero * 0.34],
  ["Land of light (copy)", () => A.flowHero * 0.68],
  ["Transition", () => A.flowHero],
  ["Team", () => A.flowHero + A.flowTransition + 10],
  ["Line clip", () => A.flowHero + A.flowTransition + A.flowTeamHold],
];

export default function TuningPanel({ onJump }) {
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
  const store = useCreateStore();
  useControls(
    () => ({
      "Jump to": folder(Object.fromEntries(MARKS.map(([label, vh]) => [label, button(() => onJump(vh()))])), { collapsed: false }),
      ...buildControls(SCHEMA),
      "Copy settings": button(() => {
        const json = JSON.stringify(A, null, 2);
        navigator.clipboard?.writeText(json);
        console.info("[about] tuning:\n" + json);
      }),
    }),
    { store }
  );
  return (
    <div
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      style={{ position: "fixed", top: 84, right: 10, width: 340, maxHeight: "calc(100vh - 94px)", overflowY: "auto", display: hidden ? "none" : "block", zIndex: 1000, borderRadius: 10 }}
    >
      <LevaPanel store={store} hidden={hidden} fill collapsed={false} titleBar={{ title: "About · light (H)", drag: false }} />
    </div>
  );
}
