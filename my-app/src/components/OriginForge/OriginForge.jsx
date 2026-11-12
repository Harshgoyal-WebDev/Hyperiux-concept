"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Header from "./Header";
import StaticJourney from "./StaticJourney";
import WhiteStorySections from "./WhiteStorySections";
import { readEnv } from "./env";

// THE ORIGIN FORGE: the experience shell.
//
// A pinned, scroll-driven 3D film (HyperiuxExperience) runs first: a
// forgotten world, four forces, the forging of the Hyperiux mark, the
// gateway, and an ivory staircase of the process. It ends in white, and the
// rest of the page is the studio's 2D site (WhiteStorySections), with no
// WebGL left running.
//
// Without WebGL2, or with prefers-reduced-motion, the same story is told in
// still frames (StaticJourney). The 3D bundle is only loaded when used.

const HyperiuxExperience = dynamic(() => import("./HyperiuxExperience"), {
  ssr: false,
  loading: () => <div className="of-experience of-experience--pending" />,
});

gsap.registerPlugin(ScrollTrigger);

const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });

const noop = () => () => {};

// The root Lenis measures the page once and then only re-measures when
// <html> resizes, which never happens here (the root layout gives <html>
// height: 100%). This page grows after mount (the film swaps its 100svh
// placeholder for a ~3000vh scroll track, images load), so without this the
// wheel stops at the stale height. Watch <main> instead, and re-measure both
// Lenis and every ScrollTrigger whenever it changes size.
function useRemeasureOnResize(ref) {
  const lenis = useLenis();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const remeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        lenis?.resize();
        ScrollTrigger.refresh();
      });
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(el);
    remeasure();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, lenis]);
}

export default function OriginForge() {
  const env = useSyncExternalStore(noop, readEnv, () => null);
  const main = useRef(null);
  useRemeasureOnResize(main);

  let intro;
  if (!env) intro = <div className="of-experience of-experience--pending" />;
  else if (!env.webgl) intro = <StaticJourney reason="This browser can't run the 3D film, so here it is in stills." />;
  else if (env.reduced) intro = <StaticJourney reason="Reduced motion is on, so the 3D film is shown as stills. Add ?motion to the address to play it." />;
  else intro = <HyperiuxExperience env={env} />;

  return (
    <main ref={main} id="top" className="of-main">
      <Header experience={!!env?.webgl && !env?.reduced} />
      {intro}
      <WhiteStorySections />
      {env?.tune && env.webgl && !env.reduced && <TuningPanel />}
    </main>
  );
}
