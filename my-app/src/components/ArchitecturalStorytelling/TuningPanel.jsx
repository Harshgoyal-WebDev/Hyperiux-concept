"use client";

import { useEffect, useState } from "react";
import { LevaPanel, button, folder, useControls, useCreateStore } from "leva";
import { FRAMES } from "./content";
import { useScrollTo } from "./scroll";
import { KEYS } from "./world/layout";
import { rebuildRig } from "./world/rig";
import { DEBUG, LAYOUT, LOOK, layoutChanged } from "./world/tuning";

// Leva panels for the whole world (world/tuning.js): the timeline (hold the
// world at a time, jump to a frame), every camera key, the look, and the
// layout of the scenes. Controls are transient (onChange writes into the
// tuning objects), so dragging never re-renders the page; a camera key
// rebuilds the rig, a layout value rebuilds the world. Press "h" to show /
// hide them.

const LOOK_SCHEMA = {
  Colours: { darkBg: "color", darkInk: "color", lightBg: "color", lightInk: "color", accent: "color", guide: "color" },
  "Tones (alpha)": {
    darkToneInk: [0, 1, 0.01],
    darkToneGuide: [0, 1, 0.01],
    darkToneFaint: [0, 1, 0.01],
    lightToneInk: [0, 1, 0.01],
    lightToneGuide: [0, 1, 0.01],
    lightToneFaint: [0, 1, 0.01],
    toneAccent: [0, 1, 0.01],
  },
  "Dark → light": { lightFrom: [6, 10, 0.01], lightTo: [6, 10, 0.01] },
  Lines: { lineWidth: [0.2, 3, 0.01], labelOpacity: [0, 1, 0.01], markFill: [0, 1, 0.01] },
  Fog: { fogNear: [0.5, 8, 0.05], fogFar: [1, 20, 0.1] },
  "Parallax & scroll": { leanYaw: [0, 12, 0.1], leanPitch: [0, 10, 0.1], leanShift: [0, 0.15, 0.001], leanEase: [0.5, 12, 0.1], scrollEase: [1, 20, 0.1] },
};

const LAYOUT_SCHEMA = {
  "06 Structure (the mark as a plan)": {
    planScale: [0.008, 0.04, 0.0005],
    planUprightH: [0.2, 5, 0.05],
    planBridgeH: [0.1, 4, 0.05],
    planStart: [4.4, 5.6, 0.01],
    planRise: [0.1, 1.2, 0.01],
  },
  "07 Who we are (connections)": { nodeOut: [2, 12, 0.1], nodeH: [0.5, 5, 0.1], ringAt: [6.1, 6.7, 0.01], growthAt: [6.3, 6.95, 0.01] },
  "08 Human first (the figure)": {
    humanX: [12, 30, 0.1],
    humanZ: [4, 16, 0.1],
    humanRing: [1.5, 6, 0.05],
    humanHeight: [0.6, 4, 0.05],
    humanFacing: [-180, 180, 1],
    touchSize: [0.2, 1.5, 0.01],
    touchStep: [0, 1, 0.01],
  },
  "17 Impact (client cubes)": {
    clientSize: [0.6, 2.2, 0.01],
    clientGapX: [1, 3.5, 0.01],
    clientGapZ: [1, 3.5, 0.01],
    clientBase: [0.2, 4, 0.05],
    clientStep: [0, 1.5, 0.01],
    clientStart: [15.6, 16.6, 0.01],
    clientStagger: [0, 0.15, 0.005],
    logoSize: [0.3, 1, 0.01],
    logoTurn: [-180, 180, 1],
  },
};

const PANEL_WIDTH = 400;
const THEME = { sizes: { rootWidth: `${PANEL_WIDTH}px`, controlWidth: "200px" } };

function fromSchema(schema, target, after) {
  const out = {};
  for (const [name, keys] of Object.entries(schema)) {
    const items = {};
    for (const [key, spec] of Object.entries(keys)) {
      const onChange = (v, _p, ctx) => {
        if (ctx?.initial) return;
        target[key] = v;
        after?.();
      };
      items[key] = spec === "color" ? { value: target[key], onChange } : { value: target[key], min: spec[0], max: spec[1], step: spec[2], onChange };
    }
    out[name] = folder(items, { collapsed: true });
  }
  return out;
}

