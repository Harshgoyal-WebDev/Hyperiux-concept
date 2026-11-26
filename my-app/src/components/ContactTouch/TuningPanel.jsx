"use client";

import { useEffect, useMemo } from "react";
import { Leva, button, folder, useControls } from "leva";
import { C, NIGHT_EVENT, REBUILD_EVENT, setNight } from "./tuning";

// The contact page's controls (?leva in the address): every value of the
// scene (tuning.js C), written live as it is dragged. The particle counts
// re-make the hands (a moment after the last change). "Copy settings" puts
// them all on the clipboard, to be kept in tuning.js.

const REBUILD = new Set(["threadCount", "threadLength", "threadStep", "threadFollow", "sandCount", "armLength", "extend", "leftWristBend", "rightWristBend"]);
const DIRS = { "up from the bottom": 0, "down from the top": 1, "out from the centre": 2, diagonal: 3, "from the left": 4, "from the right": 5, "in from the edges": 6, random: 7 };

const SCHEMA = {
  Touch: {
    armLength: [1, 4, 0.05],
    extend: [0, 1, 0.01],
    preTouch: [0, 1, 0.01],
    touchGlow: [0, 4, 0.05],
    leftWristBend: [-1.2, 1.2, 0.01],
    rightWristBend: [-1.2, 1.2, 0.01],
    touchX: [-0.8, 0.8, 0.005],
    touchY: [-0.8, 0.8, 0.005],
    touchDepth: [8, 90, 0.5],
    glowColor: "color",
    glowWidth: [0.01, 0.3, 0.005],
    glowBright: [0, 4, 0.05],
    flashSize: [0, 0.6, 0.005],
  },
  "Left hand — light streaks": {
    leftWristX: [-2.5, 0.5, 0.01],
    leftWristY: [-2.5, 0.5, 0.01],
    leftBack: [-20, 60, 0.5],
    leftAimYaw: [-90, 90, 0.5],
    leftAimPitch: [-90, 90, 0.5],
    leftRoll: [-180, 180, 1],
    leftSize: [0.4, 2, 0.01],
    threadCount: [100, 4000, 50],
    threadLength: [8, 160, 1],
    threadStep: [0.002, 0.03, 0.0005],
    threadFollow: [0, 1, 0.01],
    streakWidth: [0.3, 6, 0.05],
    streakSpeed: [0, 3, 0.01],
    pulseLength: [0.01, 0.6, 0.005],
    pulseBright: [0, 3, 0.05],
    streakBright: [0, 6, 0.05],
    streakColor: "color",
    streakHot: "color",
  },
  "Right hand — golden sand": {
    rightWristX: [-0.5, 2.5, 0.01],
    rightWristY: [-0.5, 2.5, 0.01],
    rightBack: [-20, 80, 0.5],
    rightAimYaw: [-90, 90, 0.5],
    rightAimPitch: [-90, 90, 0.5],
    rightRoll: [-180, 180, 1],
    rightSize: [0.4, 2, 0.01],
    sandCount: [1000, 90000, 500],
    sandSize: [0.3, 8, 0.05],
    sandBright: [0, 4, 0.05],
    sandColor: "color",
    sandColor2: "color",
    sandSparkle: [0, 3, 0.05],
    sandDrift: [0, 0.2, 0.001],
    sandFall: [0, 1, 0.01],
    sandJitter: [0, 0.03, 0.0005],
  },
  Depth: {
    occlude: "bool",
    occluderInset: [0, 0.04, 0.0005],
    backFade: [0, 1, 0.01],
    outline: [0, 5, 0.05],
  },
  Camera: {
    night: "bool",
    parallax: [0, 2, 0.01],
  },
  Transition: {
    cutDelay: [0, 0.3, 0.005],
    cutLength: [0.08, 0.45, 0.005],
    transDir: "dir",
    transCellPx: [3, 40, 0.5],
    transSpread: [0.2, 8, 0.05],
    transJitter: [0, 0.5, 0.005],
    transOvershoot: [0, 1, 0.01],
    transRefract: [0, 12, 0.1],
    transWobble: [0, 0.5, 0.005],
    transBulge: [0, 0.5, 0.005],
  },
  Look: {
    bloomIntensity: [0, 4, 0.01],
    bloomThreshold: [0, 3, 0.01],
    vignette: [0, 1.5, 0.01],
  },
};

let rebuildTimer = 0;
function build() {
  const out = {};
  for (const [name, keys] of Object.entries(SCHEMA)) {
    const items = {};
    for (const [key, spec] of Object.entries(keys)) {
      const onChange = (value) => {
        C[key] = value;
        if (REBUILD.has(key)) {
          clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => window.dispatchEvent(new Event(REBUILD_EVENT)), 250);
        }
      };
      if (spec === "bool") items[key] = { value: C[key], onChange: key === "night" ? (v) => C.night !== v && setNight(v) : onChange };
      else if (spec === "color") items[key] = { value: C[key], onChange };
      else if (spec === "dir") items[key] = { value: C[key], options: DIRS, onChange };
      else items[key] = { value: C[key], min: spec[0], max: spec[1], step: spec[2], onChange };
    }
    out[name] = folder(items, { collapsed: name !== "Touch" });
  }
  out["Copy settings"] = button(() => {
    const json = JSON.stringify(C, null, 2);
    navigator.clipboard?.writeText(json);
    console.info("[contact-v2] settings:\n" + json);
  });
  return out;
}

export default function TuningPanel() {
  const schema = useMemo(() => build(), []);
  const [, set] = useControls(() => schema);
  // (in step with the header's day / night switch)
  useEffect(() => {
    const sync = (e) => set({ night: e.detail });
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, [set]);
  // (the panel's own scroll kept from the page's smooth scroll)
  useEffect(() => {
    const root = document.querySelector("[class*='leva-c-']");
    root?.setAttribute("data-lenis-prevent", "");
  });
  return <Leva titleBar={{ title: "Contact · scene" }} theme={{ sizes: { rootWidth: "360px", controlWidth: "170px" } }} />;
}
