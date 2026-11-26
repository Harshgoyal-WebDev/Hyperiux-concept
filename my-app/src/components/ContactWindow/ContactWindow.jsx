"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { TRACK_VH, buildMasterTimeline, createStageState } from "./timeline";
import { hasWebGL2, pickTier } from "./quality";
import EnquirySection from "./contact/EnquirySection";

// THE WINDOW — the contact experience.
//   1. a pinned 3D scene the scroll plays through (scene/Experience.jsx, lazy):
//      two hands — one of orange particles, one of white wireframe — reach
//      for each other, touch at the fingertips, and their touch opens a
//      way through to the contact page (timeline.js: the seven stages)
//   2. the contact page (contact/EnquirySection.jsx, plain HTML), beneath the
//      scene: revealed through it as small discs of glass open out from the
//      touch (scene/Reveal.jsx — forging-vid's change) — held in place while
//      it opens, then scrolling on as a normal page
// Reduced motion: the scene held still at the touch, the page straight after.
// No WebGL: the page alone, with a still title.

const Experience = dynamic(() => import("./scene/Experience"), { ssr: false });

// what this device can do (read once on the client; null while rendering on the server)
let caps = null;
const REDUCED_Q = "(prefers-reduced-motion: reduce)";
function readCaps() {
  if (!caps) {
    const reduced = window.matchMedia(REDUCED_Q).matches;
    const webgl = hasWebGL2();
    caps = { mode: !webgl ? "flat" : reduced ? "reduced" : "full", tier: pickTier() };
  }
  return caps;
}
function subscribeCaps(cb) {
  const mq = window.matchMedia(REDUCED_Q);
  const on = () => {
    caps = null;
    cb();
  };
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}
const serverCaps = () => null;

// the still frame for reduced motion: the fingertips just met, the shockwave setting off
// (how far into the scroll the hero's words are gone: as the hands come in)
const HERO_OUT = 0.08;

// (how far through the portal's opening the page's text starts to come in:
// a quarter of the way, so it animates in as the glass goes on opening round it)
const REVEALED_AT = 0.25;

const STILL = { p: 0.5, distance: 1, approach: 1, anticipation: 1, touch: 1, portal: 0.05, contact: 0 };

function Header({ onSkip }) {
  return (
    <header className="nc-header pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-[4vw] pb-10 pt-7 max-md:px-6 max-md:pb-8 max-md:pt-5">
      <Link href="/" className="pointer-events-auto block focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[#ff5f00]" aria-label="Hyperiux home">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG wordmark */}
        <img src="/assets/icons/hyperiux-wordmark.svg" alt="" width={351} height={43} className="h-[0.95rem] w-auto opacity-90 invert" />
      </Link>
      <a
        href="#contact"
        onClick={onSkip}
        className="pointer-events-auto text-[0.68rem] uppercase tracking-[0.26em] text-[#f1f1f1]/60 transition-colors hover:text-[#ff5f00] focus-visible:text-[#ff5f00] focus-visible:outline-none"
      >
        Skip to contact <span aria-hidden>↗</span>
      </a>
    </header>
  );
}

