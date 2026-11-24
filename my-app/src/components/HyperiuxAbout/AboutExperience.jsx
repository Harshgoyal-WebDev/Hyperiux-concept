"use client";

import { Component, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { INTRO, STORY, TEAM, WHITE } from "./content";
import { NIGHT_EVENT, T as V3T, setNight } from "@/components/ForgingSandDuneConceptV3/tuning";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const AboutScene = dynamic(() => import("./scene/AboutScene"), { ssr: false });
// the Leva tuning panel: loaded (and shown) only with ?leva
const TuningPanel = dynamic(() => import("./TuningPanel"), { ssr: false });

// The Hyperiux About page — "Revealed by light". One long scroll, one
// persistent canvas, one master timeline (in units of EXPERIENCE_VH):
//   01 The land of light  0–148   the streaks fall, the land turns to light
//   02 The transition   148–228   V3's bunq discs, over a long stretch of scroll
//   03 The Team         226–372   one member at a time (prev / next, keys, swipe)
//   04 Into the Light   374–454   the portrait dissolves, the light expands,
//                                 the frame turns pure white
// …onto the first white section of the 2D page.
const EXPERIENCE_VH = 454;
// how far in each line of copy's words are (0 → 1: in out of the blur), set
// by the scroll's timeline and read each frame (the opening's also by its
// entrance on load)
const COPY = { intro: 1, story: 0 };
const TEAM_FROM = 226;
const TEAM_TO = 372;

function createState() {
  return {
    // the camera: far out over the V3 dunes, the centre beam ahead
    camX: 0,
    camY: 20,
    camZ: 270,
    tX: 0,
    tY: 26,
    tZ: 0,
    fall: 0, // the streaks coming down, one by one (EnergyBeams)
    dark: 0, // (a touch quieter round the team)
    cut: 0, // the bunq transition from the hero to the team's stage
    teamPush: 0, // the team camera's slow drift in
    beams: 1,
    currents: 0,
    flat: 0,
    scan: -200,
    scanGlow: 0,
    sScan: -40,
    sScanGlow: 0,
    reveal: 0,
    exit: 0,
    swap: 0,
    morph: 0, // a member change: the strands re-forming into the next face (0 → 1)
    morphTo: 0,
    light: 0,
    white: 0,
    member: 0,
    px: 0,
    py: 0,
  };
}

let clientEnv = null;
const noopSubscribe = () => () => {};
const getServerEnv = () => null;
const getClientEnv = () =>
  (clientEnv ??= (() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!c.getContext("webgl2");
    } catch {
      webgl = false;
    }
    const small = window.matchMedia("(max-width: 64rem)").matches;
    const low = small || (navigator.hardwareConcurrency || 4) <= 4;
    return {
      webgl,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      leva: (() => {
        const q = new URLSearchParams(window.location.search);
        return q.has("leva") || [...q.values()].includes("leva");
      })(),
      quality: low
        ? { dpr: [1, 1.25], scale: 0.5, terrainSegments: 260, shadowMap: 1024, columns: 260, segments: 22, particles: 1500, currents: 18 }
        : { dpr: [1, 1.5], scale: 1, terrainSegments: 420, shadowMap: 2048, columns: 430, segments: 30, particles: 3400, currents: 28 },
    };
  })());

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[about] scene failed", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const pad = (n) => String(n).padStart(2, "0");

