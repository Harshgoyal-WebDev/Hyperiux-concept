"use client";

import { Component, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Scene from "./scene/Scene";
import { AssetBadge, HeroOverlay, OasisCopy } from "./Overlays";
import WhiteWebsite from "./WhiteWebsite";
import StaticJourney from "./StaticJourney";
import dynamic from "next/dynamic";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { SOUND_EVENT, setSound, soundOn, soundWanted } from "./audio";
import Loader, { LoaderCover } from "./Loader";
import { Q, QUALITY_EVENT } from "./quality";
import { blastedAt, buildMasterTimeline, cameraSetsOffAt, createJourneyState, deriveBreak } from "./timeline";
import { deriveReveal } from "./world/oasisCamera";
import { paceAt } from "./pace";
import { ASSETS, CUT_TO, JOURNEY_VH, P, SCROLL_VH, STATES, detectTier, detectWebGL, zoneAt } from "./config";
import { CTA, OASIS_LINES } from "./content";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Probes for the Blender forging asset. Next serves an HTML 404 page for
// missing files, so the content-type is checked too.
function useForgeAsset() {
  const [state, setState] = useState(null); // { ok } | { problem }
  useEffect(() => {
    let alive = true;
    const isFile = (r) => r.ok && !(r.headers.get("content-type") || "").includes("text/html");
    fetch(ASSETS.forgeGlb, { method: "HEAD" })
      .then(isFile)
      .catch(() => false)
      .then((ok) => {
        if (!alive) return;
        if (!ok) console.error(`[forging-vid] ${ASSETS.forgeGlb} not found; the slab is not rendered.`);
        setState(ok ? { ok: true } : { problem: { kind: "missing-file" } });
      });
    return () => {
      alive = false;
    };
  }, []);
  return [state, setState];
}

// Header → journey: jump to the forged hero. Cancelled by the journey when
// it handles it; otherwise the header scrolls on to the site.
const SKIP_EVENT = "forging-vid:skip";

// A broken GLB shouldn't take the whole canvas down.
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[forging-vid] 3D scene failed", error);
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Client capabilities, read once. null on the server so hydration matches.
// the Leva tuning panels: loaded (and shown) only with ?leva
const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });

let clientEnv = null;
const noopSubscribe = () => () => {};
function getClientEnv() {
  if (!clientEnv) {
    clientEnv = {
      webgl: detectWebGL(),
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      tier: detectTier(),
      debug: new URLSearchParams(window.location.search).has("debug"),
      // the Leva tuning panels: only with ?leva (or ?=leva) in the address —
      // never on the plain page
      stats: (() => {
        const q = new URLSearchParams(window.location.search);
        return q.has("leva") || [...q.values()].includes("leva");
      })(),
    };
  }
  return clientEnv;
}

// The page's set scroll pace on the site's (shared) Lenis, the whole way
// through. By default (T.scrollFixedPace) the wheel only says which way: as
// long as it keeps turning (or the trackpad keeps sending), the page moves
// at one steady speed — T.scrollPace vh per second — easing up
// to it and gently to a stop after the last input; a hard flick goes no
// faster, a light touch no slower. T.scrollBoost quicker from the rock
// breaking off the logo until the cut lands in the valley. (Off: each wheel
// step eases in over T.scrollDuration, capped at T.scrollStep, never more
// than T.scrollLead screens ahead.) Touch scrolling is left as it is.
// Returns the undo (the site's own settings back).
function paceScroll(lenis, J) {
  const o = lenis.options;
  const saved = { duration: o.duration, easing: o.easing, virtualScroll: o.virtualScroll };
  o.duration = T.scrollDuration;
  o.easing = (t) => 1 - Math.pow(1 - t, 3);
  const s = { dir: 0, last: -1e9, v: 0, raf: 0, prev: 0, y: 0 };
  // the pace through each stretch: evened out over the whole way (pace.js:
  // quicker where little moves on screen, slower where much does — so the
  // picture changes at one rate from start to end), × the hand trims
  // T.paceApproach (rock breaking → cut landed) and T.paceValley (cut →
  // the beam on into the core)
  const boost = () => {
    const p = J.progress;
    let k = paceAt(p);
    if (p >= cameraSetsOffAt() && p < CUT_TO()) k *= T.paceApproach;
    else if (p >= CUT_TO() && p < T.tlBeamToTreeStart) k *= T.paceValley;
    return k;
  };
  // the steady drive: one speed while input keeps coming, eased in and out
  const tick = (now) => {
    // (real time, so the pace holds even when frames come slower)
    const dt = Math.min((now - s.prev) / 1000, 0.15);
    s.prev = now;
    const held = now - s.last < T.scrollHold * 1000;
    const want = held ? s.dir * T.scrollPace * boost() * (window.innerHeight / 100) : 0;
    const tau = Math.max(held ? T.scrollRampIn : T.scrollRampOut, 0.01);
    s.v += (want - s.v) * (1 - Math.exp(-dt / tau));
    if (!held && Math.abs(s.v) < 4) {
      s.v = 0;
      s.raf = 0;
      return;
    }
    s.y = Math.max(0, Math.min(lenis.limit, s.y + s.v * dt));
    if (!lenis.isStopped) lenis.scrollTo(s.y, { immediate: true });
    s.raf = requestAnimationFrame(tick);
  };
  o.virtualScroll = (data) => {
    if (!data.event.type.includes("wheel")) return true;
    if (T.scrollFixedPace) {
      // (stopped — the loader, a skip — Lenis holds the page itself)
      if (lenis.isStopped || lenis.isLocked || data.event.ctrlKey) return true;
      // (taken over here: the page doesn't scroll by itself as well)
      if (data.event.cancelable) data.event.preventDefault();
      if (Math.abs(data.deltaY) < 0.5) return false;
      const dir = Math.sign(data.deltaY);
      s.last = performance.now();
      // (a turn the other way: it eases through to it)
      s.dir = dir;
      if (!s.raf) {
        s.prev = performance.now();
        s.y = lenis.animatedScroll;
        s.raf = requestAnimationFrame(tick);
      }
      return false;
    }
    o.duration = T.scrollDuration;
    let d = Math.max(-T.scrollStep, Math.min(T.scrollStep, data.deltaY));
    d *= boost();
    const ahead = lenis.targetScroll - lenis.animatedScroll;
    const max = window.innerHeight * T.scrollLead;
    if (Math.abs(ahead + d) > max) d = Math.sign(ahead + d) * max - ahead;
    data.deltaY = d;
    return true;
  };
  return () => {
    cancelAnimationFrame(s.raf);
    Object.assign(o, saved);
  };
}

