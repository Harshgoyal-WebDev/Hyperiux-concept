"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { STATES } from "./config";

// Two Leva panels for every look property in tuning.js: the monolith, cube
// and energy on the right, atmosphere, sand and camera beside it. Controls
// are transient (onChange writes into T), so tuning never re-renders the
// page. Press "h" to show / hide both.
const OBJECT_SCHEMA = {
  Monolith: {
    stoneColor: "color",
    stoneRoughness: [0.2, 1, 0.01],
    crackScale: [0.3, 3, 0.01],
    crackDepth: [0, 3, 0.01],
    fissureGlow: [0, 4, 0.01],
    crackSpread: [0, 1.5, 0.01],
    crackStart: [0, 0.4, 0.001],
    crackEnd: [0.02, 0.45, 0.001],
    crackColor: "color",
    glbEmissive: [0, 8, 0.05],
  },
  "Monolith halves": {
    monolithGap: [-4, 8, 0.01],
  },
  Cube: {
    cubeSize: [0.4, 2, 0.01],
    cubeGrow: [1, 2, 0.01],
    cubeColor: "color",
    cubeHotColor: "color",
    cubeGlow: [0.2, 3, 0.01],
    glassOpacity: [0, 2, 0.01],
    edgeGlow: [0, 4, 0.01],
    coreGlow: [0, 4, 0.01],
    coreLight: [0, 4, 0.01],
  },
  "Energy release": {
    beamCount: [0, 120, 1],
    beamIntensity: [0, 4, 0.01],
    beamWidth: [0.2, 4, 0.01],
    emberCount: [0, 7200, 10],
    glare: [0, 4, 0.01],
    waveIntensity: [0, 3, 0.01],
    fieldIntensity: [0, 3, 0.01],
  },
  "Break FX": {
    sparkCount: [0, 5200, 10],
    shardCount: [0, 520, 1],
    streakCount: [0, 1500, 10],
    streakIntensity: [0, 4, 0.01],
    blurStrength: [0, 3, 0.01],
    blurAtRest: [0, 1, 0.01],
    breakStretch: [0, 3, 0.01],
    edgeStretch: [0, 3, 0.01],
    coreFadeNear: [0, 20, 0.1],
    coreFadeFar: [1, 40, 0.1],
    chromatic: [0, 4, 0.01],
  },
  Tunnel: {
    tunnelCount: [0, 4000, 10],
    tunnelRadiusMin: [0, 20, 0.1],
    tunnelRadiusMax: [1, 60, 0.1],
    tunnelSize: [0.2, 4, 0.01],
    tunnelIntensity: [0, 6, 0.01],
    streakLength: [0, 4, 0.01],
  },
  "Scroll response": {
    scrollIntensityMin: [0, 0.1, 0.001],
    scrollIntensityFull: [0.002, 0.2, 0.001],
    scrollAttack: [0.01, 1, 0.01],
    scrollRelease: [0.05, 2, 0.01],
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
    vanishVolume: [0, 2, 0.01],
    vanishStart: [0.6, 1, 0.001],
    vanishEnd: [0.6, 1, 0.001],
  },
  "Night mode": {
    night: "bool",
    moonIntensity: [0, 6, 0.01],
    moonColor: "color",
    stars: [0, 3, 0.01],
  },
  "Hero camera": {
    heroCamPosition: "vec3",
    heroCamRotation: "vec3",
    heroFov: [15, 90, 0.1],
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
  Sand: {
    sandColor: "color",
    rippleStrength: [0, 3, 0.01],
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
  Trail: {
    trailIntensity: [0, 3, 0.01],
    trailHalo: [0, 3, 0.01],
    trailLead: [0, 2, 0.01],
  },
  Post: {
    bloomIntensity: [0, 3, 0.01],
    bloomThreshold: [0, 3, 0.01],
    bloomRadius: [0, 1, 0.01],
    vignette: [0, 2, 0.01],
  },
  Parallax: {
    parallax: [0, 3, 0.01],
    parallaxDamping: [0.5, 12, 0.1],
  },
  "Air & ash": {
    dust: [0, 3, 0.01],
    ashSize: [0.2, 3, 0.01],
    ashWind: [0, 3, 0.01],
  },
  "White state": {
    contourStrength: [0, 1, 0.01],
    contourSpacing: [0.6, 5, 0.01],
  },
};

function buildControls(schema) {
  const out = {};
  for (const [name, keys] of Object.entries(schema)) {
    const items = {};
    for (const [key, spec] of Object.entries(keys)) {
      const onChange = (v) => {
        T[key] = v;
      };
      if (spec === "color") items[key] = { value: T[key], onChange };
      else if (spec === "bool") items[key] = { value: T[key], onChange: key === "night" ? setNight : onChange };
      else if (spec === "vec3") {
        // vectors stay the same object in T; copy the components in
        items[key] = { value: { ...T[key] }, step: 0.1, onChange: (v) => Object.assign(T[key], v) };
      } else items[key] = { value: T[key], min: spec[0], max: spec[1], step: spec[2], onChange };
    }
    out[name] = folder(items, { collapsed: true });
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
        console.info("[sand-dune-concept] tuning:\n" + json);
      }),
    }),
    { store: objectStore }
  );
  useControls(() => buildControls(WORLD_SCHEMA), { store: worldStore });

  // keep the checkbox in step with the header's day / night toggle
  useEffect(() => {
    const sync = (e) => {
      if (worldStore.get("Night mode.night") !== e.detail) worldStore.setValueAtPath("Night mode.night", e.detail, false);
    };
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, [worldStore]);

  return (
    <>
      <LevaPanel store={objectStore} hidden={hidden} collapsed titleBar={{ title: "Monolith · cube · beams (H)" }} />
      <div style={{ position: "fixed", top: 10, right: 300, width: 280, zIndex: 1000 }}>
        <LevaPanel store={worldStore} hidden={hidden} fill collapsed titleBar={{ title: "Atmosphere · sand · camera" }} />
      </div>
    </>
  );
}
