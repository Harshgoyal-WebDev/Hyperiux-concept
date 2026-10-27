"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import Scene from "./scene/Scene";
import { AboutOverlay, HeroOverlay, JourneyCaptions, PlaceholderBadge, ProgressRail } from "./Overlays";
import WhiteWebsite from "./WhiteWebsite";
import StaticJourney from "./StaticJourney";
import TuningPanel from "./TuningPanel";
import { NIGHT_EVENT, T, setNight } from "./tuning";
import { SOUND_EVENT, setSound, soundOn, soundWanted } from "./audio";
import { buildMasterTimeline, createJourneyState } from "./timeline";
import { getTrailS0 } from "./world/cameraPath";
import { ALLOW_PLACEHOLDER_MONOLITH, ASSETS, JOURNEY_VH, RAIL, detectTier, detectWebGL } from "./config";
import { CTA } from "./content";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

// Probes for the Blender monolith and its metadata. Next serves an HTML
// 404 page for missing files, so the content-type is checked too.
function useMonolithAsset() {
  const [asset, setAsset] = useState(null);
  useEffect(() => {
    let alive = true;
    const isFile = (r) => r.ok && !(r.headers.get("content-type") || "").includes("text/html");
    Promise.all([
      fetch(ASSETS.monolithGlb, { method: "HEAD" }).then(isFile).catch(() => false),
      fetch(ASSETS.monolithMeta)
        .then((r) => (isFile(r) ? r.json() : null))
        .catch(() => null),
    ]).then(([hasGlb, meta]) => {
      if (!alive) return;
      if (hasGlb) {
        setAsset({ kind: "glb", meta });
        return;
      }
      console.warn(
        `[sand-dune-concept] ${ASSETS.monolithGlb} not found.` +
          (ALLOW_PLACEHOLDER_MONOLITH ? " Using the flagged SVG-extruded placeholder monolith." : " Placeholder disabled; rendering without the monolith.")
      );
      setAsset({ kind: ALLOW_PLACEHOLDER_MONOLITH ? "placeholder" : "none", meta });
    });
    return () => {
      alive = false;
    };
  }, []);
  return [asset, setAsset];
}

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
    console.error("[sand-dune-concept] 3D scene failed", error);
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Client capabilities, read once. null on the server so hydration matches.
let clientEnv = null;
const noopSubscribe = () => () => {};
function getClientEnv() {
  if (!clientEnv) {
    clientEnv = {
      webgl: detectWebGL(),
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      tier: detectTier(),
      debug: new URLSearchParams(window.location.search).has("debug"),
    };
  }
  return clientEnv;
}

