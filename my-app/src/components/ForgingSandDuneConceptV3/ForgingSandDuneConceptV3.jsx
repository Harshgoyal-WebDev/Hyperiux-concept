"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Scene from "./scene/Scene";
import { AssetBadge, HeroOverlay, OasisCopy } from "./Overlays";
import SiteFooter from "./SiteFooter";
import { FOOTER } from "./footer";
import StaticJourney from "./StaticJourney";
import dynamic from "next/dynamic";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { SOUND_EVENT, setSound, soundOn, soundWanted } from "./audio";
import Loader, { LoaderCover, REPLAY_LOADER_EVENT } from "./Loader";
import { loaderTiming } from "./loaderScene";
import { Q, QUALITY_EVENT } from "./quality";
import { blastedAt, buildMasterTimeline, cameraSetsOffAt, createJourneyState, deriveBreak } from "./timeline";
import { deriveReveal, extraTurn } from "./world/oasisCamera";
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
        if (!ok) console.error(`[forging-sand-dune-concept-v3] ${ASSETS.forgeGlb} not found; the slab is not rendered.`);
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
const SKIP_EVENT = "forging-sand-dune-concept-v3:skip";

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
    console.error("[forging-sand-dune-concept-v3] 3D scene failed", error);
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Client capabilities, read once. null on the server so hydration matches.
// the Leva tuning panels: loaded (and shown) only with ?leva
const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });
// The Hyperiux homepage, Work to the FAQ (the forging concept's), after the
// white transition
const HomeSections = dynamic(() => import("@/components/HyperiuxHome/HomeSections"), { ssr: false });
// (its sections lay themselves over the journey's last screen — mt -100vh —
// as they do in the forging concept; here that screen is the white
// transition itself, so they start below it instead)
// (with T.outroReveal they sit under the journey's last stretch instead — the
// transition opens onto them: the Work section is already there behind the
// 3D scene as it starts, and scrolls on under it as it opens)
function SiteSections() {
  const behind = T.outroReveal;
  const under = Math.max(1 - T.tlOutroStart, 0) * (JOURNEY_VH - 100);
  return (
    <div className={behind ? "relative z-0 bg-white" : "relative z-10 bg-white pt-[100vh]"} style={behind ? { marginTop: `-${under.toFixed(2)}vh` } : undefined}>
      <HomeSections />
    </div>
  );
}

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