// one folder per camera key, named by its frame
function cameraControls() {
  const out = {};
  KEYS.forEach((k, i) => {
    const n = Math.min(Math.max(Math.floor(k.t) + 1, 1), 20);
    const name = `${String(i + 1).padStart(2, "0")} · t ${k.t.toFixed(2)} · ${FRAMES[n - 1].label}`;
    const set = (key) => (v, _p, ctx) => {
      if (ctx?.initial) return;
      k[key] = v;
      rebuildRig();
    };
    out[name] = folder(
      {
        [`t#${i}`]: { label: "time", value: k.t, min: -1, max: 21, step: 0.01, onChange: set("t") },
        [`target#${i}`]: { label: "target", value: [...k.target], step: 0.05, onChange: set("target") },
        [`yaw#${i}`]: { label: "yaw", value: k.yaw, min: -180, max: 180, step: 0.1, onChange: set("yaw") },
        [`pitch#${i}`]: { label: "pitch", value: k.pitch, min: -89, max: 89, step: 0.1, onChange: set("pitch") },
        [`size#${i}`]: { label: "size", value: k.size, min: 0.05, max: 80, step: 0.01, onChange: set("size") },
        [`fov#${i}`]: { label: "fov", value: k.fov, min: 0.3, max: 90, step: 0.1, onChange: set("fov") },
        [`sx#${i}`]: { label: "shift x", value: k.sx ?? 0, min: -1, max: 1, step: 0.01, onChange: set("sx") },
        [`sy#${i}`]: { label: "shift y", value: k.sy ?? 0, min: -1, max: 1, step: 0.01, onChange: set("sy") },
        [`mx#${i}`]: { label: "phone x", value: k.mx ?? 0, min: -1, max: 1, step: 0.01, onChange: set("mx") },
        [`my#${i}`]: { label: "phone y", value: k.my ?? 0, min: -1, max: 1, step: 0.01, onChange: set("my") },
      },
      { collapsed: true }
    );
  });
  return out;
}

const copy = (label, data) => {
  const json = JSON.stringify(data, null, 2);
  navigator.clipboard?.writeText(json);
  console.info(`[architectural-storytelling] ${label}:\n${json}`);
};

export default function TuningPanel() {
  // (hidden to start on a phone: it is wider than the screen)
  const [hidden, setHidden] = useState(() => window.innerWidth < 768);
  const scrollTo = useScrollTo();
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      if (e.key.toLowerCase() === "h") setHidden((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const timeStore = useCreateStore();
  const cameraStore = useCreateStore();
  const lookStore = useCreateStore();
  const layoutStore = useCreateStore();

  useControls(
    () => ({
      "hold time": { value: DEBUG.lock, onChange: (v) => (DEBUG.lock = v) },
      "world time": { value: DEBUG.W, min: -1, max: 21, step: 0.005, onChange: (v) => (DEBUG.W = v) },
      "Jump to frame": folder(Object.fromEntries(FRAMES.map((f) => [`${String(f.n).padStart(2, "0")} ${f.label}`, button(() => scrollTo(f.n))])), { collapsed: true }),
      "Copy all settings": button(() => copy("settings", { LOOK, LAYOUT, KEYS })),
    }),
    { store: timeStore },
    [scrollTo]
  );
  useControls(() => ({ ...cameraControls(), "Copy camera keys": button(() => copy("camera keys", KEYS)) }), { store: cameraStore });
  useControls(() => fromSchema(LOOK_SCHEMA, LOOK), { store: lookStore });
  useControls(() => fromSchema(LAYOUT_SCHEMA, LAYOUT, layoutChanged), { store: layoutStore });

  // one column down the right; it scrolls when the open panels run past the
  // screen (kept from the page's smooth scroll: Lenis honours
  // data-lenis-prevent)
  return (
    <div
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: 84,
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
        [timeStore, "Timeline (H hides)"],
        [cameraStore, "Camera keys"],
        [lookStore, "Look"],
        [layoutStore, "Layout of the scenes"],
      ].map(([store, title]) => (
        <LevaPanel key={title} store={store} hidden={hidden} fill collapsed theme={THEME} titleBar={{ title, drag: false }} />
      ))}
    </div>
  );
}
