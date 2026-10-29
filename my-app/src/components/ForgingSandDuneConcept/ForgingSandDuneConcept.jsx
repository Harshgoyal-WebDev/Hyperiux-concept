"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import Scene from "./scene/Scene";
import { AssetBadge, CloseUp, HeroOverlay, Pins, ProgressRail } from "./Overlays";
import WhiteWebsite from "./WhiteWebsite";
import StaticJourney from "./StaticJourney";
import dynamic from "next/dynamic";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { SOUND_EVENT, getAudio, setSound, soundOn, soundWanted } from "./audio";
import { buildMasterTimeline, createJourneyState, deriveBreak } from "./timeline";
import { ASSETS, JOURNEY_VH, P, RAIL, SCROLL_VH, STATES, detectTier, detectWebGL, zoneAt } from "./config";
import { CTA } from "./content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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
        if (!ok) console.error(`[forging-sand-dune-concept] ${ASSETS.forgeGlb} not found; the slab is not rendered.`);
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
const SKIP_EVENT = "forging-sand-dune-concept:skip";
// Journey → header: the journey has turned white in the whiteout (or back).
const WHITE_EVENT = "forging-sand-dune-concept:white";

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
    console.error("[forging-sand-dune-concept] 3D scene failed", error);
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Client capabilities, read once. null on the server so hydration matches.
// the Leva tuning panels: loaded (and shown) only with ?stats
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
      // the tuning panels only with ?stats (or ?=stats) in the address
      stats: (() => {
        const q = new URLSearchParams(window.location.search);
        return q.has("stats") || [...q.values()].includes("stats");
      })(),
    };
  }
  return clientEnv;
}

