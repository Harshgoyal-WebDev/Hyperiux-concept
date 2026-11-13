"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useLenis } from "lenis/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "gsap";
import Header from "./Header";
import Site from "./Site";
import StaticJourney from "./StaticJourney";
import { readEnv } from "../OriginForge/env";
import { setTheme } from "./theme";
import { CHAPTERS, NIGHT_CHAPTERS } from "./content";

gsap.registerPlugin(ScrollTrigger);

// FROM POSSIBILITY TO EXPERIENCE: the page.
//
// Part one is an immersive journey (Experience.jsx): eight chapters through
// one limestone world, pinned and scrubbed by the scroll. Part two is the
// editorial site (Site.jsx). The journey is about 40% of the page's scroll.
//
// Without WebGL2, or with reduced motion, the chapters are told as stills
// (StaticJourney). The 3D bundle is only loaded when it is used.
const Experience = dynamic(() => import("./Experience"), {
  ssr: false,
  loading: () => <div className="pj-journey pj-journey--pending" />,
});
const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });

const VH_PER_UNIT = { desktop: 9.5, mobile: 8 }; // the journey: 950vh / 800vh, about 40% of the page
const NIGHT_VH_PER_UNIT = { desktop: 11, mobile: 9 }; // (nine chapters: a little longer)

const noop = () => () => {};

// The root smooth scroll (Lenis) measures the page only when <html> resizes,
// which never happens here; this page grows after mount (the journey's track
// replaces its placeholder, images load). Watch the page and re-measure Lenis
// and every ScrollTrigger when it changes size.
function useRemeasure(ref) {
  const lenis = useLenis();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const again = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        lenis?.resize();
        ScrollTrigger.refresh();
      });
    };
    const ro = new ResizeObserver(again);
    ro.observe(el);
    again();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, lenis]);
}

// theme: "dark" (night, /from-possibility) or "light" (daylight,
// /from-possibility/light); see theme.js
export default function Journey({ theme = "dark" }) {
  setTheme(theme); // (before the world below is built: it reads the theme)
  const env = useSyncExternalStore(noop, readEnv, () => null);
  const main = useRef(null);
  useRemeasure(main);

  const chapters = theme === "light" ? CHAPTERS : NIGHT_CHAPTERS;
  let intro;
  if (!env) intro = <div className="pj-journey pj-journey--pending" />;
  else if (!env.webgl) intro = <StaticJourney chapters={chapters} reason="This browser can't run the 3D journey, so it is shown in stills." />;
  else if (env.reduced) intro = <StaticJourney chapters={chapters} reason="Reduced motion is on, so the journey is shown in stills. Add ?motion to the address to play it." />;
  else intro = <Experience env={env} vhPerUnit={(theme === "light" ? VH_PER_UNIT : NIGHT_VH_PER_UNIT)[env.tier.name] ?? 12} />;

  return (
    <main ref={main} id="top" className={`pj-main pj-${theme === "light" ? "light" : "dark"}`}>
      <Header theme={theme} />
      {intro}
      <Site theme={theme} />
      {env?.tune && env.webgl && !env.reduced && <TuningPanel />}
    </main>
  );
}
