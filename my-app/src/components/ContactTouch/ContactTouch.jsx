"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import ContactSection from "./contact/ContactSection";
import { TRACK_VH, createStory, cutSpan, tell } from "./timeline";
import { C, NIGHT_EVENT, setNight } from "./tuning";

// The contact page (/contact-v2): one continuous page.
//   1. a pinned track: the desert (the about page's hero), the words over it;
//      scrolled, two hands reach in and their index fingers meet, the light
//      runs back over them, and from the centre glass discs open the frame
//      (scene/Stage.jsx);
//   2. the contact section — under the track's last screen all along, held
//      at the top of the screen while the discs open onto it, then scrolling
//      on as the page.
// The scroll is read every frame into `story` (timeline.js); the scene and
// the page read it. The canvas stops drawing once the discs have opened, and
// whenever the track is off screen.

const Stage = dynamic(() => import("./scene/Stage"), { ssr: false });
const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });

function readCaps() {
  let webgl = false;
  try {
    webgl = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl = false;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const low = Math.min(window.innerWidth, window.screen?.width || window.innerWidth) < 900 || (navigator.hardwareConcurrency || 4) < 6;
  const q = new URLSearchParams(window.location.search);
  return {
    full: webgl && !reduced,
    leva: q.has("leva") || [...q.values()].includes("leva"),
    // (the about page's own settings, a little lighter on the pixel ratio)
    quality: low ? { dpr: [1, 1.25], terrainSegments: 260, shadowMap: 1024 } : { dpr: [1, 1.25], terrainSegments: 420, shadowMap: 2048 },
  };
}

// day ↔ night (the scene's own night: tuning.js setNight)
function NightSwitch() {
  const [night, setLocal] = useState(C.night);
  useEffect(() => {
    const sync = (e) => setLocal(e.detail);
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, []);
  return (
    <button type="button" onClick={() => setNight(!C.night)} aria-pressed={night} className="pointer-events-auto cursor-pointer text-[0.85vw] uppercase tracking-[0.22em] opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none max-md:text-xs">
      {night ? "Day" : "Night"}
    </button>
  );
}

function Header({ dark, nightSwitch = false }) {
  const ink = dark ? "text-[#111111]" : "text-white";
  return (
    <header className={`pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-[5vw] pt-[2vw] transition-colors duration-500 max-md:px-6 max-md:pt-5 ${ink}`}>
      <Link href="/" aria-label="Hyperiux home" className="pointer-events-auto flex items-center gap-[0.7vw] max-md:gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
        <img src={dark ? "/hyperiux-icon-black.svg" : "/hyperiux-icon-white.svg"} alt="" className="h-[1.9vw] w-auto max-md:h-7" />
        <span className="text-[1.1vw] tracking-[0.06em] max-md:text-base">HYPERIUX</span>
      </Link>
      <div className="flex items-center gap-[2.2vw] max-md:gap-5">
        {nightSwitch && !dark && <NightSwitch />}
        <a href="#contact" className="pointer-events-auto text-[0.85vw] uppercase tracking-[0.22em] opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none max-md:text-xs">
          Skip to the form
        </a>
      </div>
    </header>
  );
}

function Hero({ heroRef }) {
  return (
    <div ref={heroRef} className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end px-[5vw] pb-[12vh] text-white max-md:px-6 max-md:pb-[16vh]">
      <p className="mb-[1.4vw] text-[0.85vw] uppercase tracking-[0.3em] text-white/70 max-md:mb-4 max-md:text-xs">Contact</p>
      <h1 className="max-w-[60vw] text-[6vw] font-normal leading-[0.98] tracking-[-0.03em] max-md:max-w-full max-md:text-[12vw]">
        Every connection starts with a touch.
      </h1>
      <p className="mt-[1.6vw] max-w-[30vw] text-[1.1vw] leading-relaxed text-white/80 max-md:mt-5 max-md:max-w-full max-md:text-base">Have an idea worth building? Scroll, and reach out.</p>
      <div aria-hidden className="absolute bottom-[5vh] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span className="text-[0.7vw] uppercase tracking-[0.34em] text-white/60 max-md:text-[10px]">Scroll</span>
        <span className="relative block h-10 w-px overflow-hidden bg-white/20">
          <span className="absolute inset-x-0 top-0 block h-1/2 animate-[ctScroll_2.2s_ease-in-out_infinite] bg-[#ff5f00]" />
        </span>
      </div>
    </div>
  );
}

export default function ContactTouch() {
  const headingId = useId();
  const [caps, setCaps] = useState(null);
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [done, setDone] = useState(false);
  const [dark, setDark] = useState(false);
  const story = useMemo(() => createStory(), []);
  const pointer = useMemo(() => ({ x: 0, y: 0 }), []);
  const track = useRef(null);
  const contact = useRef(null);
  const heroRef = useRef(null);
  // how far into the story the track runs: to the cut's end (read as the page
  // is drawn — a change to the cut in the panel takes on the next load)
  const [endAt0] = useState(() => cutSpan()[1]);
  const endAt = useRef(endAt0);

  useEffect(() => {
    // (read once on the client: the canvas and its quality depend on it)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaps(readCaps());
  }, []);

  // the pointer, anywhere on the page (the camera's parallax)
  useEffect(() => {
    const move = (e) => {
      if (e.pointerType === "touch") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [pointer]);

  // the track on screen or not (nothing drawn while it isn't)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "50px" });
    io.observe(el);
    return () => io.disconnect();
  }, [caps]);

  // every frame: the scroll into the story; the hero's words; the contact
  // section held at the top of the screen under the pinned track
  useEffect(() => {
    if (!caps?.full) return;
    let raf;
    let last = { done: null, dark: null };
    const tick = () => {
      const el = track.current;
      if (el) {
        const vh = window.innerHeight;
        const top = el.getBoundingClientRect().top;
        const length = Math.max(el.offsetHeight - vh, 1);
        // (the track ends as the cut does: its story runs only that far)
        tell(Math.min(Math.max(-top / length, 0), 1) * endAt.current, story);
        if (heroRef.current) {
          heroRef.current.style.opacity = String(story.hero);
          heroRef.current.style.transform = `translate3d(0, ${(1 - story.hero) * -40}px, 0)`;
        }
        // (its top is the track's last screen: until the track lets go, it
        // stays at the top of the screen — the discs open onto it in place)
        // (its own top sits (top + length) below the screen's until then:
        // lifted by exactly that; past the track's end, left in its place)
        if (contact.current) {
          const hold = Math.max(0, top + length);
          contact.current.style.transform = hold > 0 ? `translate3d(0, ${-hold}px, 0)` : "";
        }
        const dk = story.cut > 0.55;
        if (story.done !== last.done) setDone((last.done = story.done));
        if (dk !== last.dark) setDark((last.dark = dk));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [caps, story]);

  if (!caps) return <main className="min-h-svh bg-[#0b0706]" />;

  // (no WebGL, or reduced motion: the words, then the contact section)
  if (!caps.full) {
    return (
      <main className="bg-[#fefefe]">
        <Header dark={false} />
        <section className="relative flex h-svh items-end bg-[radial-gradient(ellipse_at_70%_70%,#7a4a2a_0%,#2a170d_55%,#0b0706_100%)]">
          <Hero heroRef={heroRef} />
        </section>
        <section id="contact" aria-labelledby={headingId}>
          <ContactSection headingId={headingId} />
        </section>
      </main>
    );
  }

  return (
    <main className="bg-[#fefefe]">
      {caps.leva && <TuningPanel />}
      <Header dark={dark} nightSwitch />
      <section ref={track} aria-label="Two hands reach out and touch; scroll to play it, or skip to the form." className="relative z-10" style={{ height: `${100 + (TRACK_VH - 100) * endAt0}svh` }}>
        <div className="pointer-events-none sticky top-0 h-svh w-full overflow-hidden">
          <div className="absolute inset-0">
            <Stage story={story} pointer={pointer} quality={caps.quality} running={onScreen && !done} onReady={() => setReady(true)} />
          </div>
          <Hero heroRef={heroRef} />
          {/* (until the scene has been drawn) */}
          <div aria-hidden className={`absolute inset-0 z-20 flex items-center justify-center bg-[#0b0706] transition-opacity duration-1000 ${ready ? "opacity-0" : "opacity-100"}`}>
            <span className="h-px w-24 overflow-hidden bg-white/10">
              <span className="block h-px w-1/3 animate-[ctLoad_1.4s_ease-in-out_infinite] bg-[#ff5f00]" />
            </span>
          </div>
        </div>
      </section>
      <section ref={contact} id="contact" aria-labelledby={headingId} className="relative z-0" style={{ marginTop: "-100svh" }}>
        <ContactSection headingId={headingId} />
      </section>
      <style>{`
        @keyframes ctScroll { 0% { transform: translateY(-100%); } 60%, 100% { transform: translateY(200%); } }
        @keyframes ctLoad { 0% { transform: translateX(-110%); } 100% { transform: translateX(330%); } }
      `}</style>
    </main>
  );
}