export default function ForgingVid() {
  const env = useSyncExternalStore(noopSubscribe, getClientEnv, () => null);

  if (env && !env.webgl) {
    return (
      <main className="w-full">
        <Header />
        <StaticJourney />
        <WhiteWebsite />
      </main>
    );
  }
  if (env?.reduced) {
    return (
      <main className="w-full">
        <Header />
        <ReducedStill tier={env.tier} />
        <WhiteWebsite />
      </main>
    );
  }
  return (
    <main className="w-full">
      {/* (until the client knows its setup, the server's loader covers the page) */}
      {!env && <LoaderCover />}
      <Header nightToggle />
      <Journey env={env} />
      <WhiteWebsite />
    </main>
  );
}

// Day / night switch for the 3D journey (after public/mode.mov): a glassy
// pill with a thin amber outline. By day its knob sits on the right — a soft
// peach sun — over warm translucent glass; by night it slides to the left —
// a deeper orange moon — over a dark track with a few stars twinkling in it.
// As it slides the icon morphs: the sun's rays draw in, its core swells and
// a shadow slides across it, carving the crescent (and back). A small label
// under it on hover. Sized in em: it scales with the header's type.
const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
function SunMoonIcon({ night }) {
  const id = useId();
  const t = (props) => `${props} 600ms ${EASE}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[1em] w-[1em] overflow-visible">
      <defs>
        <mask id={`${id}-bite`}>
          <rect x="-4" y="-4" width="32" height="32" fill="white" />
          {/* the shadow that carves the crescent: off to the top right by
              day, across the disc by night */}
          <circle
            cx="17"
            cy="8"
            r="7"
            fill="black"
            style={{ transform: night ? "translate(0, 0)" : "translate(9px, -9px)", transition: t("transform") }}
          />
        </mask>
      </defs>
      {/* the rays (sun), drawing in to nothing as night comes */}
      <g
        style={{
          transformOrigin: "12px 12px",
          transform: night ? "rotate(-45deg) scale(0.4)" : "rotate(0deg) scale(1)",
          opacity: night ? 0 : 1,
          transition: `${t("transform")}, opacity 350ms ${EASE}`,
        }}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="12" y1="2.6" x2="12" y2="4.6" transform={`rotate(${a} 12 12)`} />
        ))}
      </g>
      {/* the core: a small sun, swelling into the moon's disc */}
      <circle
        cx="12"
        cy="12"
        r="4.6"
        fill="currentColor"
        mask={`url(#${id}-bite)`}
        style={{ transformOrigin: "12px 12px", transform: night ? "scale(1.55)" : "scale(1)", transition: t("transform") }}
      />
    </svg>
  );
}

