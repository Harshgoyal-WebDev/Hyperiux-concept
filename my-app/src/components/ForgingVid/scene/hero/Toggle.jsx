"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects are mutated imperatively inside useFrame, outside React's render. */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { T } from "../../tuning";

// Shows its children while T[flag] is on (the tuning panel's switches),
// without rebuilding anything. When it changes, the sun's shadows are
// redrawn (J.sceneVersion: Rig.jsx Lights).
export default function Toggle({ J, flag, children }) {
  const group = useRef();
  const last = useRef(null);
  useFrame(() => {
    const on = !!T[flag];
    if (group.current) group.current.visible = on;
    if (last.current !== on) {
      if (last.current !== null) J.sceneVersion += 1;
      last.current = on;
    }
  });
  return <group ref={group}>{children}</group>;
}
