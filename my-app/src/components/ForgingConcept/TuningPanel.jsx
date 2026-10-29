"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { STATES } from "./config";

// Four Leva panels for every look property in tuning.js, in one column down
// the right: the forge (slab, energy, beam, post), the breakup (every
// stage's start and end, the blast, the streams of sand and the sand and
// gravel), the garden, and atmosphere, sand and audio. Controls are
// transient (onChange writes into T), so tuning never re-renders the page.
// Press "h" to show / hide them all.
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
  Beam: {
    trailIntensity: [0, 5, 0.01],
    beamFlow: [0, 4, 0.01],
    beamStart: [0, 0.98, 0.001],
    beamSpread: [0, 2, 0.01],
    beamDashSpacing: [1, 100, 0.1],
    beamDashLength: [0.02, 1, 0.01],
    beamBase: [0, 2, 0.01],
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

// The garden, in a panel of its own.
const GARDEN_SCHEMA = {
  Light: {
    innerGlow: [0, 3, 0.01],
    gardenEnvIntensity: [0, 2, 0.01],
    gardenSun: [0, 8, 0.01],
  },
  Sky: {
    skyCloudCover: [0, 1, 0.01],
    skyCloudSpeed: [0, 6, 0.01],
  },
  Camera: {
    gardenFovOffset: [-15, 20, 0.5],
    gardenOrbitRadius: [0.6, 1.6, 0.01],
    gardenOrbitHeight: [-2, 8, 0.05],
  },
  Air: {
    gardenAir: [0, 2, 0.01],
    gardenLeafSize: [0.2, 3, 0.01],
    gardenMoteSize: [0.2, 3, 0.01],
  },
  Grass: {
    grassDensity: [0, 1, 0.01],
    grassHeight: [0.2, 3, 0.01],
    grassWidth: [0.2, 3, 0.01],
    grassRoot: "color",
    grassMid: "color",
    grassTip: "color",
    grassDry: "color",
    grassTranslucency: [0, 3, 0.01],
  },
  Flowers: {
    flowerDensity: [0, 1, 0.01],
    tulipDensity: [0, 1, 0.01],
    daisyDensity: [0, 1, 0.01],
    spireDensity: [0, 1, 0.01],
    flowerHeight: [0.3, 4, 0.01],
    flowerSize: [0.3, 4, 0.01],
    tulipRed: "color",
    tulipPink: "color",
    tulipYellow: "color",
    tulipOrange: "color",
    tulipWhite: "color",
    tulipPurple: "color",
    daisyColor: "color",
    spireLavender: "color",
    spireRose: "color",
  },
  "Tree blossom": {
    treeBlossomShare: [0, 1, 0.01],
    treeBlossomDensity: [0, 1, 0.01],
    treeBlossomSize: [0.2, 4, 0.01],
    treeBlossomPink: "color",
    treeBlossomWhite: "color",
    treeBlossomRose: "color",
    treeBlossomLilac: "color",
  },
  Landscape: {
    pondSize: [1, 2.4, 0.01],
    gardenRidges: [0, 16, 0.1],
    gardenMountains: [0, 3, 0.01],
  },
  "Hover · flowers & bushes": {
    gardenHoverRadius: [0.2, 8, 0.01],
    gardenHoverStrength: [0, 3, 0.01],
    gardenHoverLinger: [0.05, 4, 0.01],
    gardenHoverSmooth: [0.01, 0.5, 0.005],
    gardenHoverWake: [0, 0.8, 0.01],
    gardenWind: [0, 3, 0.01],
    gardenGlow: [0, 4, 0.01],
    gardenGlowRadius: [0.2, 6, 0.01],
    gardenGlowColor: "color",
  },
  Pond: {
    pondReflect: [0, 1, 0.01],
    pondDistortion: [0, 0.5, 0.001],
    pondCurrentSpeed: [0, 4, 0.01],
    pondCurrentScale: [0.2, 8, 0.01],
    pondRippleStrength: [0, 4, 0.01],
    pondRippleForce: [0, 4, 0.01],
    pondRippleRadius: [0.1, 3, 0.01],
    pondRippleDamping: [0.9, 0.999, 0.001],
    pondDeep: "color",
    pondShallow: "color",
    pondClarity: [0, 1, 0.01],
  },
  "Particle body": {
    logoParticleSize: [0.2, 3, 0.01],
    logoParticleGlow: [0.2, 3, 0.01],
    logoSpecular: [0, 3, 0.01],
    logoRim: [0, 3, 0.01],
    logoColorA: "color",
    logoColorB: "color",
    logoColorC: "color",
    logoColorD: "color",
    logoMorphSpeed: [0.2, 8, 0.01],
    logoMorphStagger: [0, 0.8, 0.01],
    logoGatherSpeed: [0.1, 4, 0.01],
    logoGatherStagger: [0, 0.8, 0.01],
    logoGatherWhirl: [0, 15, 0.1],
    logoMorphPull: [0, 30, 0.1],
    logoSpring: [1, 120, 0.1],
    logoDamping: [0.8, 0.995, 0.001],
    logoFlow: [0, 4, 0.01],
    logoSwirlSpeed: [0, 4, 0.01],
    logoInfinitySpeed: [0, 1, 0.005],
    logoInfinitySize: [3, 16, 0.1],
    logoInfinityTube: [0.3, 4, 0.05],
    logoHoverRadius: [0.02, 0.4, 0.005],
    logoHoverForce: [0, 8, 0.01],
    logoDrag: [0, 4, 0.01],
    logoScatterTime: [0.1, 10, 0.05],
    logoViscosity: [0, 0.9, 0.01],
    logoRepulsion: [0, 0.2, 0.001],
    logoCoreGlow: [0, 3, 0.01],
    logoWhiteout: [0, 1.5, 0.01],
    logoYaw: [-180, 180, 1],
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
    gardenVolume: [0, 2, 0.01],
    gardenMusicVolume: [0, 2, 0.01],
    gardenTempo: [40, 120, 1],
    gardenBeatVolume: [0, 2, 0.01],
    dimensionWarp: [0, 2, 0.01],
    pondVolume: [0, 2, 0.01],
    swooshVolume: [0, 2, 0.01],
    logoVolume: [0, 2, 0.01],
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

// The breakup, in a panel of its own: every stage's start and end, the
// impact, the streams of sand, the sand and gravel.
const BREAK_SCHEMA = {
  "Timing (shares of the event)": {
    breakStart: [0, 0.6, 0.005],
    breakEnd: [0.2, 1, 0.005],
  },
  "Stages (start → end, shares of the breakup)": {
    breakBurstEnd: [0.01, 0.5, 0.005],
    breakBlastEnd: [0.01, 0.5, 0.005],
    breakGatherStart: [0, 0.8, 0.005],
    breakGatherEnd: [0.02, 1, 0.005],
    breakGather: [0, 1, 0.01],
    breakSpinStart: [0, 0.8, 0.005],
    breakSpinEnd: [0.02, 1, 0.005],
    breakGrindStart: [0, 0.95, 0.005],
    breakGrindEnd: [0.05, 1, 0.005],
    breakSandFlow: [0.01, 0.6, 0.005],
  },
  Impact: {
    breakImpact: [0, 3, 0.01],
    breakSpread: [0.2, 3, 0.01],
    breakShrink: [0.2, 1, 0.01],
    breakTumble: [0, 3, 0.01],
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
  },
};

// half as wide again as Leva's default (280 px), the extra all for the labels
const PANEL_WIDTH = 420;
const THEME = { sizes: { rootWidth: `${PANEL_WIDTH}px`, controlWidth: "190px" } };

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
      else items[key] = { value: T[key], min: spec[0], max: spec[1], step: spec[2], onChange };
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
  const breakStore = useCreateStore();
  const gardenStore = useCreateStore();

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
        console.info("[forging-concept] tuning:\n" + json);
      }),
    }),
    { store: objectStore }
  );
  useControls(() => buildControls(WORLD_SCHEMA), { store: worldStore });
  useControls(() => buildControls(GARDEN_SCHEMA), { store: gardenStore });
  useControls(
    () => ({
      ...buildControls(BREAK_SCHEMA),
      "Copy breakup settings": button(() => {
        const keys = Object.values(BREAK_SCHEMA).flatMap((f) => Object.keys(f));
        const json = JSON.stringify(Object.fromEntries(keys.map((k) => [k, T[k]])), null, 2);
        navigator.clipboard?.writeText(json);
        console.info("[forging-concept] breakup:\n" + json);
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
        [objectStore, "Forge · energy (H)"],
        [breakStore, "Breakup · sand streams"],
        [gardenStore, "Garden"],
        [worldStore, "Atmosphere · sand · audio"],
      ].map(([store, title]) => (
        <LevaPanel key={title} store={store} hidden={hidden} fill collapsed theme={THEME} titleBar={{ title, drag: false }} />
      ))}
    </div>
  );
}
