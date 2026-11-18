"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { brokenAt, buildMasterTimeline, createJourneyState, deriveBreak } from "./timeline";
import { deriveReveal } from "./world/oasisCamera";
import { ASSETS, JOURNEY_VH, P, SCROLL_VH, STATES, detectTier, detectWebGL, zoneAt } from "./config";
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

export default function ForgingSandDuneConceptV3() {
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
  const outroRef = useRef(null);
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
        tl.from(sp.chars, { opacity: 0, filter: "blur(14px)", yPercent: 18, duration: 0.8, ease: "power3.out", stagger: { each: 0.028, from: "random" } }, 0);
      }
      if (body) {
        const sp = SplitText.create(body, { type: "words" });
        splits.push(sp);
        tl.from(sp.words, { opacity: 0, filter: "blur(8px)", y: 10, duration: 0.6, ease: "power2.out", stagger: 0.04 }, 0.3);
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

  const lenisRef = useRef(null);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

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
  //     the impact until the rock has ground into sand (brokenAt), at a fixed
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

        // until the broken rock has ground into sand: always auto-scrolled,
        // forwards or back; from there the visitor scrolls on themselves
        const freeAt = brokenAt();
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
        // the light at the end, white to the site below
        if (outroRef.current) {
          const w = Math.min(Math.max(J.outro, 0), 1);
          outroRef.current.style.opacity = String(w * w * (3 - 2 * w));
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
        <div ref={outroRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-[#fff9f1] opacity-0" />

        {env && withLoader && <Loader J={J} problem={asset?.problem} onEnter={enter} />}
        <HeroOverlay ref={heroRef} />
        <OasisCopy lineRefs={copyRefs} />
        <AssetBadge problem={asset?.problem} />
        {env?.stats && <TuningPanel onScrub={jump} />}
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
