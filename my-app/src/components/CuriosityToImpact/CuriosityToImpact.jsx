"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useLenis } from "lenis/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import Header from "./Header";
import Intro from "./Intro";
import { Arrival, Capabilities, Contact, Studio, Vault, Work, WaveLines } from "./sections";
import { BEATS } from "./content";
import { DURATION, STATE, STORY, onStory, smooth, startStory } from "./story";
import "./curiosity.css";

// HYPERIUX — From Curiosity to Impact. One story on one page: a pinned
// opening (01–15) in which a single orange idea travels through a particle
// world — emerging, connecting, converging into a glass sculpture that
// design, engineering and experience shape, then dissolving into the light
// — and the white site (16–20) it lands in: work, capabilities, the Vault,
// the next idea. One canvas, one ScrollTrigger, one master timeline
// (story.js); Lenis scrolls the page (the root layout).

const World = dynamic(() => import("./world/World"), { ssr: false });

const query = (q) => ({
  subscribe: (cb) => {
    const m = window.matchMedia(q);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  },
  get: () => window.matchMedia(q).matches,
});
const MOTION = query("(prefers-reduced-motion: reduce)");
const MOBILE = query("(max-width: 767px)");
let webgl = null;
const hasWebGL = () => {
  if (webgl === null) {
    try {
      webgl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl = false;
    }
  }
  return webgl;
};
const never = () => () => {};

// the ink and paper of the page's chrome follow the world's light
const INK = [
  ["--cti-ink", [247, 247, 245], [17, 18, 20]],
  ["--cti-bg", [8, 9, 11], [247, 247, 245]],
  ["--cti-line", [60, 61, 64], [232, 232, 229]],
];
function setTheme(root, m) {
  INK.forEach(([name, a, b]) => root.style.setProperty(name, `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * m)).join(", ")})`));
}

// reduced motion, or no WebGL: the same story, told still
function StillOpening() {
  const lines = BEATS.filter((b) => b.caps).map((b) => b.caps.join(" ").replace("@", ""));
  return (
    <section data-still aria-label="From curiosity to impact" className="relative overflow-hidden bg-[#08090B] text-[#F7F7F5]">
      <div className="cti-glow absolute inset-0" aria-hidden="true" />
      <WaveLines className="absolute -right-[8%] top-[10%] h-[80%] w-[70%] opacity-70" count={30} />
      <div className="cti-container relative flex min-h-[100svh] flex-col justify-center py-32">
        <p className="cti-eyebrow text-[#FF5F1F]">Creative technology studio</p>
        <h1 className="cti-hero mt-5 max-w-[40rem]">
          We make digital experiences <span className="text-[#FF5F1F]">move.</span>
        </h1>
        <p className="cti-body mt-6 max-w-[26rem] text-white/60">Where design, technology and imagination converge to create experiences beyond the ordinary.</p>
      </div>
      <ol className="cti-container relative grid gap-6 pb-28 md:grid-cols-3">
        {lines.map((l) => (
          <li key={l} className="cti-caps border-t border-white/15 pt-5">
            {l}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function CuriosityToImpact() {
  const reduced = useSyncExternalStore(MOTION.subscribe, MOTION.get, () => false);
  const mobile = useSyncExternalStore(MOBILE.subscribe, MOBILE.get, () => false);
  const gl = useSyncExternalStore(never, hasWebGL, () => true);
  const live = gl && !reduced;
  const rootRef = useRef(null);
  const introRef = useRef(null);
  const arrivalRef = useRef(null);

  useLenis(ScrollTrigger.update);

  // the story's clock and its one trigger
  useEffect(() => {
    if (!live) return;
    const stop = startStory({ reduced, mobile });
    const st = ScrollTrigger.create({ trigger: introRef.current, start: "top top", endTrigger: arrivalRef.current, end: "center center" });
    STORY.trigger = st;
    const root = rootRef.current;
    let last = -1;
    const off = onStory(() => {
      const m = Math.round(smooth(0.3, 0.62, STATE.light) * 100) / 100;
      if (m !== last) setTheme(root, (last = m));
    });
    return () => {
      off();
      st.kill();
      if (STORY.trigger === st) STORY.trigger = null;
      stop();
    };
  }, [live, reduced, mobile]);

  // still: the chrome is light over the dark opening, ink after it
  useEffect(() => {
    if (live) return;
    const root = rootRef.current;
    const still = root.querySelector("[data-still]");
    const io = new IntersectionObserver(([e]) => setTheme(root, e.boundingClientRect.bottom > 80 ? 0 : 1), { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    io.observe(still);
    return () => io.disconnect();
  }, [live]);

  // content arriving as it is read
  useEffect(() => {
    const els = rootRef.current.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [live]);

  // fonts and images settle the layout: measure again
  useEffect(() => {
    let alive = true;
    const again = () => alive && ScrollTrigger.refresh();
    document.fonts?.ready.then(again);
    const t = setTimeout(again, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [live]);

  return (
    <div id="top" ref={rootRef} className="cti-root relative min-h-screen w-full bg-[#F7F7F5] antialiased">
      <Header />
      {live && <World mobile={mobile} />}
      <main>
        {live ? <Intro introRef={introRef} height={`calc(${DURATION.toFixed(2)} * var(--cti-unit))`} /> : <StillOpening />}
        <Arrival arrivalRef={arrivalRef} live={live} />
        <Work />
        <Capabilities />
        <Studio />
        <Vault />
        <Contact />
      </main>
    </div>
  );
}
