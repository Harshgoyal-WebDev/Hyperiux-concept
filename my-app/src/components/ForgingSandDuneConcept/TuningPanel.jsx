"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { STATES } from "./config";

// Two Leva panels for every look property in tuning.js: the forge (slab,
// energy, soil swirl) on the right, atmosphere, sand and audio beside it.
// Controls are transient (onChange writes into T), so tuning never
// re-renders the page. Press "h" to show / hide both.
const OBJECT_SCHEMA = {
  "Slab & core": {
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
    breakStart: [0, 0.6, 0.005],
    breakEnd: [0.2, 1, 0.005],
  },
  Beam: {
    trailIntensity: [0, 5, 0.01],
    beamFlow: [0, 4, 0.01],
    beamStart: [0, 0.98, 0.001],
    beamSpread: [0, 2, 0.01],
    beamDashSpacing: [1, 100, 0.1],
    beamDashLength: [0.02, 1, 0.01],
    beamBase: [0, 2, 0.01],
  },
  "Soil swirl": {
    swirlSpeed: [0, 3, 0.01],
    crumbleSand: [0, 60000, 100],
    crumbleSize: [0.2, 4, 0.01],
    crumbleOpacity: [0, 1, 0.01],
    gravelCount: [0, 4000, 10],
    gravelSize: [0.2, 3, 0.01],
    sandCount: [0, 12000, 10],
    sandSize: [0.2, 4, 0.01],
    sandSpeed: [0, 3, 0.01],
    sandBrightness: [0, 3, 0.01],
  },
  // the swirl's orbits: the whole swirl, then each orbit in its own folder
  Orbits: {
    orbitCount: [1, 8, 1],
    orbitRadius: [15, 70, 0.1],
    orbitGap: [0, 15, 0.1],
    orbitThickness: [0, 25, 0.1],
    orbitSpread: [0, 1, 0.01],
    orbitTilt: [-90, 90, 1],
    orbitRoll: [-90, 90, 1],
    orbitTurn: [-180, 180, 1],
    "Orbit 1": {
      orbit1Tilt: [-90, 90, 1],
      orbit1Roll: [-90, 90, 1],
      orbit1Turn: [-180, 180, 1],
      orbit1Height: [-20, 20, 0.1],
      orbit1Speed: [-0.6, 0.6, 0.005],
      orbit1Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 2": {
      orbit2Tilt: [-90, 90, 1],
      orbit2Roll: [-90, 90, 1],
      orbit2Turn: [-180, 180, 1],
      orbit2Height: [-20, 20, 0.1],
      orbit2Speed: [-0.6, 0.6, 0.005],
      orbit2Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 3": {
      orbit3Tilt: [-90, 90, 1],
      orbit3Roll: [-90, 90, 1],
      orbit3Turn: [-180, 180, 1],
      orbit3Height: [-20, 20, 0.1],
      orbit3Speed: [-0.6, 0.6, 0.005],
      orbit3Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 4": {
      orbit4Tilt: [-90, 90, 1],
      orbit4Roll: [-90, 90, 1],
      orbit4Turn: [-180, 180, 1],
      orbit4Height: [-20, 20, 0.1],
      orbit4Speed: [-0.6, 0.6, 0.005],
      orbit4Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 5": {
      orbit5Tilt: [-90, 90, 1],
      orbit5Roll: [-90, 90, 1],
      orbit5Turn: [-180, 180, 1],
      orbit5Height: [-20, 20, 0.1],
      orbit5Speed: [-0.6, 0.6, 0.005],
      orbit5Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 6": {
      orbit6Tilt: [-90, 90, 1],
      orbit6Roll: [-90, 90, 1],
      orbit6Turn: [-180, 180, 1],
      orbit6Height: [-20, 20, 0.1],
      orbit6Speed: [-0.6, 0.6, 0.005],
      orbit6Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 7": {
      orbit7Tilt: [-90, 90, 1],
      orbit7Roll: [-90, 90, 1],
      orbit7Turn: [-180, 180, 1],
      orbit7Height: [-20, 20, 0.1],
      orbit7Speed: [-0.6, 0.6, 0.005],
      orbit7Squash: [0.2, 1.2, 0.01],
    },
    "Orbit 8": {
      orbit8Tilt: [-90, 90, 1],
      orbit8Roll: [-90, 90, 1],
      orbit8Turn: [-180, 180, 1],
      orbit8Height: [-20, 20, 0.1],
      orbit8Speed: [-0.6, 0.6, 0.005],
      orbit8Squash: [0.2, 1.2, 0.01],
    },
  },
  "Past the mark": {
    beamLeadScale: [0.2, 3, 0.01],
    pillarGlow: [0, 4, 0.01],
    rockCrackSize: [2, 30, 0.1],
    contourStrength: [0, 1, 0.01],
    contourSpacing: [0.4, 6, 0.05],
    ashSize: [0.2, 4, 0.01],
    ashWind: [0, 3, 0.01],
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
  Parallax: {
    parallax: [0, 3, 0.01],
    parallaxDamping: [0.5, 12, 0.1],
  },
  Air: {
    dust: [0, 3, 0.01],
  },
};

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
        console.info("[forging-sand-dune-concept] tuning:\n" + json);
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
      <LevaPanel store={objectStore} hidden={hidden} collapsed titleBar={{ title: "Forge · energy · orbits (H)" }} />
      <div style={{ position: "fixed", top: 10, right: 300, width: 280, zIndex: 1000 }}>
        <LevaPanel store={worldStore} hidden={hidden} fill collapsed titleBar={{ title: "Atmosphere · sand · audio" }} />
      </div>
    </>
  );
}