export default function SandDuneConcept() {
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

// True once the header sits over a white page: the white world at the end
// of the journey, or the 2D site below it. The header switches to dark
// type and the black logo there (no blend-mode trick).
function useOverLight() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const check = () => {
      const journey = document.querySelector("[data-journey]");
      const site = document.querySelector("[data-white-site]");
      let on = !!site && site.getBoundingClientRect().top <= 80;
      if (journey && !on) {
        const r = journey.getBoundingClientRect();
        const progress = -r.top / Math.max(r.height - window.innerHeight, 1);
        on = progress >= 0.8;
      }
      setLight(on);
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

function Journey({ env }) {
  // Plain state object written by the GSAP timeline, read by the scene.
  const [J] = useState(createJourneyState);
  const progressRef = useRef(0);
  const [asset, setAsset] = useMonolithAsset();
  const lenis = useLenis();

  const sectionRef = useRef(null);
  const heroRef = useRef(null);
  const captionRefs = useRef([]);
  const aboutRef = useRef(null);
  const aboutParaRef = useRef(null);
  const railRef = useRef(null);
  const railFillRef = useRef(null);
  const railItemRefs = useRef([]);
  const whiteoutRef = useRef(null);
  const hudRef = useRef(null);

  const [mounted, setMounted] = useState(true); // canvas mounted (GPU resources alive)
  const [rendering, setRendering] = useState(true); // frameloop running
  const [dpr, setDpr] = useState(null);
  const [resizeKey, setResizeKey] = useState(0);
  const renderingRef = useRef(true);
  const nearRef = useRef(true);

  // Re-split / rebuild the timeline after resizes so masked lines are right.
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

  // Pause rendering once fully white (or off screen); release the GPU
  // entirely when the journey is far out of view, rebuild on approach.
  const updateRendering = useCallback(() => {
    const p = progressRef.current;
    const should = nearRef.current && p < 0.995;
    if (should !== renderingRef.current) {
      renderingRef.current = should;
      setRendering(should);
    }
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let unmountTimer;
    const io = new IntersectionObserver(
      ([entry]) => {
        nearRef.current = entry.isIntersecting;
        clearTimeout(unmountTimer);
        if (entry.isIntersecting) setMounted(true);
        else unmountTimer = setTimeout(() => setMounted(false), 1500);
        updateRendering();
      },
      { rootMargin: "100% 0px 100% 0px" }
    );
    io.observe(el);
    return () => {
      clearTimeout(unmountTimer);
      io.disconnect();
    };
  }, [updateRendering]);

  // Hero entrance (time-based, independent of scroll): copy reveals and
  // the orange line races out from under the viewer towards the monolith.
  useGSAP(
    () => {
      gsap.fromTo(J, { intro: 0 }, { intro: 1, duration: 2.8, delay: 0.5, ease: "power2.inOut" });
      gsap.from("[data-hero-line]", { yPercent: 110, duration: 1.4, stagger: 0.12, ease: "power4.out", delay: 0.3 });
      gsap.from("[data-hero-reveal]", { autoAlpha: 0, y: 24, duration: 1.2, stagger: 0.1, ease: "power3.out", delay: 0.7 });
    },
    { scope: heroRef, dependencies: [J] }
  );

  const lenisRef = useRef(null);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  // Master timeline, driven by the pinned section's scroll. Not via
  // ScrollTrigger's scrub: that reads the browser's scroll position, which
  // is quantised to device pixels, and along the trail one pixel moves the
  // camera ~0.3 m — so as a smooth scroll winds down (under a pixel per
  // frame) the camera stepped irregularly and then snapped. Instead the
  // exact (fractional) Lenis scroll is read every frame and followed with a
  // short ease, which also absorbs Lenis's final settle.
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const split = aboutParaRef.current
        ? new SplitText(aboutParaRef.current, { type: "lines", mask: "lines" })
        : null;
      const tl = buildMasterTimeline(
        J,
        {
          hero: heroRef.current,
          captions: captionRefs.current,
          about: aboutRef.current,
          aboutLines: split?.lines,
          rail: railRef.current,
          whiteout: whiteoutRef.current,
        },
        { s0: getTrailS0() }
      );
      const railItems = railItemRefs.current;
      const st = ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom" });
      const apply = (p) => {
        tl.progress(p);
        progressRef.current = p;
        if (railFillRef.current) railFillRef.current.style.transform = `scaleX(${p})`;
        railItems.forEach((el, i) => el && el.setAttribute("data-active", String(RAIL[i].at <= p + 0.002)));
        if (hudRef.current) hudRef.current.textContent = `progress ${p.toFixed(4)}`;
        updateRendering();
      };
      const target = () => {
        const range = st.end - st.start;
        const l = lenisRef.current;
        const y = l ? (l.animatedScroll ?? l.scroll) : window.scrollY;
        return range > 0 ? clamp01((y - st.start) / range) : st.progress;
      };
      let current = target();
      const follow = (_time, deltaMs) => {
        const goal = target();
        const diff = goal - current;
        if (diff === 0) return;
        // jumps (deep links, resizes) land at once; scrolling is eased
        if (Math.abs(diff) > 0.04 || Math.abs(diff) < 1e-6) current = goal;
        else current += diff * (1 - Math.exp(-Math.min(deltaMs, 100) / 55));
        apply(current);
      };
      // Sync immediately for deep links / restored scroll positions.
      apply(current);
      gsap.ticker.add(follow);
      ScrollTrigger.refresh();
      return () => {
        gsap.ticker.remove(follow);
        st.kill();
        tl.kill();
        split?.revert();
      };
    },
    { scope: sectionRef, dependencies: [J, resizeKey, updateRendering] }
  );

  // ?p=0.42 jumps straight to a progress value (review / screenshots).
  useEffect(() => {
    if (!env) return;
    const p = parseFloat(new URLSearchParams(window.location.search).get("p"));
    if (!Number.isFinite(p)) return;
    const id = setTimeout(() => {
      const el = sectionRef.current;
      const y = el.offsetTop + clamp01(p) * (el.offsetHeight - window.innerHeight);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      ScrollTrigger.update();
    }, 120);
    return () => clearTimeout(id);
  }, [env, lenis]);

  const jump = useCallback(
    (at, immediate = false) => {
      const el = sectionRef.current;
      if (!el) return;
      const y = el.offsetTop + at * (el.offsetHeight - window.innerHeight);
      if (lenis) lenis.scrollTo(y, immediate ? { immediate: true, force: true } : { duration: 2.2 });
      else window.scrollTo({ top: y, behavior: immediate ? "auto" : "smooth" });
    },
    [lenis]
  );

  const tier = env?.tier;
  return (
    <section ref={sectionRef} data-journey className="relative w-full bg-[#0e0b09]" style={{ height: `${JOURNEY_VH}vh` }}>
      <div data-viewport className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0">
          {env && tier && mounted && asset && (
            <Canvas
              frameloop={rendering ? "always" : "never"}
              dpr={dpr ?? tier.dpr}
              shadows={tier.shadowMap > 0 ? "percentage" : false}
              gl={{ antialias: !tier.post, powerPreference: "high-performance", alpha: false }}
              camera={{ position: [0, 7, 155], fov: 40, near: 0.1, far: 4000 }}
              style={{ pointerEvents: "none" }}
              aria-hidden="true"
            >
              <color attach="background" args={["#0e0b09"]} />
              <PerformanceMonitor onDecline={() => setDpr(1)} />
              <SceneBoundary onError={() => setAsset((a) => (a?.kind === "glb" ? { ...a, kind: "placeholder" } : a))}>
                <Scene J={J} tier={tier} asset={asset} />
              </SceneBoundary>
            </Canvas>
          )}
        </div>

        <div ref={whiteoutRef} className="pointer-events-none absolute inset-0 z-10 bg-white opacity-0" />

        <HeroOverlay ref={heroRef} />
        <JourneyCaptions captionRefs={captionRefs} />
        <AboutOverlay ref={aboutRef} paragraphRef={aboutParaRef} />
        <ProgressRail ref={railRef} fillRef={railFillRef} itemRefs={railItemRefs} onJump={jump} />
        <PlaceholderBadge asset={asset} />
        {env && <TuningPanel onScrub={jump} />}
        {env?.debug && (
          <div ref={hudRef} className="pointer-events-none absolute right-3 top-24 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
            progress 0
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

// Reduced motion: one still render of State 01 behind the static story.
function ReducedStill({ tier }) {
  const [J] = useState(createJourneyState);
  const [asset] = useMonolithAsset();
  const still = (
    <div className="pointer-events-none absolute inset-0">
      {asset && (
        <Canvas
          frameloop="demand"
          dpr={tier.dpr}
          shadows={tier.shadowMap > 0 ? "percentage" : false}
          gl={{ antialias: !tier.post, alpha: false }}
          camera={{ position: [0, 7, 155], fov: 40, near: 0.1, far: 4000 }}
          style={{ pointerEvents: "none" }}
          aria-hidden="true"
        >
          <color attach="background" args={["#0e0b09"]} />
          <SceneBoundary>
            <Scene J={J} tier={tier} asset={asset} />
          </SceneBoundary>
        </Canvas>
      )}
    </div>
  );
  return <StaticJourney still={still} />;
}