export default function ForgingSandDuneConcept() {
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

// True once the header sits over white: the journey's own whiteout (the journey marks it on its section), or the white site below it.
// The header switches to dark type and the black logo there (no blend-mode
// trick).
function useOverLight() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const check = () => {
      const site = document.querySelector("[data-white-site]");
      const journeyWhite = document.querySelector("[data-journey]")?.getAttribute("data-white") === "true";
      setLight(journeyWhite || (!!site && site.getBoundingClientRect().top <= 80));
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener(WHITE_EVENT, check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.removeEventListener(WHITE_EVENT, check);
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

function Journey({ env }) {
  // Plain state object written by the GSAP timeline, read by the scene.
  const [J] = useState(createJourneyState);
  const [asset, setAsset] = useForgeAsset();
  const lenis = useLenis();

  const sectionRef = useRef(null);
  const heroRef = useRef(null);
  const railRef = useRef(null);
  const railFillRef = useRef(null);
  const railItemRefs = useRef([]);
  const hudRef = useRef(null);
  const outroRef = useRef(null);
  const pinRefs = useRef([]);
  // a pin's close-up: which key pillar (-1: none) and how far the camera is
  // into it (eased here, read by the camera rig)
  const [focus] = useState(() => ({ index: -1, k: 0 }));
  const [panel, setPanel] = useState({ index: -1, shown: false });
  const revealCall = useRef(null);

  const [mounted, setMounted] = useState(true); // canvas mounted (GPU resources alive)
  const [rendering, setRendering] = useState(true); // frameloop running
  const [dpr, setDpr] = useState(null);
  const [resizeKey, setResizeKey] = useState(0);

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

  // Pause rendering when the hero is off screen; release the GPU entirely
  // when it is far out of view, rebuild on approach.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let unmountTimer;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(unmountTimer);
        setRendering(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
        else unmountTimer = setTimeout(() => setMounted(false), 1500);
      },
      { rootMargin: "100% 0px 100% 0px" }
    );
    io.observe(el);
    return () => {
      clearTimeout(unmountTimer);
      io.disconnect();
    };
  }, []);

  // Hero entrance (time-based, independent of scroll): the copy reveals.
  // (The beam's own load-in race runs in ForgeBeam, on the page clock.)
  useGSAP(
    () => {
      gsap.from("[data-hero-line]", { yPercent: 110, duration: 1.4, stagger: 0.12, ease: "power4.out", delay: 0.3 });
      gsap.from("[data-hero-reveal]", { autoAlpha: 0, y: 24, duration: 1.2, stagger: 0.1, ease: "power3.out", delay: 0.7 });
    },
    { scope: heroRef, dependencies: [J] }
  );

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
  //     the whole event to the forged logo, at a fixed pace, then hands
  //     back;
  //   scrolling back into the event – it scrolls (locked) back through it
  //     to just short of the core.
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const tl = buildMasterTimeline(J, { hero: heroRef.current });
      const railItems = railItemRefs.current;
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
        deriveBreak(J);
        if (railFillRef.current) railFillRef.current.style.transform = `scaleX(${p})`;
        railItems.forEach((el, i) => el && el.setAttribute("data-active", String(RAIL[i].at <= p + 0.002)));
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
        // in a close-up the page holds still (Lenis is stopped; keys too)
        if (focus.index >= 0) {
          if (e.type === "keydown" && SCROLL_KEYS.has(e.key)) e.preventDefault();
          return;
        }
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

        if (goal > P.core + EPS && goal < P.forged - EPS) {
          // in the event: always auto-scrolled, forwards or back
          const forward = D.dir >= 0;
          const to = forward ? P.forged : P.core - 2 * EPS;
          const vhPerSecond = SCROLL_VH.event / (forward ? T.forgeDuration : T.forgeReverse);
          run(to, (Math.abs(to - goal) * TRAVEL_VH) / vhPerSecond, true, linear);
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
        // the light at the end of the flight, white to the site below
        if (outroRef.current) {
          const w = Math.min(Math.max(J.outro, 0), 1);
          outroRef.current.style.opacity = String(w * w * (3 - 2 * w));
        }
        // in the whiteout the page is white: the header and rail go dark
        const white = String(J.white > 0.5);
        if (sectionRef.current && sectionRef.current.getAttribute("data-white") !== white) {
          sectionRef.current.setAttribute("data-white", white);
          window.dispatchEvent(new Event(WHITE_EVENT));
        }
      };
      gsap.ticker.add(follow);

      // Skip intro: straight past the mark — out over the dunes, the first
      // pillars rising ahead.
      const onSkip = (e) => {
        e.preventDefault();
        if (focus.index >= 0) return;
        D.auto = null;
        D.guard = false;
        const y = pToY(zoneAt("pillars", 0.05));
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
    { scope: sectionRef, dependencies: [J, resizeKey, pToY, focus] }
  );

  // Pin close-ups. Opening one stops the page and flies the camera in to
  // the rock; its copy reveals once it is nearly there. Closing hides the
  // copy, flies back to the shot the journey left off at and hands the
  // scroll back.
  // (focus is, like J, plain state the render loop reads every frame: it is
  // written here and by gsap, never rendered from)
  /* eslint-disable react-hooks/immutability */
  const openPin = useCallback(
    (i) => {
      if (focus.index >= 0) return;
      focus.index = i;
      lenis?.stop();
      setPanel({ index: i, shown: false });
      getAudio()?.passThrough();
      gsap.to(focus, { k: 1, duration: 1.9, ease: "power3.inOut", overwrite: true });
      revealCall.current?.kill();
      revealCall.current = gsap.delayedCall(1.1, () => setPanel({ index: i, shown: true }));
    },
    [focus, lenis]
  );
  const closePin = useCallback(() => {
    if (focus.index < 0 || focus.closing) return;
    focus.closing = true;
    revealCall.current?.kill();
    setPanel((p) => ({ ...p, shown: false }));
    gsap.to(focus, {
      k: 0,
      duration: 1.6,
      delay: 0.3,
      ease: "power3.inOut",
      overwrite: true,
      onComplete: () => {
        focus.index = -1;
        focus.closing = false;
        lenis?.start();
        setPanel({ index: -1, shown: false });
      },
    });
  }, [focus, lenis]);
  /* eslint-enable react-hooks/immutability */
  useEffect(() => {
    if (panel.index < 0) return;
    const onKey = (e) => e.key === "Escape" && closePin();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel.index, closePin]);
  useEffect(() => () => revealCall.current?.kill(), []);

  // Rail / panel jumps to a scroll fraction. A rail jump glides there and
  // the driver picks up where it lands (inside the event it plays on to the
  // forged logo); a panel scrub is held as a review frame.
  const jump = useCallback(
    (p, immediate = false) => {
      if (!sectionRef.current || focus.index >= 0) return;
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
    [lenis, pToY, focus]
  );

  const onMissing = useCallback((parts) => setAsset({ problem: { kind: "incomplete", parts } }), [setAsset]);

  const tier = env?.tier;
  return (
    <section ref={sectionRef} data-journey data-white="false" className="group/journey relative w-full bg-[#0e0b09]" style={{ height: `${JOURNEY_VH}vh` }}>
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
              <PerformanceMonitor onDecline={() => setDpr(1)} />
              <SceneBoundary onError={(error) => setAsset({ problem: { kind: "incomplete", parts: [String(error?.message || error)] } })}>
                <Scene J={J} tier={tier} withForge={!!asset.ok} onMissing={onMissing} focus={focus} pins={pinRefs} />
              </SceneBoundary>
            </Canvas>
          )}
        </div>

        {/* the light at the end of the flight: white, onto the site */}
        <div ref={outroRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-[#fff9f1] opacity-0" />

        <HeroOverlay ref={heroRef} />
        <Pins pinRefs={pinRefs} onOpen={openPin} />
        <CloseUp index={panel.index} shown={panel.shown} onClose={closePin} />
        <ProgressRail ref={railRef} fillRef={railFillRef} itemRefs={railItemRefs} onJump={jump} />
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

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
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