export default function ContactWindow() {
  const c = useSyncExternalStore(subscribeCaps, readCaps, serverCaps);
  const mode = c?.mode ?? "pending";
  const headingId = useId();
  const [stage] = useState(createStageState);
  const [ready, setReady] = useState(false);
  const track = useRef(null);
  const sticky = useRef(null);
  const contact = useRef(null);
  const hint = useRef(null);
  const hero = useRef(null);
  const lenis = useLenis();
  const lenisRef = useRef(null);
  useEffect(() => {
    lenisRef.current = lenis ?? null;
    // (for testing in development: jump to any point of the scroll)
    if (process.env.NODE_ENV !== "production") window.__lenis = lenis ?? undefined;
  }, [lenis]);
  // (ScrollTrigger kept in step with the smooth scroll)
  useLenis(() => ScrollTrigger.update());

  // where the pinned scroll ends: the contact page fully open, at the top
  // (measured from the pinned stage's own height, not the window's: on
  // phones the window's height changes as the address bar comes and goes,
  // the stage's — 100svh — doesn't)
  const stageH = useCallback(() => sticky.current?.offsetHeight || window.innerHeight, []);
  const pinEnd = useCallback(() => {
    const t = track.current;
    return t ? t.offsetTop + t.offsetHeight - stageH() : 0;
  }, [stageH]);
  const toContact = useCallback(
    (e) => {
      e?.preventDefault?.();
      const y = mode === "full" ? pinEnd() : contact.current?.offsetTop ?? 0;
      if (lenisRef.current) lenisRef.current.scrollTo(y, { immediate: mode !== "full", duration: 2.4 });
      else window.scrollTo({ top: y, behavior: mode === "full" ? "smooth" : "auto" });
      // (keyboard users land on the heading)
      setTimeout(() => document.getElementById(headingId)?.focus({ preventScroll: true }), mode === "full" ? 2500 : 50);
    },
    [mode, pinEnd, headingId]
  );

  // the master timeline, the scroll cue and the contact page's opening
  useEffect(() => {
    if (mode !== "full") return;
    gsap.registerPlugin(ScrollTrigger);
    const tl = buildMasterTimeline({
      trigger: track.current,
      end: () => `+=${track.current.offsetHeight - stageH()}`,
      state: stage,
      onUpdate: (s) => {
        if (hint.current) hint.current.style.opacity = String(1 - Math.min(s.p * 25, 1));
        // (the hero's words: drifting up and away, blurring, as the hands come in)
        if (hero.current) {
          const k = Math.min(s.p / HERO_OUT, 1);
          hero.current.style.opacity = String(1 - k);
          hero.current.style.transform = k ? `translate3d(0, ${-k * 7}vh, 0)` : "";
          hero.current.style.filter = k ? `blur(${k * 8}px)` : "";
        }
      },
    });
    // The contact page, beneath the scene, opening through it (scene/PortalCut.jsx).
    // Until the pin lets go it is held at the top of the screen, under the
    // scene, so it opens in place rather than sliding in.
    const el = contact.current;
    let last = "";
    const tick = () => {
      if (!el) return;
      const end = pinEnd();
      const y = window.scrollY;
      // (fully open once the scroll is past the pin, whatever the scrub's lag)
      const open = y >= end - 1 ? 1 : stage.portal;
      const hold = y < end ? y - end : 0;
      // (its text waits until the portal is a quarter open, then animates in —
      // contact/EnquirySection.jsx; its links and fields only answer from then)
      const revealed = open >= REVEALED_AT;
      // (the header dark over the light page, once most of it is open)
      const light = open >= 0.7;
      const key = `${Math.round(hold)}|${revealed}|${light}`;
      if (key === last) return;
      last = key;
      el.style.transform = hold ? `translate3d(0, ${hold}px, 0)` : "";
      el.style.pointerEvents = revealed ? "" : "none";
      el.dataset.revealed = String(revealed);
      document.documentElement.dataset.ncLight = String(light);
    };
    gsap.ticker.add(tick);
    tick();
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("load", refresh);
      tl.scrollTrigger?.kill();
      tl.kill();
      el.style.transform = "";
      el.style.pointerEvents = "";
      delete el.dataset.revealed;
      delete document.documentElement.dataset.ncLight;
    };
  }, [mode, stage, pinEnd, stageH]);

  // (tabbing into the page before it has opened: carried straight to it)
  const onFocusContact = useCallback(() => {
    if (mode !== "full" || window.scrollY >= pinEnd() - 1) return;
    const y = pinEnd();
    if (lenisRef.current) lenisRef.current.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, [mode, pinEnd]);

  const onReady = useCallback(() => setReady(true), []);

  if (mode === "pending") {
    return <main className="min-h-svh bg-[#050505]" />;
  }

  if (mode !== "full") {
    return (
      <main className="overflow-x-clip bg-[#050505] text-[#f1f1f1]">
        <Header onSkip={toContact} />
        <section aria-label="The Window" className="relative h-svh overflow-hidden">
          {mode === "reduced" ? (
            <Experience stage={STILL} tier={c.tier} still onReady={onReady} />
          ) : (
            <div aria-hidden className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff5f00]/60 bg-[radial-gradient(circle,rgba(255,95,0,0.18),transparent_65%)] shadow-[0_0_120px_rgba(255,95,0,0.25)]" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-[8vh] flex flex-col items-center gap-3 text-center">
            <p className="text-[0.7rem] uppercase tracking-[0.3em] text-[#f1f1f1]/50">The Window</p>
            <p className="text-[clamp(1.2rem,2vw,1.6rem)] text-[#f1f1f1]/85">One fingertip connection. One way in.</p>
          </div>
        </section>
        <section id="contact" ref={contact} aria-labelledby={headingId}>
          <EnquirySection headingId={headingId} />
        </section>
      </main>
    );
  }

  return (
    <main className="overflow-x-clip bg-[#050505] text-[#f1f1f1]">
      <Header onSkip={toContact} />
      <section ref={track} aria-label="The Window: an interactive introduction. Scroll to play it, or skip to contact." style={{ height: `${TRACK_VH}svh` }} className="relative">
        <div ref={sticky} className="pointer-events-none sticky top-0 z-10 h-svh overflow-hidden">
          <Experience stage={stage} tier={c.tier} onReady={onReady} />
          {/* the hero: the opening words over the empty desert — in as the cover
              lifts (data-in), away as the scroll begins and the hands come in */}
          <div ref={hero} data-in={ready ? "true" : "false"} className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center px-6 text-center max-md:top-[20vh]">
            
            <h2 className="text-[clamp(2.6rem,6.6vw,7.4rem)] font-medium uppercase leading-[0.9] tracking-[-0.045em] text-[#f1f1f1]">
              <span className="nc-hline block">
                <span style={{ "--d": 1 }}>Every connection</span>
              </span>
              <span className="nc-hline block">
                <span style={{ "--d": 2 }}>
                  starts with a touch<span className="text-[#ff5f00]">.</span>
                </span>
              </span>
            </h2>
            <p className="nc-hero mt-8 max-w-[30rem] text-[1.05rem] leading-relaxed text-[#f1f1f1]/70" style={{ "--d": 3 }}>
              Have an idea worth building? Scroll, and reach out
            </p>
          </div>
          {/* the scroll cue, gone once the story starts */}
          <div ref={hint} aria-hidden className="pointer-events-none absolute bottom-[5vh] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
            <span className="text-[0.62rem] uppercase tracking-[0.34em] text-[#f1f1f1]/45">Scroll</span>
            <span className="relative block h-10 w-px overflow-hidden bg-[#f1f1f1]/12">
              <span className="absolute inset-x-0 top-0 block h-1/2 animate-[ncScrollCue_2.2s_ease-in-out_infinite] bg-[#ff5f00]" />
            </span>
          </div>
          {/* (until the hands are built) */}
          <div aria-hidden className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-[#050505] transition-opacity duration-1400 ${ready ? "opacity-0" : "opacity-100"}`}>
            <span className="h-px w-24 overflow-hidden bg-[#f1f1f1]/10">
              <span className="block h-px w-1/3 animate-[ncLoad_1.4s_ease-in-out_infinite] bg-[#ff5f00]" />
            </span>
          </div>
        </div>
      </section>
      {/* the contact page, waiting beneath the scene: held in place under it
          while the glass opens onto it, then scrolling on as the page */}
      <section id="contact" ref={contact} aria-labelledby={headingId} onFocus={onFocusContact} data-revealed="false" className="relative z-0 overflow-x-clip" style={{ marginTop: "-100svh" }}>
        <EnquirySection headingId={headingId} />
      </section>
      <style>{`
        /* the header over the light contact page: dark */
        .nc-header img, .nc-header a { transition: filter 0.5s ease, color 0.5s ease; }
        html[data-nc-light="true"] .nc-header img { filter: none; }
        html[data-nc-light="true"] .nc-header a { color: rgba(17, 17, 17, 0.7); }
        @keyframes ncScrollCue { 0% { transform: translateY(-100%); } 60%, 100% { transform: translateY(200%); } }
        @keyframes ncLoad { 0% { transform: translateX(-110%); } 100% { transform: translateX(330%); } }
        /* the hero's words: in, one after another (--d: its turn), as the cover lifts */
        .nc-hero { opacity: 0; transform: translateY(1.6rem); filter: blur(8px); transition: opacity 1s ease, transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), filter 1s ease; }
        .nc-hline { overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.08em; }
        .nc-hline > span { display: block; transform: translateY(110%); transition: transform 1.3s cubic-bezier(0.22, 1, 0.36, 1); }
        [data-in="true"] .nc-hero, [data-in="true"] .nc-hline > span { opacity: 1; transform: none; filter: none; transition-delay: calc(var(--d, 0) * 140ms + 450ms); }
        /* the contact page's text: hidden while the portal opens, then in, one
           piece after another (--d: its turn) once it has opened right across
           (data-revealed); gone again at once if the scroll goes back */
        [data-revealed] .nc-in { opacity: 0; transform: translateY(2.2rem); filter: blur(8px); transition: opacity 0.35s ease, transform 0.35s ease, filter 0.35s ease; }
        [data-revealed] .nc-line { display: block; overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.08em; }
        [data-revealed] .nc-line > span { display: block; transform: translateY(110%); transition: transform 0.35s ease; }
        [data-revealed="true"] .nc-in { opacity: 1; transform: none; filter: none; transition: opacity 0.9s ease, transform 1.1s cubic-bezier(0.22, 1, 0.36, 1), filter 0.9s ease; transition-delay: calc(var(--d, 0) * 110ms + 150ms); }
        [data-revealed="true"] .nc-line > span { transform: none; transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1); transition-delay: calc(var(--d, 0) * 110ms + 150ms); }
      `}</style>
    </main>
  );
}
