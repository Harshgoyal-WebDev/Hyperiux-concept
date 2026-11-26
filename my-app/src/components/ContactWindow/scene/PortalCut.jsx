"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: the pass's uniforms are written imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { createCutPass } from "@/components/ForgingSandDuneConceptV3/scene/CutTransition";
import { A } from "@/components/HyperiuxAbout/tuning";

// The change from the hands' scene to the contact page: the about page's own
// scene-1-to-2 transition, exactly — V3's bunq glass discs (CutTransition.jsx)
// with the about page's settings (its tuning.js trans*: the discs' size,
// spread, jitter, overshoot, refraction, wobble and dome, and which way they
// run — out from the centre), eased as it eases there (sine in-out) — here
// opening onto the page beneath instead of onto a next shot (uReveal). In
// both canvases alike (the hands', and the about hero's behind them): the
// same discs, the same frame.
const sineInOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(x, 0), 1));

export default function PortalCut({ look }) {
  const cut = useMemo(() => createCutPass(), []);
  useEffect(
    () => () => {
      cut.pass.dispose();
      cut.material.dispose();
    },
    [cut]
  );
  useFrame((state) => {
    const u = cut.uniforms;
    const t = sineInOut(look.portalT);
    const { width, height } = state.size;
    u.uT.value = t;
    u.uAspect.value = width / Math.max(height, 1);
    u.uTime.value = state.clock.elapsedTime;
    u.uStyle.value = 1;
    u.uBRes.value.set(width, Math.max(height, 1));
    u.uBCellPx.value = Math.max(A.transCellPx, 2);
    u.uBSpread.value = A.transSpread;
    u.uBJitter.value = A.transJitter;
    u.uBOvershoot.value = A.transOvershoot;
    u.uBRefract.value = A.transRefract;
    u.uBWobble.value = A.transWobble;
    u.uBBulge.value = A.transBulge;
    u.uBDir.value = A.transDir;
    u.uHold.value = 0;
    u.uReveal.value = 1;
    // (off either side of it: no pass at all)
    cut.pass.enabled = t > 0.0005;
  });
  return <primitive object={cut.pass} dispose={null} />;
}
