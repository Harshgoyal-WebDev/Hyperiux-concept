"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useLenis } from "lenis/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import OpeningStage from "./OpeningStage";
import { Header, ScrollProgress } from "./Header";
import { AboutSection, BiggerPicture, ContactSection, ImpactSection, ProcessSection, ServiceSections, WorkSections } from "./sections";
import { FRAMES } from "./content";
import { FrameLabel, Headline } from "./FrameText";
import { useDraw } from "./useDraw";
import { measure, onWorld, smooth, startWorld } from "./world/store";
import { LOOK } from "./world/tuning";

// WebGL, in the browser only
const World = dynamic(() => import("./world/World"), { ssr: false });
// the Leva panels: in development, or with ?tune in the address
const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });
const tuneQuery = () => process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("tune");
const noop = () => () => {};

// HYPERIUX — The Connected Blueprint. Twenty frames on one page, over one
// world (world/): a city of the mark's own cube, drawn line by line as the
// page scrolls, the camera flying through it from frame to frame, one orange
// thread connecting every place. The opening (01–09) is a sticky screen of
// copy over its drawing, dark into light; the sections (10–20) are the
// site's content, each arriving with its place in the world. Lenis scrolls
// the page (the app's root layout); every Lenis scroll updates
// ScrollTrigger, and the world's clock reads the same scroll each frame.
const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (cb) => {
  const m = window.matchMedia(motionQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const mobileQuery = "(max-width: 767px)";
const subscribeMobile = (cb) => {
  const m = window.matchMedia(mobileQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

// the page's colours follow the world's ground: dark until 08, light from 09
const THEME = [
  ["--bp-bg", [17, 17, 17, 1], [255, 255, 255, 1]],
  ["--bp-fg", [255, 255, 255, 1], [17, 17, 17, 1]],
  ["--bp-guide", [119, 119, 119, 0.55], [119, 119, 119, 0.45]],
  ["--bp-faint", [119, 119, 119, 0.22], [119, 119, 119, 0.18]],
  ["--bp-face", [255, 255, 255, 0.035], [17, 17, 17, 0.025]],
];

export default function ArchitecturalStorytelling() {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(motionQuery).matches, () => false);
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const tune = useSyncExternalStore(noop, tuneQuery, () => false);
  const rootRef = useRef(null);
  const lightRef = useRef(null);

  useLenis(ScrollTrigger.update);
  useDraw(lightRef, reduced);

  useEffect(() => startWorld({ reduced }), [reduced]);

  useEffect(() => {
    const root = rootRef.current;
    let last = -1;
    return onWorld(({ W }) => {
      const m = Math.round(smooth(LOOK.lightFrom, LOOK.lightTo, W) * 200) / 200;
      if (m === last) return;
      last = m;
      THEME.forEach(([name, a, b]) => {
        const c = a.map((x, i) => x + (b[i] - x) * m);
        root.style.setProperty(name, `rgba(${c[0].toFixed(0)}, ${c[1].toFixed(0)}, ${c[2].toFixed(0)}, ${c[3].toFixed(3)})`);
      });
    });
  }, []);

  // fonts and late layout change heights: measure again once they settle
  useEffect(() => {
    let alive = true;
    const again = () => {
      if (!alive) return;
      ScrollTrigger.refresh();
      measure();
    };
    document.fonts?.ready.then(again);
    const t = setTimeout(again, 1200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  return (
    <div ref={rootRef} className="bp-root relative min-h-screen w-full font-[family-name:var(--font-aeonikpro)] antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-[var(--bp-accent)] focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <World mobile={mobile} />
      {tune && <TuningPanel />}
      <Header />
      <ScrollProgress />
      <main id="main" className="relative z-10">
        <OpeningStage reduced={reduced} />
        {reduced && <ReducedChapters />}
        <div id="capabilities" ref={lightRef} data-light-half="" className={`bp-light relative text-[var(--bp-fg)] ${reduced ? "bp-static bg-[var(--bp-bg)]" : ""}`}>
          <ServiceSections />
          <ProcessSection />
          <WorkSections reduced={reduced} />
          <ImpactSection />
          <BiggerPicture />
          <AboutSection />
          <ContactSection />
        </div>
      </main>
    </div>
  );
}

// Reduced motion: the opening is a still of the mark; its chapters follow
// as plain copy (nothing flies, nothing is scrubbed).
function ReducedChapters() {
  return (
    <section aria-label="The blueprint" className="relative bg-[var(--bp-bg)] px-[6vw] py-[12vh]">
      <ol className="grid gap-[8vh] md:grid-cols-2">
        {FRAMES.slice(1, 9).map((f) => (
          <li key={f.n}>
            <FrameLabel n={f.n} label={f.label} />
            <Headline text={f.title} className="mt-4 text-[2rem] leading-[1.05] md:text-[2.6vw]" />
            {f.body && <p className="mt-4 max-w-[30rem] text-[var(--bp-muted)]">{f.body}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
