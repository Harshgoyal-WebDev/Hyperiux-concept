"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { A, REBUILD, REBUILD_EVENT } from "./tuning";

// The /about page's Leva panel (shown with ?leva in the address): every
// look value in tuning.js. Controls are transient (onChange writes into A),
// so tuning never re-renders the page; counts and shapes rebuild their
// geometry. "Copy settings" puts the lot on the clipboard as JSON. Press "h"
// to hide / show.
const SCHEMA = {
  "Scroll (jump to)": null, // (filled in below)
  "Falling streaks": {
    streakCount: [20, 600, 1],
    streakFallEnd: [0.1, 1, 0.01],
    streakIntensity: [0, 5, 0.01],
    streakWidth: [0.1, 4, 0.01],
    streakFlow: [0, 4, 0.01],
    streakDashSpacing: [2, 160, 0.5],
    streakDashLength: [0.02, 1, 0.01],
    streakBase: [0, 3, 0.01],
    streakColor: "color",
    streakHot: "color",
    streakFootGlow: [0, 3, 0.01],
  },
  "Centre beam (fibres)": {
    beamFibers: [10, 600, 1],
    beamReach: [5, 300, 1],
    beamColumn: [0.2, 20, 0.1],
    beamBend: [1, 40, 0.5],
    beamHeight: [40, 600, 1],
    beamFiberWidth: [0.05, 3, 0.01],
    beamIntensity: [0, 5, 0.01],
    beamFlow: [0, 4, 0.01],
    beamStreakGlow: [0, 1.5, 0.01],
    beamStreakGlowPx: [0, 30, 0.5],
    beamPool: [0, 4, 0.01],
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
    portraitColumns: [60, 700, 1],
    portraitDepth: [0, 5, 0.01],
    portraitRelief: [0, 2, 0.01],
    portraitThickness: [0, 1.5, 0.01],
    portraitStrandWidth: [0.1, 2, 0.01],
    portraitIntensity: [0, 4, 0.01],
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
    teamLineGlowPx: [0, 30, 0.5],
    teamLineColor: "color",
    teamLineBehind: [0, 1, 0.01],
    teamBackGlow: [0, 2, 0.01],
    teamWaves: [0, 3, 0.01],
    teamMotes: [0, 6000, 10],
    teamMotesIntensity: [0, 4, 0.01],
  },
  "Team portrait image": {
    portraitImage: [0, 1, 0.01],
    portraitFeather: [0, 0.5, 0.01],
    portraitStrandRest: [0, 1, 0.01],
    portraitFlowLight: [0, 4, 0.01],
    portraitLightPass: [0, 2, 0.01],
    teamBloomIntensity: [0, 3, 0.01],
    teamBloomThreshold: [0, 4, 0.01],
  },
  "Mouse parallax": {
    heroParallaxX: [0, 20, 0.1],
    heroParallaxY: [0, 10, 0.1],
    parallaxX: [0, 4, 0.01],
    parallaxY: [0, 3, 0.01],
    parallaxEase: [0.3, 10, 0.1],
  },
  Post: {
    bloomIntensity: [0, 4, 0.01],
    bloomThreshold: [0, 3, 0.01],
    vignette: [0, 1.5, 0.01],
  },
};

let rebuildTimer = 0;
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
      };
      if (spec === "color") items[key] = { value: A[key], onChange };
      else items[key] = { value: A[key], min: spec[0], max: spec[1], step: spec[2], onChange };
    }
    out[name] = folder(items, { collapsed: name !== "Falling streaks" });
  }
  return out;
}

// the experience's chapters (in vh of its 400), to jump to
const MARKS = [
  ["01 Awakening", 0],
  ["Streaks falling", 40],
  ["Land of light (copy)", 80],
  ["Transition", 148],
  ["Team", 240],
  ["Into the light", 380],
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
      "Jump to": folder(Object.fromEntries(MARKS.map(([label, vh]) => [label, button(() => onJump(vh))])), { collapsed: false }),
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
