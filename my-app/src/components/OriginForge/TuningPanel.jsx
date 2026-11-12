"use client";

import { useEffect, useState } from "react";
import { Leva, button, folder, useControls } from "leva";
import { DEFAULTS, SCHEMA, T } from "./tuning";

// Leva controls for every look property in tuning.js. Transient: each
// control writes straight into T (onChange), so tuning never re-renders the
// page; the scene picks the new value up on its next frame. "Copy values"
// puts the current look on the clipboard, to paste over tuning.js's
// defaults. Press "h" to show or hide the panel.
function entry(key, spec) {
  const onChange = (v) => {
    T[key] = v;
  };
  if (spec === "color") return { value: T[key], onChange, transient: true };
  const [min, max, step] = spec;
  return { value: T[key], min, max, step, onChange, transient: true };
}

function schema() {
  const out = {};
  for (const [name, keys] of Object.entries(SCHEMA)) {
    out[name] = folder(Object.fromEntries(Object.entries(keys).map(([k, spec]) => [k, entry(k, spec)])), { collapsed: name !== "Environment" });
  }
  return out;
}

function Controls() {
  useControls(schema, []);
  useControls(
    "Values",
    {
      "Copy values": button(() => {
        const changed = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, T[k]]));
        navigator.clipboard?.writeText(JSON.stringify(changed, null, 2));
      }),
    },
    { collapsed: true }
  );
  return null;
}

export default function TuningPanel() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "h" && !/input|textarea/i.test(e.target?.tagName)) setHidden((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <Leva hidden={hidden} collapsed={false} titleBar={{ title: "Origin Forge · tuning", filter: true }} theme={{ sizes: { rootWidth: "320px" } }} />
      <Controls />
    </>
  );
}