export default function AboutExperience() {
  const env = useSyncExternalStore(noopSubscribe, getClientEnv, getServerEnv);
  const root = useRef(null);
  const stage = useRef(null);
  const header = useRef(null);
  const lenis = useLenis();
  const [S] = useState(createState);
  const [idx, setIdx] = useState(0);
  const [missing, setMissing] = useState([]);
  const [visible, setVisible] = useState(true);
  const teamActive = useRef(false);
  const busy = useRef(false);
  const onMissing = useCallback((list) => setMissing(list), []);
  const n = TEAM.length;

  // no frames once the experience has scrolled away
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const move = (e) => {
      S.px = (e.clientX / window.innerWidth) * 2 - 1;
      S.py = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [S]);

  // ---------------------------------------------------------------------
  // The master timeline: the scroll, through all four chapters (in vh).
  // ---------------------------------------------------------------------
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({
        defaults: { ease: "sine.inOut" },
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.9,
          onUpdate: (self) => {
            const vh = self.progress * EXPERIENCE_VH;
            teamActive.current = vh > TEAM_FROM && vh < TEAM_TO;
            const light = vh > 434;
            if (header.current && header.current.dataset.light !== String(light)) header.current.dataset.light = String(light);
          },
        },
      });
      const at = (time, duration, vars, ease) => tl.to(S, { ...vars, duration, ...(ease ? { ease } : {}) }, time);

      // 01 — The Awakening / the land of light: far out over the dunes, the
      // centre beam ahead; the streaks come down out of the sky, many at
      // once, the land turning to light as they do — the camera flying on in,
      // all the way
      at(3, 97, { fall: 1 }, "none");
      at(0, 228, { camY: 9, camZ: 22, tY: 10, tZ: -200 }, "none");
      // 02 — into the team's section, behind the hero: the bunq transition
      // turns the flight over to the team's stage; there the person gathers
      // out of the light
      // (over a long stretch of scroll: the discs grow slowly, the flight
      // carrying on through them)
      at(148, 80, { cut: 1 }, "sine.inOut");
      // (the person is there, whole, as the team's section comes in: formed
      // before the transition, out of sight)
      at(130, 16, { reveal: 1 }, "power2.inOut");
      at(150, 70, { beams: 0.4 }, "sine.inOut");
      at(230, 20, { dark: 0.2 }, "sine.inOut");
      // 03 — The Team (the camera all but still; the slider does the rest)
      at(250, 124, { teamPush: 0.4 }, "none");
      // 04 — Into the Light
      at(374, 25, { exit: 1, currents: 1.2 }, "power1.in");
      at(397, 27, { light: 1, flat: 1, beams: 1.3 });
      at(422, 32, { white: 1 }, "power1.inOut");

      // the copy
      tl.to(q("[data-cue]"), { autoAlpha: 0, duration: 6 }, 2);
      // (the two lines of copy: their words' blur-in, as V3's, played by the
      // scroll — in, and back out the same way as it scrolls on; see below)
      tl.to(COPY, { intro: 0, duration: 20, ease: "none" }, 6);
      // 02 — as the land turns to light, out again before the transition
      tl.fromTo(COPY, { story: 0 }, { story: 1, duration: 20, ease: "none", immediateRender: false }, 48);
      tl.to(COPY, { story: 0, duration: 16, ease: "none" }, 118);
      // 03 — the team's copy, each line out of a blur
      tl.fromTo(q("[data-team]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 6, ease: "none" }, TEAM_FROM - 6);
      tl.fromTo(q("[data-team-line]"), { y: 24, autoAlpha: 0, filter: "blur(10px)" }, { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 10, stagger: 1.2, ease: "power2.out" }, TEAM_FROM - 6);
      tl.to(q("[data-team]"), { autoAlpha: 0, y: -24, filter: "blur(10px)", duration: 10, ease: "power1.in" }, TEAM_TO - 6);
      tl.set({}, {}, EXPERIENCE_VH);
    },
    { scope: root }
  );

  // The words' animation, as V3's (GSAP SplitText): each heading character
  // by character, every one coming out of a blur in its own random turn; the
  // paragraph word by word, in reading order. Each is one paused timeline
  // whose progress is set from COPY (the scroll) — so the words come in with
  // the scroll and go again, the same blur played back, as it scrolls on;
  // the opening's first comes in on load. (Split once the fonts are in, so
  // the lines break where they will stay.)
  useEffect(() => {
    if (!env) return;
    let alive = true;
    const splits = [];
    const anims = [];
    const entrance = { v: 0 };
    let tick = null;
    const words = (el, heading, body) => {
      const tl = gsap.timeline({ paused: true });
      const h = SplitText.create(el.querySelectorAll(heading), { type: "words,chars" });
      splits.push(h);
      gsap.set(h.chars, { willChange: "transform, opacity, filter", force3D: true });
      tl.from(h.chars, { opacity: 0, filter: "blur(9px)", yPercent: 18, force3D: true, duration: 0.8, ease: "power3.out", stagger: { each: 0.028, from: "random" } }, 0);
      // (its paragraph, where it has one)
      const para = body && el.querySelector(body);
      if (para) {
        const b = SplitText.create(para, { type: "words" });
        splits.push(b);
        gsap.set(b.words, { willChange: "transform, opacity, filter", force3D: true });
        tl.from(b.words, { opacity: 0, filter: "blur(6px)", y: 10, force3D: true, duration: 0.6, ease: "power2.out", stagger: 0.04 }, 0.3);
      }
      // (shown now that its words are set to come in)
      gsap.set(el, { autoAlpha: 1 });
      return tl;
    };
    const build = () => {
      if (!alive) return;
      const intro = words(root.current.querySelector("[data-intro]"), "[data-intro-line]", "[data-intro-body]");
      const story = words(root.current.querySelector("[data-story]"), "[data-story-line]");
      anims.push(intro, story);
      const last = { a: -1, b: -1 };
      tick = () => {
        const a = entrance.v * COPY.intro;
        if (a !== last.a) intro.progress((last.a = a));
        if (COPY.story !== last.b) story.progress((last.b = COPY.story));
      };
      gsap.ticker.add(tick);
      // the first look: the opening comes in as the beam lights far off
      gsap.to(entrance, { v: 1, duration: 2.4, ease: "none", delay: 0.8 });
      gsap.fromTo(root.current.querySelector("[data-cue]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, delay: 2 });
    };
    if (document.fonts?.ready) document.fonts.ready.then(build);
    else build();
    return () => {
      alive = false;
      if (tick) gsap.ticker.remove(tick);
      gsap.killTweensOf(entrance);
      anims.forEach((t) => t.kill());
      splits.forEach((sp) => sp.revert());
    };
  }, [env]);

  // a review frame: ?p=0.5 jumps to that point of the experience
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("p");
    const el = root.current;
    if (p == null || !el) return;
    const t = setTimeout(() => window.scrollTo(0, el.offsetTop + Math.min(Math.max(parseFloat(p) || 0, 0), 1) * (el.offsetHeight - window.innerHeight)), 400);
    return () => clearTimeout(t);
  }, []);

  // ---------------------------------------------------------------------
  // The slider: the portrait's strands re-form into the next person.
  // ---------------------------------------------------------------------
  const goTo = useCallback(
    (next) => {
      if (busy.current || next === S.member) return;
      busy.current = true;
      const fast = !!getClientEnv()?.reduced;
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ onComplete: () => (busy.current = false) });
      tl.to(q("[data-swap]"), { y: -14, autoAlpha: 0, filter: "blur(10px)", duration: 0.5, stagger: 0.05, ease: "power2.in" }, 0);
      // the same strands re-forming from this face into the next one, in a
      // wave across the portrait (LightPortrait.jsx, uMorph); the copy turns
      // over midway, and once it is done the next is simply the member
      const dur = fast ? 0.6 : 2.1;
      tl.set(S, { morphTo: next, morph: 0 }, 0);
      tl.to(S, { morph: 1, duration: dur, ease: "sine.inOut" }, 0);
      tl.call(() => setIdx(next), null, dur * 0.42);
      tl.call(
        () => {
          S.member = next;
          S.morph = 0;
        },
        null,
        dur
      );
    },
    [S]
  );
  const step = useCallback((dir) => goTo((S.member + dir + n) % n), [goTo, S, n]);

  // the new member's copy in
  useGSAP(
    () => {
      gsap.fromTo(root.current.querySelectorAll("[data-swap]"), { y: 14, autoAlpha: 0, filter: "blur(10px)" }, { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.9, stagger: 0.08, ease: "power3.out", delay: 0.25 });
    },
    { scope: root, dependencies: [idx] }
  );

  // keys and swipes, while the team is on screen
  useEffect(() => {
    const key = (e) => {
      if (!teamActive.current) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    let start = null;
    const down = (e) => {
      if (teamActive.current && e.pointerType !== "mouse") start = { x: e.clientX, y: e.clientY };
    };
    const up = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
    };
    const el = stage.current;
    window.addEventListener("keydown", key);
    el?.addEventListener("pointerdown", down);
    el?.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("keydown", key);
      el?.removeEventListener("pointerdown", down);
      el?.removeEventListener("pointerup", up);
    };
  }, [step]);

  const toTeam = (e) => {
    e.preventDefault();
    const el = root.current;
    // (the timeline runs its EXPERIENCE_VH units over the pinned screen's scroll)
    const y = el.offsetTop + ((TEAM_FROM + 12) / EXPERIENCE_VH) * (el.offsetHeight - window.innerHeight);
    if (lenis) lenis.scrollTo(y, { duration: 2.4 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  const m = TEAM[idx];
  const isMissing = missing.some((x) => x.id === m.id);

  return (
    <main className="w-full bg-[#111111]">
      {/* header */}
      <header
        ref={header}
        data-light="false"
        className="group/h pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-[3.7vw] pt-[4vh] font-[family-name:var(--font-aeonikpro)] text-white transition-colors duration-500 data-[light=true]:text-[#111] max-[33.875rem]:px-[6vw]"
      >
        <Link href="/forging-sand-dune-concept-v3" aria-label="Hyperiux home" className="pointer-events-auto text-[1.05vw] tracking-[0.55em] max-[64rem]:text-sm max-[64rem]:tracking-[0.45em]">
          HYPERIUX
        </Link>
        <nav className="pointer-events-auto flex items-center gap-[1.2vw] text-[0.78vw] tracking-[0.24em] max-[64rem]:gap-3 max-[64rem]:text-[11px]">
          <NightToggle />
          <span aria-hidden="true" className="mx-[0.6vw] block h-[0.9vw] min-h-3 w-px bg-current opacity-30 max-[64rem]:mx-1" />
          <span aria-current="page">ABOUT</span>
          <span aria-hidden="true" className="opacity-60">
            /
          </span>
          <a href="#our-team" onClick={toTeam} className="transition-opacity hover:opacity-70">
            OUR TEAM
          </a>
          <span aria-hidden="true" className="ml-[1.6vw] block h-px w-[2.8vw] bg-[#FF5F00] max-[64rem]:ml-2 max-[64rem]:w-8" />
        </nav>
      </header>

      {/* the experience: EXPERIENCE_VH vh, one screen pinned */}
      <section ref={root} id="our-team" className="relative w-full" style={{ height: `${EXPERIENCE_VH}vh` }}>
        <div ref={stage} className="sticky top-0 h-svh w-full touch-pan-y overflow-hidden bg-[#0b0706]">
          <div className="pointer-events-none absolute inset-0">
            {env?.webgl && (
              <Canvas
                frameloop={visible ? "always" : "never"}
                dpr={env.quality.dpr}
                gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
                shadows="percentage"
                camera={{ position: [0, 20, 270], fov: 35, near: 0.5, far: 4000 }}
                aria-hidden="true"
              >
                <SceneBoundary>
                  <Suspense fallback={null}>
                    <AboutScene S={S} quality={env.quality} reduced={env.reduced} onMissing={onMissing} />
                  </Suspense>
                </SceneBoundary>
              </Canvas>
            )}
          </div>

          {/* 01: the opening (V3's hero type) */}
          <div data-intro className="invisible pointer-events-none absolute bottom-[13vh] left-[5vw] z-10 max-w-[44vw] text-white max-[64rem]:max-w-[80vw] max-[33.875rem]:bottom-[16vh] max-[33.875rem]:left-[6vw] max-[33.875rem]:max-w-[88vw]">
            <h1 className="font-[family-name:var(--font-aeonikpro)] text-[5.4vw] font-normal leading-[0.98] tracking-[-0.025em] max-[64rem]:text-[8vw] max-[33.875rem]:text-[11vw]">
              {INTRO.title.map((line) => (
                <span key={line} data-intro-line className="block pb-[0.08em]">
                  {line}
                </span>
              ))}
            </h1>
            <p data-intro-body className="mt-[1.8vw] max-w-[30vw] font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.5] text-white/80 max-[64rem]:max-w-[60vw] max-[64rem]:text-[2.2vw] max-[33.875rem]:mt-5 max-[33.875rem]:max-w-full max-[33.875rem]:text-[4vw]">
              {INTRO.body}
            </p>
          </div>

          {/* 02: as the land turns to light (V3's chapter type), low in the middle */}
          <div data-story className="invisible pointer-events-none absolute inset-x-[6vw] bottom-[11vh] z-10 flex flex-col items-center text-center text-white max-[33.875rem]:bottom-[14vh]">
            <p className="font-[family-name:var(--font-aeonikpro)] text-[2.7vw] font-light leading-[1.08] tracking-[-0.015em] [text-shadow:0_2px_10px_rgba(30,12,0,0.4)] max-[64rem]:text-[4.6vw] max-[33.875rem]:text-[7.4vw]">
              {STORY.title.map((line) => (
                <span key={line} data-story-line className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
          <div data-cue className="invisible pointer-events-none absolute bottom-[5vh] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3">
            <span className="font-[family-name:var(--font-aeonikpro)] text-[0.7vw] tracking-[0.4em] text-white/60 max-[64rem]:text-[10px]">{INTRO.cue.toUpperCase()}</span>
            <span className="block h-[5vh] w-px animate-pulse bg-gradient-to-b from-[#FF8A32] to-transparent" />
          </div>

          {/* 03: the team member */}
          <div
            data-team
            role="region"
            aria-roledescription="carousel"
            aria-label="The team"
            className="invisible absolute left-[5.9vw] top-[26.5%] z-20 w-[26vw] text-white max-[64rem]:inset-x-[6vw] max-[64rem]:bottom-[6vh] max-[64rem]:top-auto max-[64rem]:w-auto"
          >
            <div aria-live="polite">
              <h2 data-team-line className="overflow-hidden">
                <span data-swap className="block pb-[0.08em] font-[family-name:var(--font-aeonikpro)] text-[3.4vw] font-normal leading-[1] tracking-[-0.025em] max-[64rem]:text-[7.4vw]">
                  {m.name}
                </span>
              </h2>
              <p data-team-line className="mt-[1.2vw] overflow-hidden max-[64rem]:mt-2">
                <span data-swap className="block font-[family-name:var(--font-aeonikpro)] text-[0.8vw] uppercase tracking-[0.3em] text-[#FF8A32] max-[64rem]:text-[11px]">
                  {m.role}
                </span>
              </p>
              <p data-team-line className="mt-[2.6vw] max-w-[19vw] max-[64rem]:mt-4 max-[64rem]:max-w-none">
                <span data-swap className="block font-[family-name:var(--font-aeonikpro)] text-[0.98vw] leading-[1.55] text-white/80 max-[64rem]:text-sm">
                  {m.bio}
                </span>
              </p>
              {isMissing && (
                <p data-swap className="mt-[1vw] max-w-[22vw] rounded border border-[#FF5F00]/40 bg-black/50 px-2 py-1 font-mono text-[10px] leading-snug text-[#ffb07a] max-[64rem]:max-w-none">
                  Portrait source missing: public{m.source}. Showing a silhouette until the photo is added.
                </p>
              )}
            </div>
            <div data-team-line className="mt-[4.3vw] flex items-center gap-[3.3vw] max-[64rem]:mt-6 max-[64rem]:gap-6">
              <RoundButton dir={-1} onClick={() => step(-1)} label={`Previous: ${TEAM[(idx - 1 + n) % n].name}`} />
              <span className="font-[family-name:var(--font-aeonikpro)] text-[0.95vw] tracking-[0.3em] text-white max-[64rem]:text-xs" aria-label={`${idx + 1} of ${n}`}>
                {pad(idx + 1)} / {pad(n)}
              </span>
              <RoundButton dir={1} onClick={() => step(1)} label={`Next: ${TEAM[(idx + 1) % n].name}`} />
            </div>
            <div data-team-line className="ml-[3.3vw] mt-[1.9vw] flex gap-[0.5vw] max-[64rem]:ml-0 max-[64rem]:mt-4 max-[64rem]:gap-1.5" aria-hidden="true">
              {TEAM.map((p, i) => (
                <span key={p.id} className={`block h-[2px] w-[2.15vw] transition-colors duration-700 max-[64rem]:w-8 ${i === idx ? "bg-[#FF5F00]" : "bg-white/25"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {env?.leva && (
        <TuningPanel
          onJump={(vh) => {
            const el = root.current;
            const y = el.offsetTop + (vh / EXPERIENCE_VH) * (el.offsetHeight - window.innerHeight);
            if (lenis) lenis.scrollTo(y, { immediate: true });
            else window.scrollTo(0, y);
          }}
        />
      )}

      {/* where the light lands: the 2D page continues from here */}
      <section data-about-white className="relative z-10 flex min-h-svh w-full flex-col justify-center bg-white px-[5.9vw] text-[#111] max-[33.875rem]:px-[6vw]">
        <h2 className="font-[family-name:var(--font-aeonikpro)] text-[5.4vw] font-normal leading-[0.98] tracking-[-0.025em] max-[64rem]:text-[8vw] max-[33.875rem]:text-[11vw]">{WHITE.title}</h2>
        <span className="mt-[2vw] block h-[3px] w-[4vw] bg-[#FF5F00] max-[64rem]:mt-6 max-[64rem]:w-12" />
      </section>
    </main>
  );
}

// Day / night, V3's own switch (shared with the homepage's).
function NightToggle() {
  const [night, setLocal] = useState(() => V3T.night);
  useEffect(() => {
    const sync = (e) => setLocal(e.detail);
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, []);
  return (
    <button type="button" onClick={() => setNight(!night)} aria-pressed={night} className="cursor-pointer tracking-[0.24em] opacity-70 transition-opacity hover:opacity-100">
      {night ? "DAY" : "NIGHT"}
    </button>
  );
}

function RoundButton({ dir, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group flex size-[2.6vw] min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-full border border-white/85 text-white transition-colors duration-300 hover:border-[#FF5F00] hover:bg-[#FF5F00] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF8A32]"
    >
      <svg viewBox="0 0 16 16" className={`w-[0.9vw] min-w-3.5 transition-transform duration-300 ${dir > 0 ? "group-hover:translate-x-0.5" : "rotate-180 group-hover:-translate-x-0.5"}`} fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 8h11M9 4l4 4-4 4" />
      </svg>
    </button>
  );
}
