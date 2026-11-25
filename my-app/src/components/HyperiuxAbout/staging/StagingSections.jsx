"use client";

// The Awards, Testimonial and FAQ sections of hyperiux-staging's About page
// (https://hyperiux-staging.vercel.app/about), ported as they are there.
//
// Meant to sit on the white page below the pinned About experience, in the
// same document (window scroll, the root ReactLenis from SmoothScroll). Its
// ScrollTriggers measure the real document positions, so they are refreshed
// whenever the document's height changes (the experience above settling,
// the FAQ opening, fonts / images coming in) and a few times after mount, as
// staging's LenisProvider does after every route change.

import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import Awards from "./Awards";
import Testimonial from "./Testimonial";
import NewFaq from "./NewFaq";
import Values from "./Values";
import { faqContent } from "./faqContent";
import { aeonikPro } from "./fonts";
import "./staging.css";

// staging's "Why partner with us?" on its own: straight after the pinned
// experience, where the light lands (the sections below refresh the
// ScrollTriggers for the whole document, its own included)
// (overlap: how many vh it's pulled up behind the screen above, see staging.css)
// (delay: its own animations starting this many vh later)
export function StagingValues({ className = "", overlap = 0, delay = 0 }) {
  return (
    <div
      data-staging-sections
      data-overlap={overlap ? "" : undefined}
      style={overlap ? { "--overlap": `${overlap}vh` } : undefined}
      className={`${aeonikPro.variable} relative isolate w-full ${className}`}
    >
      <Values delay={delay} />
    </div>
  );
}

export default function StagingSections({ className = "" }) {
  const rootRef = useRef(null);
  const lenis = useLenis();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    let debounce = 0;
    let lastHeight = -1;
    const timers = [];

    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        lastHeight = document.documentElement.scrollHeight;
        lenis?.resize();
        ScrollTrigger.refresh();
      });
    };

    // after mount, as staging does (rAF, 300 ms, 900 ms)
    refresh();
    timers.push(setTimeout(refresh, 300), setTimeout(refresh, 900));

    document.fonts?.ready.then(refresh).catch(() => {});
    if (document.readyState !== "complete") window.addEventListener("load", refresh, { once: true });

    // the document (or these sections) changing height: debounced, and only
    // when the height really moved since the last refresh
    const observer = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (document.documentElement.scrollHeight !== lastHeight) refresh();
      }, 150);
    });
    observer.observe(root);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(debounce);
      timers.forEach(clearTimeout);
      window.removeEventListener("load", refresh);
      observer.disconnect();
    };
  }, [lenis]);

  return (
    <div
      ref={rootRef}
      data-staging-sections
      className={`${aeonikPro.variable} relative isolate w-full ${className}`}
    >
      <Awards />
      <Testimonial />
      <NewFaq content={faqContent} />
    </div>
  );
}