export default function ForgingSandDuneConceptV3() {
  const env = useSyncExternalStore(noopSubscribe, getClientEnv, () => null);

  // the site below the journey: mounted as its end comes near (three
  // screens off), so its sections cost nothing through the scenes above
  const [siteOpen, setSiteOpen] = useState(false);
  useEffect(() => {
    if (siteOpen) return;
    const el = document.querySelector("[data-journey-end]");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSiteOpen(true), { rootMargin: "0px 0px 300% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [siteOpen, env]);

  if (env && !env.webgl) {
    return (
      <main className="w-full">
        <Header />
        <StaticJourney />
        <HomeSections />
        <SiteFooter />
      </main>
    );
  }
  if (env?.reduced) {
    return (
      <main className="w-full">
        <Header />
        <ReducedStill tier={env.tier} />
        <HomeSections />
        <SiteFooter />
      </main>
    );
  }
  return (
    <main className="w-full">
      {/* (until the client knows its setup, the server's loader covers the page) */}
      {!env && <LoaderCover />}
      <Header nightToggle />
      <Journey env={env} />
      {siteOpen && <SiteSections />}
      {siteOpen && <SiteFooter />}
    </main>
  );
}

// Day / night switch for the 3D journey.
function NightToggle() {
  const [night, setLocal] = useState(T.night);
  useEffect(() => {
    const sync = (e) => setLocal(e.detail);
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, []);
  return (
    <button
      type="button"
      onClick={() => setNight(!night)}
      aria-pressed={night}
      className="cursor-pointer opacity-70 transition-opacity hover:opacity-100"
    >
      {night ? "Day" : "Night"}
    </button>
  );
}

// Sound on / off. Browsers need a user gesture before audio can start, so
// a visitor who turned sound on before gets it back on their first click
// or key press.
function SoundToggle() {
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
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSound(!on);
      }}
      aria-pressed={on}
      className="cursor-pointer opacity-70 transition-opacity hover:opacity-100"
    >
      {on ? "Sound on" : "Sound off"}
    </button>
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
      const footer = FOOTER.el;
      // (with the page beneath the transition: dark type once it is half open)
      const end = document.querySelector("[data-journey-end]");
      const opened = !end || end.getBoundingClientRect().top <= window.innerHeight || document.documentElement.dataset.v3Outro === "1";
      setLight(!!site && site.getBoundingClientRect().top <= 80 && opened && !(footer && footer.getBoundingClientRect().top <= 80));
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
        {nightToggle && <SoundToggle />}
        {nightToggle && <NightToggle />}
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
      // (the camera already in its place behind the loader — the same shot
      // it reveals — or, T.loaderFlyIn, far off, to fly in)
      j.arrive = T.loaderFlyIn ? 0 : 1;
      // (dark until the loader is held, and its sweep reveals the scene)
      j.loaderSweep = 0;
    }
    return j;
  });
  const withLoader = useState(wantsLoader)[0];
  const [entered, setEntered] = useState(() => !withLoader); // clicked in (or no loader)
  const [settled, setSettled] = useState(() => !withLoader); // ...and the camera has (mostly) arrived: the scroll is free
  // the loader run again from the tuning panel (to see its reveal with new
  // values): back to the top, dark, the beam's race waiting
  const [loaderRun, setLoaderRun] = useState(0);
  useEffect(() => {
    const replay = () => {
      J.loaderHold = 0;
      J.loaderSweep = 0;
      J.enterAt = Infinity;
      J.arrive = T.loaderFlyIn ? 0 : 1;
      setEntered(false);
      setSettled(false);
      setLoaderRun((n) => n + 1);
    };
    window.addEventListener(REPLAY_LOADER_EVENT, replay);
    return () => window.removeEventListener(REPLAY_LOADER_EVENT, replay);
  }, [J]);
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
  const [footerOn, setFooterOn] = useState(false); // the canvas pinned behind the footer
  const viewportRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const [footerSeen, setFooterSeen] = useState(false); // ...and the footer on screen (only then is it drawn)
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
    window.addEventListener("forging-sand-dune-concept-v3:retime", retime);
    return () => {
      clearTimeout(t);
      window.removeEventListener("forging-sand-dune-concept-v3:retime", retime);
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
      // (the cue waits, hidden, in the loader's dark)
      if (!entered) {
        gsap.set("[data-hero-reveal]", { autoAlpha: 0 });
        return;
      }
      // (after the loader: as its sweep comes in — or the camera, flying in)
      const lead = withLoader || loaderRun > 0 ? (T.loaderFlyIn ? T.arriveDuration * 0.45 : 0.4 + loaderTiming().total * 0.5) : 0;
      // (its words: the scroll loop plays them in as this goes 0 → 1)
      gsap.fromTo(heroIn.current, { v: 0 }, { v: 1, duration: 2.4, ease: "none", delay: lead + 0.3 });
      gsap.fromTo("[data-hero-reveal]", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out", delay: lead + 1.2 });
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
    // (from the loader: once its reveal is over — opts.soundDelay)
    if (opts.quiet) setSound(false);
    else if (opts.soundDelay) gsap.delayedCall(opts.soundDelay, () => !soundOn() && setSound(true));
    else if (!soundOn()) setSound(true);
    setEntered(true);
    gsap.delayedCall(T.loaderFlyIn ? T.arriveDuration * 0.6 : 0.4 + loaderTiming().total * 0.8, () => setSettled(true));
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
        // The footer (footer.js): coming near (within two screens), the
        // canvas is pinned behind the page — still covered by the sections —
        // and holds the oasis at T.footerP, the Yggdrasil grown, settling
        // while it's hidden, to be uncovered as the last section scrolls away
        const fe = FOOTER.el;
        const top = fe && !releaseOffscreen ? fe.getBoundingClientRect().top : Infinity;
        const near = top < window.innerHeight * 2;
        if (near !== D.footerNear) {
          D.footerNear = near;
          setFooterOn(near);
          // (its own dark ground until the scene is behind it)
          if (fe) fe.dataset.live = near ? "1" : "";
        }
        // (drawn only once the footer is on screen: behind the sections the
        // scene is covered — nothing to draw)
        const seen = near && top < window.innerHeight;
        if (seen !== D.footerSeen) {
          D.footerSeen = seen;
          setFooterSeen(seen);
        }
        // ...and turning on round the tree as the footer is scrolled down to
        // the bottom of the page (T.footerTurn degrees over it)
        const below = fe ? Math.max(fe.offsetHeight - window.innerHeight, 1) : 1;
        const fx = near ? Math.min(Math.max((window.innerHeight - top) / (window.innerHeight + below), 0), 1) : 0;
        extraTurn.value = THREE.MathUtils.degToRad(T.footerTurn) * fx * fx * (3 - 2 * fx);
        apply(near ? T.footerP : current);
        // (no post passes on the lowest tier: the change to the white site
        // is a plain fade there instead of the glass hexagons)
        {
          const w = Math.min(Math.max(J.outro, 0), 1);
          // (opening onto the page beneath: nothing of the journey's own
          // ground behind the canvas; on the lowest tier the canvas fades)
          const reveal = T.outroReveal && !near;
          if (viewportRef.current) viewportRef.current.style.background = reveal && J.progress >= T.tlOutroStart - 0.002 ? "transparent" : "";
          if (canvasWrapRef.current) canvasWrapRef.current.style.opacity = reveal && fadeRef.current ? String(1 - w * w * (3 - 2 * w)) : "";
          if (fadeRef.current) fadeRef.current.style.opacity = reveal ? "0" : String(w * w * (3 - 2 * w));
          const half = w > 0.5 ? "1" : "0";
          if (document.documentElement.dataset.v3Outro !== half) {
            document.documentElement.dataset.v3Outro = half;
            window.dispatchEvent(new Event("scroll"));
          }
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
    { scope: sectionRef, dependencies: [J, resizeKey, pToY, releaseOffscreen] }
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
    // (above the site while its last light opens onto it — the Work section
    // under the scene — but under it once the footer is near: its canvas,
    // pinned to the screen then, would cover the sections above the footer)
    <section ref={sectionRef} data-journey className={`group/journey relative w-full ${footerOn ? "z-0" : "z-10"}`} style={{ height: `${JOURNEY_VH}vh` }}>
      <div ref={viewportRef} data-viewport className="sticky top-0 h-screen w-full overflow-hidden bg-[#0e0b09]">
        {/* (pinned to the screen behind the page while the footer is near) */}
        <div ref={canvasWrapRef} className={`pointer-events-none inset-0 z-0 ${footerOn ? "fixed" : "absolute"}`}>
          {env && tier && mounted && asset && (
            <Canvas
              frameloop={(rendering && !footerOn) || footerSeen ? "always" : "never"}
              dpr={footerSeen ? Math.min(window.devicePixelRatio || 1, tier.dpr[1]) * (dpr ? Q.dpr : 1) * T.footerDpr : (dpr ?? tier.dpr)}
              shadows={tier.shadowMap > 0 ? "percentage" : false}
              gl={{ antialias: !tier.post, powerPreference: "high-performance", alpha: true }}
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

        {env && (withLoader || loaderRun > 0) && <Loader key={loaderRun} J={J} problem={asset?.problem} onEnter={enter} post={!!tier?.post} replay={loaderRun > 0} />}
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
