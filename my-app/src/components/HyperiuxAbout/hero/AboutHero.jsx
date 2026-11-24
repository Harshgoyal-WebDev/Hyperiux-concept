"use client";

import { Component, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import HeroScene from "./HeroScene";
import { CAMERA_KEYS, HERO_TRAVEL_VH } from "./world";
import { HERO, HERO_LINES } from "../content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// A broken GLB or shader shouldn't take the page down: the still stays.
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[about] 3D hero failed", error);
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Client capabilities, read once (null on the server, so hydration matches).
let clientEnv = null;
const noopSubscribe = () => () => {};
const getClientEnv = () => (clientEnv ??= detect());
const getServerEnv = () => null;

function detect() {
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 64rem)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const low = small || cores <= 4;
  return {
    webgl,
    reduced,
    quality: low
      ? { dpr: [1, 1.25], segments: 200, embers: 220, dust: 260, shadows: true, multisampling: 0 }
      : { dpr: [1, 1.5], segments: 340, embers: 420, dust: 600, shadows: true, multisampling: 4 },
  };
}

const PLACE = {
  left: "items-center justify-start text-left",
  right: "items-center justify-end text-right",
};

// The about page's 3D hero: one screen pinned over HERO_TRAVEL_VH of scroll.
// The monolith opens, the camera goes into the forge's light, and the page
// whites out onto the sections below (as the concept's journey resolves
// into its white site).
export default function AboutHero() {
  const section = useRef(null);
  // the scene's state: written by the scroll and pointer, read every frame
  const [S] = useState(() => ({ p: 0, e: 0, px: 0, py: 0, mx: 0, my: 0 }));
  const env = useSyncExternalStore(noopSubscribe, getClientEnv, getServerEnv);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const onReady = useCallback(() => setReady(true), []);

  const live = env && env.webgl && !env.reduced && !failed;

  // (no frames while the hero is off screen)
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // a review frame: ?p=0.5 jumps to that point of the hero
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("p");
    const el = section.current;
    if (q == null || !el) return;
    const p = Math.min(Math.max(parseFloat(q) || 0, 0), 1);
    const y = el.offsetTop + p * (el.offsetHeight - window.innerHeight);
    const t = setTimeout(() => {
      window.scrollTo(0, y);
      S.p = S.e = p;
      ScrollTrigger.update();
    }, 300);
    return () => clearTimeout(t);
  }, [S]);

  // pointer sway
  useEffect(() => {
    const move = (e) => {
      S.px = (e.clientX / window.innerWidth) * 2 - 1;
      S.py = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [S]);

  // the scroll: the scene's progress and the copy over it
  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => {
            S.p = self.progress;
            document.documentElement.style.setProperty("--about-hero-p", self.progress.toFixed(4));
          },
        },
      });
      tl.to("[data-hero-copy]", { autoAlpha: 0, y: -50, duration: 0.14 }, 0.05);
      tl.to("[data-hero-cue]", { autoAlpha: 0, duration: 0.06 }, 0.02);
      gsap.utils.toArray("[data-hero-line]").forEach((el, i) => {
        const l = HERO_LINES[i];
        const fade = (l.to - l.from) * 0.28;
        tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: fade, ease: "power2.out" }, l.from);
        tl.to(el, { autoAlpha: 0, y: -40, duration: fade, ease: "power2.in" }, l.to - fade);
      });
      tl.fromTo("[data-hero-progress]", { scaleY: 0 }, { scaleY: 1, duration: 1 }, 0);
      tl.fromTo("[data-hero-white]", { opacity: 0 }, { opacity: 1, duration: 0.13, ease: "power1.in" }, 0.87);
      tl.set({}, {}, 1);
    },
    { scope: section }
  );

  // the entrance, once the scene is in (or straight away without one)
  useGSAP(
    () => {
      if (!env) return;
      if (live && !ready) return;
      const tl = gsap.timeline({ delay: live ? 0.35 : 0.1 });
      tl.fromTo("[data-hero-eyebrow]", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out" });
      tl.set("[data-hero-title]", { autoAlpha: 1 }, 0.1);
      tl.fromTo("[data-hero-title] > span > span", { yPercent: 110 }, { yPercent: 0, duration: 1.3, stagger: 0.1, ease: "power4.out" }, 0.1);
      tl.fromTo("[data-hero-body]", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out" }, 0.5);
      tl.fromTo("[data-hero-reveal]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 0.9);
    },
    { scope: section, dependencies: [env, ready, live] }
  );

  // if the scene never arrives, show the copy anyway
  useEffect(() => {
    if (!live || ready) return;
    const t = setTimeout(() => setReady(true), 9000);
    return () => clearTimeout(t);
  }, [live, ready]);

  const [k0, t0] = [CAMERA_KEYS.position[0], CAMERA_KEYS.target[0]];

  return (
    <section ref={section} data-about-hero className="relative z-10 w-full bg-[#0e0b09]" style={{ height: `${HERO_TRAVEL_VH + 100}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#0e0b09]">
        {/* the still under the scene (and in its place without WebGL or with reduced motion) */}
        <HeroStill />
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-[1600ms] ease-out ${live && ready ? "opacity-100" : "opacity-0"}`}>
          {live && (
            <Canvas
              frameloop={visible ? "always" : "never"}
              dpr={env.quality.dpr}
              shadows={env.quality.shadows ? "percentage" : false}
              gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
              camera={{ position: k0, fov: 32, near: 0.1, far: 5000 }}
              onCreated={({ camera }) => camera.lookAt(...t0)}
              aria-hidden="true"
            >
              <color attach="background" args={["#0e0b09"]} />
              <SceneBoundary onError={() => setFailed(true)}>
                <Suspense fallback={null}>
                  <HeroScene S={S} quality={env.quality} onReady={onReady} />
                </Suspense>
              </SceneBoundary>
            </Canvas>
          )}
        </div>

        {/* loading */}
        {live && !ready && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <span className="flex items-center gap-3 font-[family-name:var(--font-orbitron)] text-[0.7vw] uppercase tracking-[0.4em] text-white/50 max-[64rem]:text-xs">
              <span className="block size-[7px] animate-pulse rounded-full bg-[#FF5F00]" />
              Heating the forge
            </span>
          </div>
        )}

        {/* the opening copy */}
        <div data-hero-copy className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-[5vw] pb-[13vh] max-[33.875rem]:pb-[20vh]">
          <p
            data-hero-eyebrow
            className="invisible mb-[1.6vw] flex items-center gap-3 font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase tracking-[0.32em] text-white/70 max-[64rem]:text-[1.8vw] max-[33.875rem]:mb-4 max-[33.875rem]:text-[3vw]"
          >
            <span className="block size-[9px] rounded-full bg-[#FF5F00]" />
            {HERO.eyebrow}
          </p>
          <h1
            data-hero-title
            className="invisible font-[family-name:var(--font-aeonikpro)] text-[7.6vw] font-normal uppercase leading-[0.92] tracking-[-0.03em] text-white [text-shadow:0_2px_24px_rgba(30,12,0,0.35)] max-[64rem]:text-[11vw] max-[33.875rem]:text-[14vw]"
          >
            {HERO.title.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.04em]">
                <span className={`block ${i === 1 ? "pl-[8vw] max-[33.875rem]:pl-0" : ""}`}>{line}</span>
              </span>
            ))}
          </h1>
          <p
            data-hero-body
            className="invisible mt-[2vw] max-w-[28vw] font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.5] text-white/80 max-[64rem]:max-w-[60vw] max-[64rem]:text-[2.2vw] max-[33.875rem]:mt-5 max-[33.875rem]:max-w-full max-[33.875rem]:text-[4vw]"
          >
            {HERO.body}
          </p>
        </div>

        {/* the lines over the opening monolith */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {HERO_LINES.map((l) => (
            <div
              key={l.id}
              data-hero-line
              className={`invisible absolute inset-0 flex px-[7vw] max-[33.875rem]:items-end max-[33.875rem]:justify-center max-[33.875rem]:pb-[18vh] max-[33.875rem]:text-center ${PLACE[l.place]}`}
            >
              <div className="max-w-[30vw] max-[64rem]:max-w-[60vw] max-[33.875rem]:max-w-full">
                <p
                  className={`mb-[1vw] flex items-center gap-[0.6vw] font-[family-name:var(--font-orbitron)] text-[0.75vw] uppercase tracking-[0.3em] text-white/75 [text-shadow:0_1px_8px_rgba(30,12,0,0.6)] max-[64rem]:gap-2 max-[64rem]:text-[1.6vw] max-[33.875rem]:mb-3 max-[33.875rem]:justify-center max-[33.875rem]:text-[2.8vw] ${
                    l.place === "right" ? "justify-end" : ""
                  }`}
                >
                  <span className="block size-[7px] rounded-full bg-[#FF5F00]" />
                  {l.eyebrow}
                </p>
                <p className="font-[family-name:var(--font-aeonikpro)] text-[3.4vw] font-light leading-[1.04] tracking-[-0.02em] text-white [text-shadow:0_2px_18px_rgba(30,12,0,0.55)] max-[64rem]:text-[5.6vw] max-[33.875rem]:text-[9vw]">
                  {l.text}
                </p>
                <p
                  className={`mt-[1.2vw] max-w-[24vw] font-[family-name:var(--font-aeonikpro)] text-[0.98vw] leading-[1.55] text-white/80 [text-shadow:0_1px_8px_rgba(30,12,0,0.5)] max-[64rem]:max-w-[50vw] max-[64rem]:text-[2vw] max-[33.875rem]:mx-auto max-[33.875rem]:mt-3 max-[33.875rem]:max-w-full max-[33.875rem]:text-[3.8vw] ${
                    l.place === "right" ? "ml-auto" : ""
                  }`}
                >
                  {l.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* scroll cue */}
        <div data-hero-cue className="pointer-events-none absolute bottom-[6vh] left-1/2 z-20 -translate-x-1/2 max-[33.875rem]:bottom-[8vh]">
          <div data-hero-reveal className="invisible flex flex-col items-center gap-3">
            <span className="font-[family-name:var(--font-aeonikpro)] text-[0.75vw] uppercase tracking-[0.3em] text-white/60 max-[64rem]:text-[1.6vw] max-[33.875rem]:text-[2.8vw]">{HERO.cue}</span>
            <span className="block h-[5vh] w-px origin-top animate-pulse bg-gradient-to-b from-[#FF5F00] to-transparent" />
          </div>
        </div>

        {/* progress, right edge */}
        <div className="pointer-events-none absolute right-[2.4vw] top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-[1vw] max-[33.875rem]:hidden">
          <span className="font-[family-name:var(--font-orbitron)] text-[0.6vw] tracking-[0.2em] text-white/50 max-[64rem]:text-[10px]">001</span>
          <span className="relative block h-[18vh] w-px bg-white/20">
            <span data-hero-progress className="absolute inset-0 origin-top bg-[#FF5F00]" />
          </span>
          <span className="font-[family-name:var(--font-orbitron)] text-[0.6vw] tracking-[0.2em] text-white/50 max-[64rem]:text-[10px]">002</span>
        </div>

        {/* the light at the end: white, onto the page */}
        <div data-hero-white aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 bg-white opacity-0" />
      </div>
    </section>
  );
}

// A CSS composition of the monolith at dusk with the real logo cut out of
// it: under the scene while it loads, and in its place when there's none.
function HeroStill() {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#0d1322_0%,#2c2d3d_34%,#c27a52_60%,#e48e4f_66%,#6b3417_67%,#2a1409_100%)]">
      <div className="absolute bottom-[33%] left-1/2 h-[46vh] w-[38vh] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_50%,rgba(255,95,0,0.55),transparent_62%)] blur-2xl" />
      <div className="absolute bottom-[31%] left-1/2 h-[44vh] w-[36vh] -translate-x-1/2 bg-[#15110f] [mask-composite:exclude] [mask-image:url(/hyperiux-icon-black.svg),linear-gradient(#000_0_0)] [mask-position:center_45%,center] [mask-repeat:no-repeat] [mask-size:78%,100%] [-webkit-mask-composite:xor]" />
    </div>
  );
}
