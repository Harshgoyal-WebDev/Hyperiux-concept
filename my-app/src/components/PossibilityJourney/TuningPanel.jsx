"use client";

import { useEffect, useState } from "react";
import { Leva, button, folder, useControls } from "leva";
import { DEFAULTS, SCHEMA, T } from "./tuning";

// Leva controls for the journey's look (tuning.js). Transient: each control
// writes into T, so tuning never re-renders the page. "h" shows / hides it.
function entry(key, spec) {
  const onChange = (v) => {
    T[key] = v;
  };
  if (spec === "color") return { value: T[key], onChange, transient: true };
  const [min, max, step] = spec;
  return { value: T[key], min, max, step, onChange, transient: true };
}

function Controls() {
  useControls(
    () =>
      Object.fromEntries(
        Object.entries(SCHEMA).map(([name, keys]) => [name, folder(Object.fromEntries(Object.entries(keys).map(([k, s]) => [k, entry(k, s)])), { collapsed: name !== "Light" })])
      ),
    []
  );
  useControls(
    "Values",
    {
      "Copy values": button(() => navigator.clipboard?.writeText(JSON.stringify(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, T[k]])), null, 2))),
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
      <Leva hidden={hidden} collapsed titleBar={{ title: "From Possibility · tuning", filter: true }} theme={{ sizes: { rootWidth: "300px" } }} />
      <Controls />
    </>
  );
}
