"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: the governor's own state is mutated inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { LEVELS, Q, initialQualityLevel, setQualityLevel } from "../quality";

// The frame-rate governor: watches how long frames take and, when the scene
// can't hold ~48 fps for a couple of seconds, steps the live quality down a
// level (quality.js), waits for it to take effect, and looks again. It only
// ever steps down, so the picture never flickers between levels. Stalls (a
// scene being built, a tab coming back) are ignored, and it is already at
// work behind the loader, so most devices have settled before the visitor
// is in.
const SLOW_MS = 1000 / 48; // a frame slower than this is a slow frame
const WINDOW = 90; // frames judged at a time
const SETTLE_S = 2.5; // after a change (and at the start), wait this long

export default function Governor() {
  const s = useMemo(() => ({ times: [], wait: SETTLE_S }), []);
  useEffect(() => {
    initialQualityLevel();
  }, []);

  // (?nogov: held at its level — profiling)
  const off = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nogov"), []);
  useFrame((_, delta) => {
    if (off || Q.level >= LEVELS.length - 1) return;
    if (document.hidden || delta > 0.25) return; // a stall, not the frame rate
    if (s.wait > 0) {
      s.wait -= delta;
      return;
    }
    s.times.push(delta * 1000);
    if (s.times.length < WINDOW) return;
    // the typical frame of the window (a few slow ones don't count)
    const sorted = [...s.times].sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length * 0.6)];
    s.times.length = 0;
    if (typical > SLOW_MS) {
      setQualityLevel(Q.level + 1);
      s.wait = SETTLE_S;
    }
  });
  return null;
}