function NightToggle({ light = false }) {
  const [night, setLocal] = useState(T.night);
  useEffect(() => {
    const sync = (e) => setLocal(e.detail);
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, []);
  const label = night ? "Switch to day" : "Switch to night";
  return (
    <div className="group relative">
      <style>{"@keyframes ncTwinkle{0%,100%{opacity:.9}50%{opacity:.25}}"}</style>
      <button
        type="button"
        role="switch"
        aria-checked={night}
        aria-label="Night mode"
        onClick={() => setNight(!night)}
        className="relative block h-[2.05em] w-[4.5em] cursor-pointer overflow-hidden rounded-full border-[1.5px] backdrop-blur-md transition-[background,border-color,box-shadow] duration-700 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2a66a]"
        style={{
          borderColor: light ? "rgba(17,17,17,0.45)" : night ? "rgba(232,150,92,0.85)" : "rgba(244,170,108,0.95)",
          background: night
            ? "linear-gradient(90deg, rgba(42,36,46,0.92), rgba(34,32,44,0.88))"
            : "linear-gradient(90deg, rgba(255,214,170,0.08), rgba(255,196,140,0.32))",
          boxShadow: night ? "inset 0 1px 6px rgba(0,0,0,0.45)" : "inset 0 1px 8px rgba(255,214,170,0.25), 0 0 14px rgba(255,170,100,0.18)",
        }}
      >
        {/* the night's stars, twinkling in the dark track */}
        {[
          ["58%", "36%", 0],
          ["78%", "24%", 0.7],
          ["70%", "66%", 1.4],
        ].map(([left, top, delay], i) => (
          <span
            key={i}
            aria-hidden
            className="absolute h-[0.14em] w-[0.14em] rounded-full bg-white transition-opacity duration-700 motion-reduce:transition-none"
            style={{
              left,
              top,
              opacity: night ? 0.9 : 0,
              animation: night ? `ncTwinkle 2.4s ease-in-out ${delay}s infinite` : "none",
            }}
          />
        ))}
        {/* the knob: the sun on the right by day, the moon on the left by night */}
        <span
          aria-hidden
          className="absolute top-1/2 left-[0.22em] flex h-[1.55em] w-[1.55em] items-center justify-center rounded-full text-[#111] motion-reduce:transition-none"
          style={{
            transform: `translate(${night ? "0em" : "2.43em"}, -50%)`,
            background: night
              ? "radial-gradient(circle at 40% 35%, #f4b277, #e8975a)"
              : "radial-gradient(circle at 40% 35%, #ffe4bd, #ffc37e)",
            boxShadow: night ? "0 2px 8px rgba(0,0,0,0.45)" : "0 0 12px rgba(255,190,120,0.65), 0 2px 6px rgba(0,0,0,0.2)",
            transition: `transform 600ms ${EASE}, background 600ms ${EASE}, box-shadow 600ms ${EASE}`,
          }}
        >
          <SunMoonIcon night={night} />
        </span>
      </button>
      {/* the label under it, on hover / focus */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[calc(100%+0.6em)] left-1/2 -translate-x-1/2 rounded-[0.45em] bg-[#1a1a1f]/85 px-[0.65em] py-[0.3em] text-[0.82em] whitespace-nowrap text-white opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-opacity duration-200 [text-shadow:none] group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}

// Sound on / off. Browsers need a user gesture before audio can start, so
// a visitor who turned sound on before gets it back on their first click
// or key press.
function SoundToggle({ light = false }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = (e) => setOn(e.detail);
    window.addEventListener(SOUND_EVENT, sync);
    if (!soundWanted()) return () => window.removeEventListener(SOUND_EVENT, sync);
    const resume = () => !soundOn() && setSound(true);
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener(SOUND_EVENT, sync);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);
  const label = on ? "Sound off" : "Sound on";
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSound(!on);
        }}
        aria-pressed={on}
        aria-label="Sound"
        className={`relative flex h-[2.05em] w-[2.05em] cursor-pointer items-center justify-center rounded-[0.18em] border transition-[border-color,background] duration-300 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 ${
          light
            ? "border-[#111]/35 bg-[#111]/5 text-[#111] hover:border-[#111]/60 focus-visible:outline-[#111]"
            : "border-white/25 text-white hover:border-white/45 focus-visible:outline-white"
        }`}
        style={light ? undefined : { background: "linear-gradient(180deg, rgba(28,24,24,0.9), rgba(14,12,12,0.92))" }}
      >
        <SoundWave on={on} />
      </button>
      {/* the label under it, on hover / focus (as the night switch's) */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[calc(100%+0.6em)] left-1/2 -translate-x-1/2 rounded-[0.45em] bg-[#1a1a1f]/85 px-[0.65em] py-[0.3em] text-[0.82em] whitespace-nowrap text-white opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-opacity duration-200 [text-shadow:none] group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}

// The sound button's mark (after public/sound.mov): on, a sine wave, always
// moving — running along and breathing; off, it calms down to a flat line
// (dimmer while it changes), and swells back into the wave when turned on.
// Drawn each frame while it moves (no React state: the path is set directly).
function SoundWave({ on }) {
  const path = useRef(null);
  const amp = useRef(on ? 1 : 0);
  const target = useRef(on ? 1 : 0);
  useEffect(() => {
    target.current = on ? 1 : 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let phase = 0;
    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      // the amplitude easing to its target (on 1, off 0)
      const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
      amp.current += (target.current - amp.current) * k;
      if (Math.abs(target.current - amp.current) < 0.002) amp.current = target.current;
      if (!reduced) phase += dt * 3.2 * amp.current;
      // (breathing a little while it plays)
      const a = amp.current * (reduced ? 1 : 0.82 + 0.18 * Math.sin(now / 1000 * 1.7));
      let d = "";
      for (let i = 0; i <= 32; i++) {
        const u = i / 32;
        const x = 4 + u * 16;
        const y = 12 - a * 4.4 * Math.sin(u * Math.PI * 2 * 1.25 - phase) * (0.35 + 0.65 * Math.sin(u * Math.PI));
        d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      if (path.current) {
        path.current.setAttribute("d", d);
        // dimmer while it changes, full once settled (on or off)
        const settling = Math.abs(target.current - amp.current);
        path.current.style.opacity = String(1 - Math.min(settling * 1.6, 0.45));
      }
      // keep drawing while it plays or is still changing
      if (target.current > 0 || amp.current > 0.0005) raf = requestAnimationFrame(draw);
      else raf = 0;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[1.3em] w-[1.3em] overflow-visible">
      <path ref={path} d="M4 12L20 12" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// True once the header sits over the white site below the journey. The
// header switches to dark type and the black logo there (no blend-mode
// trick).
function useOverLight() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const check = () => {
      const site = document.querySelector("[data-white-site]");
      setLight(!!site && site.getBoundingClientRect().top <= 80);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  return light;
}

function Header({ nightToggle = false }) {
  const lenis = useLenis();
  const light = useOverLight();
  const skip = () => {
    // the journey takes it (straight to the forged logo) if it's running
    if (!window.dispatchEvent(new Event(SKIP_EVENT, { cancelable: true }))) return;
    const site = document.querySelector("[data-journey-end]");
    if (!site) return;
    const y = site.getBoundingClientRect().top + window.scrollY;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };
  return (
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-[5vw] py-[2.2vw] transition-colors duration-500 max-[33.875rem]:px-[6vw] max-[33.875rem]:py-5 ${light ? "text-[#111]" : "text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.35)]"}`}
    >
      <Link href="/" className="pointer-events-auto flex items-center gap-[0.7vw] max-[33.875rem]:gap-2" aria-label="Hyperiux home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light ? "/hyperiux-icon-black.svg" : "/hyperiux-icon-white.svg"} alt="" className="h-[2.1vw] w-auto max-[64rem]:h-7" />
        <span className="font-[family-name:var(--font-aeonikpro)] text-[1.15vw] tracking-[0.06em] max-[64rem]:text-base">HYPERIUX</span>
      </Link>
      <div className="pointer-events-auto flex items-center gap-[2vw] font-[family-name:var(--font-aeonikpro)] text-[0.95vw] max-[64rem]:text-sm max-[33.875rem]:gap-4">
        {nightToggle && <SoundToggle light={light} />}
        {nightToggle && <NightToggle light={light} />}
        <button type="button" onClick={skip} className="cursor-pointer opacity-70 transition-opacity hover:opacity-100">
          Skip intro
        </button>
        <a
          href={`mailto:${CTA.email}`}
          className={`rounded-full border px-[1.3vw] py-[0.55vw] transition-colors max-[64rem]:px-4 max-[64rem]:py-2 ${
            light ? "border-[#111]/40 hover:bg-[#111] hover:text-white" : "border-white/60 hover:bg-white hover:text-black"
          }`}
        >
          Start a Project
        </a>
      </div>
    </header>
  );
}

// Scroll driver tuning.
const EPS = 0.001; // p: "at" a zone boundary
const TRAVEL_VH = JOURNEY_VH - 100; // scroll travel of the pinned section
// Keys that scroll the page natively; ignored while the event auto-scrolls.
const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);
const linear = (t) => t;
// The loader (Loader.jsx) holds the page until the scene is in; a review
// frame (?p=) skips it.
const wantsLoader = () => typeof window !== "undefined" && !new URLSearchParams(window.location.search).has("p");

function Journey({ env }) {
  // Plain state object written by the GSAP timeline, read by the scene.
  // Behind the loader the beam's race waits and the camera waits far off.
  const [J] = useState(() => {
    const j = createJourneyState();
    if (wantsLoader()) {
      j.enterAt = Infinity;
      j.arrive = 0;
    }
    return j;
  });
  const withLoader = useState(wantsLoader)[0];
  const [entered, setEntered] = useState(() => !withLoader); // clicked in (or no loader)
  const [settled, setSettled] = useState(() => !withLoader); // ...and the camera has (mostly) arrived: the scroll is free
  const [asset, setAsset] = useForgeAsset();
  const lenis = useLenis();

  const sectionRef = useRef(null);
  const heroRef = useRef(null);
  const hudRef = useRef(null);
  const copyRefs = useRef([]);
  const copyAnims = useRef([]); // each line's text animation (below)
  const heroAnim = useRef(null); // ...and the hero's
  const heroIn = useRef({ v: 0 }); // how far the hero's words have come in (its entrance)

  const [mounted, setMounted] = useState(true); // canvas mounted (GPU resources alive)
  const [rendering, setRendering] = useState(true); // frameloop running
  const [dpr, setDpr] = useState(null);
  // the live quality's share of the device's pixel ratio (quality.js)
  useEffect(() => {
    if (!env?.tier) return;
    const sync = () => setDpr(Math.min(window.devicePixelRatio || 1, env.tier.dpr[1]) * Q.dpr);
    window.addEventListener(QUALITY_EVENT, sync);
    return () => window.removeEventListener(QUALITY_EVENT, sync);
  }, [env]);
  const [resizeKey, setResizeKey] = useState(0);

  // Rebuild the timeline when the panel changes a value it is built from
  useEffect(() => {
    let t;
    const retime = () => {
      clearTimeout(t);
      t = setTimeout(() => setResizeKey((k) => k + 1), 200);
    };
    window.addEventListener("forging-vid:retime", retime);
    return () => {
      clearTimeout(t);
      window.removeEventListener("forging-vid:retime", retime);
    };
  }, []);

  // Rebuild the timeline after resizes (the pinned section's length changes).
  useEffect(() => {
    let t;
    let lastW = window.innerWidth;
    const onResize = () => {
      if (Math.abs(window.innerWidth - lastW) < 2) return; // ignore mobile URL-bar height jitter
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(() => setResizeKey((k) => k + 1), 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Pause rendering when the hero is off screen. On the low tier the GPU is
  // released entirely when it is far out of view (rebuilt on approach);
  // otherwise the scene is kept, so scrolling back up from the site lands
  // straight in the journey as it was, with nothing to rebuild.
  const releaseOffscreen = env?.tier?.name === "low";
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let unmountTimer;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(unmountTimer);
        setRendering(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
        else if (releaseOffscreen) unmountTimer = setTimeout(() => setMounted(false), 1500);
      },
      { rootMargin: "100% 0px 100% 0px" }
    );
    io.observe(el);
    return () => {
      clearTimeout(unmountTimer);
      io.disconnect();
    };
  }, [releaseOffscreen]);

  // The words' animation (GSAP SplitText), on the hero's heading and
  // paragraph and on each of the oasis's lines: the heading character by
  // character, each coming out of a blur in its own random turn; the
  // paragraph word by word, in reading order. Each is one paused timeline
  // whose progress the scroll sets (the follow loop below), so the words come
  // in with the scroll and go again — the same random blur, played back —
  // as it scrolls on (and the hero's first comes in after the loader).
  // (Split once the fonts are in, so the lines break where they will stay.)
  useEffect(() => {
    let alive = true;
    const splits = [];
    const words = (el, from) => {
      const tl = gsap.timeline({ paused: true });
      const heading = el.querySelectorAll(from.heading);
      const body = el.querySelector(from.body);
      if (heading.length) {
        const sp = SplitText.create(heading, { type: "words,chars" });
        splits.push(sp);
        // (each character its own GPU layer: moved, faded and blurred by the
        // compositor rather than repainted — with its shadow — every frame,
        // which stalled the WebGL frame behind it for hundreds of ms)
        gsap.set(sp.chars, { willChange: "transform, opacity, filter", force3D: true });
        tl.from(sp.chars, { opacity: 0, filter: "blur(9px)", yPercent: 18, force3D: true, duration: 0.8, ease: "power3.out", stagger: { each: 0.028, from: "random" } }, 0);
      }
      if (body) {
        const sp = SplitText.create(body, { type: "words" });
        splits.push(sp);
        gsap.set(sp.words, { willChange: "transform, opacity, filter", force3D: true });
        tl.from(sp.words, { opacity: 0, filter: "blur(6px)", y: 10, force3D: true, duration: 0.6, ease: "power2.out", stagger: 0.04 }, 0.3);
      }
      return tl;
    };
    const build = () => {
      if (!alive) return;
      if (heroRef.current) heroAnim.current = { tl: words(heroRef.current, { heading: "[data-hero-line]", body: "[data-hero-body]" }) };
      copyRefs.current.forEach((el, i) => {
        if (el) copyAnims.current[i] = { tl: words(el, { heading: '[data-split="heading"]', body: '[data-split="body"]' }) };
      });
    };
    if (document.fonts?.ready) document.fonts.ready.then(build);
    else build();
    return () => {
      alive = false;
      copyAnims.current.forEach((a) => a?.tl.kill());
      copyAnims.current = [];
      heroAnim.current?.tl.kill();
      heroAnim.current = null;
      splits.forEach((sp) => sp.revert());
    };
  }, []);

  // Hero entrance (time-based, independent of scroll): the copy reveals.
  // (The beam's own load-in race runs in ForgeBeam, on the page clock.)
  // (after the loader: once the camera has mostly arrived)
  useGSAP(
    () => {
      if (!entered) return;
      const lead = withLoader ? T.arriveDuration * 0.45 : 0;
      // (its words: the scroll loop plays them in as this goes 0 → 1)
      gsap.fromTo(heroIn.current, { v: 0 }, { v: 1, duration: 2.4, ease: "none", delay: lead + 0.3 });
      gsap.from("[data-hero-reveal]", { autoAlpha: 0, y: 24, duration: 1.2, ease: "power3.out", delay: lead + 1.2 });
    },
    { scope: heroRef, dependencies: [J, entered, withLoader] }
  );

  // Behind the loader the page stays at the top, its scroll held; entering
  // starts the beam's race and brings the scene in from far off, and the
  // scroll is handed back as the camera settles.
  useEffect(() => {
    if (settled || !lenis) return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.stop();
    return () => lenis.start();
  }, [settled, lenis]);
  const enter = useCallback((opts = {}) => {
    startJourney(J);
    // (the click is the gesture the browser needs before sound can start;
    // "Enter quietly" goes in with it off — the header's toggle can still
    // turn it on)
    if (opts.quiet) setSound(false);
    else if (!soundOn()) setSound(true);
    setEntered(true);
    gsap.delayedCall(T.arriveDuration * 0.6, () => setSettled(true));
  }, [J]);

  const fadeRef = useRef(null);
  const lenisRef = useRef(null);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  // One set pace for the scroll (the site's Lenis is shared: this page's
  // settings go on while it is open and come off as it closes): every
  // wheel step eases in over the same fixed time; no single flick can throw
  // the page further than a set step, and it never runs more than a set
  // distance ahead of where it is — so no one can race through the story,
  // nor crawl through it. From the rock breaking off the logo until the cut
  // has landed in the valley, it goes T.scrollBoost (30%) quicker.
  // (off by default — the site's own Lenis scrolling as it is; T.scrollFixedPace
  // turns the set pace back on, from the next load)
  useEffect(() => (lenis && T.scrollFixedPace ? paceScroll(lenis, J) : undefined), [lenis, J]);

  // Scroll position of a scroll fraction p, in page pixels.
  const pToY = useCallback((p) => {
    const el = sectionRef.current;
    return el.offsetTop + clamp01(p) * (el.offsetHeight - window.innerHeight);
  }, []);

  // Shared with jump(): what is moving the page right now.
  //   auto   – the driver's own scroll ({ locked } while the event plays)
  //   guard  – a rail jump in flight (the driver waits for it to land)
  //   review – a ?p= / panel frame: held until the visitor scrolls
  const driver = useRef({ auto: null, guard: false, review: false, resync: false, dir: 1 });

  // Master timeline + scroll driver. The exact (fractional) Lenis scroll is
  // read every frame and followed with a short ease (not ScrollTrigger's
  // scrub, which reads the pixel-quantised browser scroll); the timeline's
  // progress is the scroll fraction p. The driver shapes the scroll itself:
  //   up to the core – free, smooth scrolling (the beam travels and climbs);
  //   past the core – the page takes over: it scrolls on (locked) through
  //     the impact until the blast is over (blastedAt), at a fixed
  //     pace, then hands back — the visitor scrolls the breakup themselves;
  //   scrolling back up before that point – it scrolls (locked) back to
  //     just short of the core.
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const tl = buildMasterTimeline(J, { hero: heroRef.current?.querySelector("[data-hero-cue]") });
      // Prime every segment: run it to the end and back to the start, so
      // each channel holds its own value wherever the scroll lands. (A fresh
      // timeline only writes the segments up to where it is first set; the
      // ones after kept whatever the last timeline left — after a rebuild
      // (a resize, coming back to the window, a panel change) scrolling back
      // showed the event's lit cracks, the core's heat and the glow at the
      // slab's foot while the beam was still out on the sand.)
      tl.progress(1);
      tl.progress(0);
      const st = ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom" });
      const D = driver.current;
      D.auto = null;

      let lastP = -1;
      const apply = (p) => {
        if (p === lastP) {
          deriveBreak(J); // (follows the breakup controls live)
          return;
        }
        lastP = p;
        tl.progress(p);
        deriveReveal(J, p);
        deriveBreak(J);
        if (hudRef.current) {
          const state = STATES.find((s) => p < s.end) || STATES.at(-1);
          const mode = D.auto ? "auto (locked)" : D.review ? "review" : "free";
          hudRef.current.textContent = `p ${p.toFixed(4)} · ${state.n} ${state.label} · ${mode}`;
        }
      };
      const progressOf = (y) => {
        const range = st.end - st.start;
        return range > 0 ? clamp01((y - st.start) / range) : st.progress;
      };
      const target = () => {
        const l = lenisRef.current;
        return progressOf(l ? (l.animatedScroll ?? l.scroll) : window.scrollY);
      };

      // The driver's own scroll. Locked runs ignore wheel / touch (Lenis
      // lock) and scroll keys (below) until they land.
      const run = (toP, seconds, locked, easing) => {
        const token = {};
        D.auto = { locked, token };
        const done = () => {
          if (D.auto?.token === token) D.auto = null;
        };
        const y = pToY(toP);
        const l = lenisRef.current;
        if (l) l.scrollTo(y, { duration: Math.max(seconds, 0.05), easing, lock: locked, force: true, onComplete: done });
        else {
          window.scrollTo({ top: y, behavior: "smooth" });
          setTimeout(done, seconds * 1000);
        }
      };

      const onInput = (e) => {
        if (D.auto?.locked) {
          if (e.type === "keydown" && SCROLL_KEYS.has(e.key)) e.preventDefault();
          return;
        }
        if (e.type === "keydown" && !SCROLL_KEYS.has(e.key)) return;
        D.review = false;
      };
      window.addEventListener("wheel", onInput, { passive: true });
      window.addEventListener("touchstart", onInput, { passive: true });
      window.addEventListener("touchmove", onInput, { passive: true });
      window.addEventListener("keydown", onInput);

      let lastGoal = -1;
      const drive = () => {
        if (D.auto || D.guard || D.review) return;
        const l = lenisRef.current;
        // where the scroll is heading, so the driver reacts as the core is
        // reached, not after the ease catches up
        const goal = progressOf(l ? l.targetScroll : window.scrollY);
        // after a jump / skip / review frame, start reading direction afresh
        if (D.resync) {
          D.resync = false;
          lastGoal = goal;
        }
        if (lastGoal >= 0 && Math.abs(goal - lastGoal) > 1e-6) D.dir = Math.sign(goal - lastGoal);
        lastGoal = goal;

        // from the beam reaching the core until the blast is over: always
        // auto-scrolled, forwards or back; from there the visitor scrolls on
        // themselves (the broken rock settles with their scroll)
        const freeAt = blastedAt();
        if (goal > P.core + EPS && goal < freeAt - EPS) {
          const forward = D.dir >= 0;
          const to = forward ? freeAt : P.core - 2 * EPS;
          const vhPerSecond = SCROLL_VH.event / (forward ? T.forgeDuration : T.forgeReverse);
          run(to, (Math.abs(to - goal) * TRAVEL_VH) / vhPerSecond, true, linear);
          return;
        }
      };

      let current = target();
      apply(current);
      const follow = (_time, deltaMs) => {
        drive();
        const goal = target();
        const diff = goal - current;
        if (diff !== 0) {
          // jumps land at once; scrolling is eased
          if (Math.abs(diff) > 0.04 || Math.abs(diff) < 1e-6) current = goal;
          else current += diff * (1 - Math.exp(-Math.min(deltaMs, 100) / 55));
        }
        apply(current);
        // (no post passes on the lowest tier: the change to the white site
        // is a plain fade there instead of the glass hexagons)
        if (fadeRef.current) {
          const w = Math.min(Math.max(J.outro, 0), 1);
          fadeRef.current.style.opacity = String(w * w * (3 - 2 * w));
        }
        // the hero's words: in after the loader, out (and back) with the
        // first of the scroll
        if (heroAnim.current) {
          const k = Math.min(heroIn.current.v, 1 - clamp01((current - 0.012) / 0.05));
          if (heroAnim.current.k !== k) {
            heroAnim.current.k = k;
            heroAnim.current.tl.progress(k);
          }
        }
        // the oasis's lines of copy, each over its stretch of the way
        OASIS_LINES.forEach((line, i) => {
          const el = copyRefs.current[i];
          if (!el) return;
          // (its words come and go with the scroll: their timeline's progress;
          // before they are split, the line just fades)
          const k = lineShown(line, current);
          const anim = copyAnims.current[i];
          const v = (anim ? "w" : "f") + k.toFixed(3);
          if (el.dataset.a === v) return;
          el.dataset.a = v;
          el.style.visibility = k > 0.001 ? "visible" : "hidden";
          el.style.opacity = anim ? "1" : k.toFixed(3);
          if (anim) anim.tl.progress(k);
        });
      };
      gsap.ticker.add(follow);

      // Skip intro: straight past the mark — down into the passage through
      // the dunes, the streaks running on ahead.
      const onSkip = (e) => {
        e.preventDefault();
        D.auto = null;
        D.guard = false;
        const y = pToY(zoneAt("passage", 0.02));
        const l = lenisRef.current;
        if (l) l.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
        current = target();
        D.resync = true;
        apply(current);
      };
      window.addEventListener(SKIP_EVENT, onSkip);

      // ?p=0.42 jumps straight to a scroll fraction and holds it there until
      // you scroll (review / screenshots).
      const review = parseFloat(new URLSearchParams(window.location.search).get("p"));
      const reviewTimer = Number.isFinite(review)
        ? setTimeout(() => {
            D.review = true;
            D.resync = true;
            // a review frame is a settled frame: the load-in race is over
            J.intro = 1;
            const l = lenisRef.current;
            if (l) l.scrollTo(pToY(review), { immediate: true, force: true });
            else window.scrollTo(0, pToY(review));
            current = target();
            apply(current);
          }, 120)
        : null;

      // (?debug: hold any scroll fraction from the console — measuring)
      if (window.location.search.includes("debug"))
        window.__seek = (p) => {
          D.review = true;
          D.resync = true;
          J.intro = 1;
          const l = lenisRef.current;
          if (l) l.scrollTo(pToY(p), { immediate: true, force: true });
          current = target();
          apply(current);
          return current;
        };

      ScrollTrigger.refresh();
      return () => {
        clearTimeout(reviewTimer);
        window.removeEventListener(SKIP_EVENT, onSkip);
        window.removeEventListener("wheel", onInput);
        window.removeEventListener("touchstart", onInput);
        window.removeEventListener("touchmove", onInput);
        window.removeEventListener("keydown", onInput);
        gsap.ticker.remove(follow);
        D.auto = null;
        st.kill();
        tl.kill();
      };
    },
    { scope: sectionRef, dependencies: [J, resizeKey, pToY] }
  );

  // Rail / panel jumps to a scroll fraction. A rail jump glides there and
  // the driver picks up where it lands (inside the impact it plays on to the
  // rock ground to sand); a panel scrub is held as a review frame.
  const jump = useCallback(
    (p, immediate = false) => {
      if (!sectionRef.current) return;
      const D = driver.current;
      const y = pToY(p);
      D.auto = null;
      if (immediate) {
        D.review = true;
        D.resync = true;
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
        return;
      }
      D.guard = true;
      D.review = false;
      const land = () => {
        D.guard = false;
        D.dir = 1;
        D.resync = true;
      };
      if (lenis) lenis.scrollTo(y, { duration: 2.2, lock: true, force: true, onComplete: land });
      else {
        window.scrollTo({ top: y, behavior: "smooth" });
        setTimeout(land, 2200);
      }
    },
    [lenis, pToY]
  );

  const onMissing = useCallback((parts) => setAsset({ problem: { kind: "incomplete", parts } }), [setAsset]);

  const tier = env?.tier;
  return (
    <section ref={sectionRef} data-journey className="group/journey relative w-full bg-[#0e0b09]" style={{ height: `${JOURNEY_VH}vh` }}>
      <div data-viewport className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0">
          {env && tier && mounted && asset && (
            <Canvas
              frameloop={rendering ? "always" : "never"}
              dpr={dpr ?? tier.dpr}
              shadows={tier.shadowMap > 0 ? "percentage" : false}
              gl={{ antialias: !tier.post, powerPreference: "high-performance", alpha: false }}
              camera={{ position: [J.camX, J.camY, J.camZ], fov: J.fov, near: 0.1, far: 4000 }}
              style={{ pointerEvents: "none" }}
              aria-hidden="true"
            >
              <color attach="background" args={["#0e0b09"]} />
              <SceneBoundary onError={(error) => setAsset({ problem: { kind: "incomplete", parts: [String(error?.message || error)] } })}>
                <Scene J={J} tier={tier} withForge={!!asset.ok} onMissing={onMissing} />
              </SceneBoundary>
            </Canvas>
          )}
        </div>

        {/* the light at the end: white, onto the site */}

        {env && withLoader && <Loader J={J} problem={asset?.problem} onEnter={enter} />}
        <HeroOverlay ref={heroRef} />
        <OasisCopy lineRefs={copyRefs} />
        <AssetBadge problem={asset?.problem} />
        {env?.stats && <TuningPanel onScrub={jump} />}
        {!tier?.post && <div ref={fadeRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-white opacity-0" />}
        {env?.debug && (
          <div ref={hudRef} className="pointer-events-none absolute right-3 top-24 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
            p 0
          </div>
        )}
      </div>
      <span data-journey-end className="absolute bottom-0 left-0 h-px w-px" aria-hidden="true" />
    </section>
  );
}

// The visitor clicks in: the beam's race starts, and the scene comes in
// from far off (Rig.jsx).
function startJourney(J) {
  J.enterAt = performance.now() / 1000;
  gsap.to(J, { arrive: 1, duration: T.arriveDuration, ease: "none" });
}

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

// How far one of the oasis's lines is shown at p: its words coming in over
// its first stretch, going over its last (with the scroll, both ways).
function lineShown(line, p) {
  const fade = (line.to - line.from) * 0.3;
  return Math.min(clamp01((p - line.from) / fade), clamp01((line.to - p) / fade));
}

// The forged hero holding: the reduced-motion still.
function forgedState() {
  const J = createJourneyState();
  const tl = buildMasterTimeline(J, {});
  tl.progress(STATES.find((s) => s.id === "hold").start);
  tl.kill();
  J.intro = 1;
  return J;
}

// Reduced motion: one still render of the forged logo behind the static story.
function ReducedStill({ tier }) {
  const [J] = useState(forgedState);
  const [asset] = useForgeAsset();
  const still = (
    <div className="pointer-events-none absolute inset-0">
      {asset && (
        <Canvas
          frameloop="demand"
          dpr={tier.dpr}
          shadows={tier.shadowMap > 0 ? "percentage" : false}
          gl={{ antialias: !tier.post, alpha: false }}
          camera={{ position: [J.camX, J.camY, J.camZ], fov: J.fov, near: 0.1, far: 4000 }}
          style={{ pointerEvents: "none" }}
          aria-hidden="true"
        >
          <color attach="background" args={["#0e0b09"]} />
          <SceneBoundary>
            <Scene J={J} tier={tier} withForge={!!asset.ok} />
          </SceneBoundary>
        </Canvas>
      )}
    </div>
  );
  return <StaticJourney still={still} />;
}
