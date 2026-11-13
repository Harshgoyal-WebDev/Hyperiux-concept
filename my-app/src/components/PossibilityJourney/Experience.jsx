"use client";

import { Component, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { BEATS, DROP_HIT, S, TOTAL, chapterAt } from "./timeline";
import { NIGHT_BEATS, NIGHT_WHITE_FROM, nightChapterAt } from "./night/timeline";
import NightWorld from "./night/NightWorld";
import { CHAPTERS, NIGHT_CHAPTERS } from "./content";
import { ChapterOverlays, ChapterRail, Threshold } from "./Overlays";
import World from "./scene/World";
import { THEME } from "./theme";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// If the 3D world cannot run after all, the page goes on without it: the
// overlays still tell the chapters over the stage's warm background.
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn("[from-possibility] the 3D world could not start:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// The immersive journey: a pinned stage (CSS sticky inside a tall section),
// one persistent canvas, and one master GSAP timeline scrubbed by one
// ScrollTrigger. The timeline tweens the clock the world reads (S.t, 0–100)
// and, on the same timeline, every chapter's words, the progress rail and
// the hand-over to the page, so picture and text can never drift apart.
// Scrolling back retraces it exactly; once scrolled past, the canvas is
// unmounted (WebGL released) and comes back only if the visitor returns.
// the two versions' stories: their chapters, timing, world and how far they see
const STORIES = {
  light: { chapters: CHAPTERS, beats: BEATS, chapterAt, whiteFrom: DROP_HIT + 0.15, World, far: 340 },
  dark: { chapters: NIGHT_CHAPTERS, beats: NIGHT_BEATS, chapterAt: nightChapterAt, whiteFrom: NIGHT_WHITE_FROM, World: NightWorld, far: 1700 },
};

export default function Experience({ env, vhPerUnit }) {
  const { tier, debugT } = env;
  const story = STORIES[THEME.name] || STORIES.dark;
  const SceneWorld = story.World;
  const section = useRef();
  const stage = useRef();
  const [live, setLive] = useState(true);
  const [ready, setReady] = useState(false);
  // (a pixel ratio of 1.5 at most: past it the cost grows faster than the gain)
  const [dpr, setDpr] = useState(Math.min(tier.dpr, 1.5));
  const onReady = useCallback(() => setReady(true), []);

  useGSAP(
    () => {
      const root = stage.current;
      S.t = 0;
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      tl.to(S, { t: TOTAL, duration: TOTAL }, 0);

      // each chapter's words: in, hold, out (the opening is there from the start)
      root.querySelectorAll("[data-beat]").forEach((el, i) => {
        const { a, b } = story.beats[i];
        const parts = el.querySelectorAll("[data-in]");
        if (a > 0) {
          tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, a);
          tl.fromTo(parts, { yPercent: 105 }, { yPercent: 0, duration: 1.1, stagger: 0.12, ease: "power3.out" }, a);
        }
        tl.to(el, { autoAlpha: 0, y: -16, duration: 0.8, ease: "power1.in" }, b - 0.8);
      });

      // the hand-over: a drop falls into the basin, and its ripple opens the
      // page from the centre of the screen. With post-processing the ripple
      // is drawn in the picture (RippleTransition) and this veil only seals
      // the very end; without it, the veil itself opens as a circle.
      const rail = root.querySelector("[data-rail]");
      tl.to(rail, { autoAlpha: 0, duration: 0.8 }, 93);
      const veil = root.querySelector("[data-veil]");
      const from = story.whiteFrom;
      if (tier.post) tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: TOTAL - 99.3 }, 99.3);
      else tl.fromTo(veil, { opacity: 1, clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)", duration: TOTAL - from, ease: "power1.in" }, from);
      tl.set({}, {}, TOTAL);

      const fill = root.querySelector("[data-rail-fill]");
      const items = root.querySelectorAll("[data-chapter]");
      let chapter = -1;
      const onUpdate = () => {
        fill.style.transform = `scaleX(${S.t / TOTAL})`;
        // (the dark version ends in light: its last words, and the header, turn dark)
        const lit = THEME.name === "dark" && S.t > 92.5;
        if (lit !== root.classList.contains("is-lit")) {
          root.classList.toggle("is-lit", lit);
          document.documentElement.classList.toggle("pj-lit", lit);
        }
        const c = story.chapterAt(S.t);
        if (c !== chapter) {
          chapter = c;
          items.forEach((it, i) => it.classList.toggle("is-active", i === c));
        }
      };
      tl.eventCallback("onUpdate", onUpdate);

      if (debugT != null) {
        tl.time(debugT);
        onUpdate();
        return;
      }
      ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        animation: tl,
        onLeave: () => setLive(false),
        onEnterBack: () => setLive(true),
      });
      onUpdate();
      // landing mid-page (reload, deep link): don't start a world nobody sees
      if (section.current.getBoundingClientRect().bottom < 0) setLive(false);
    },
    { scope: section, dependencies: [debugT, tier.post, story] }
  );

  return (
    <section ref={section} id="pj-journey" className="pj-journey" style={{ height: `${TOTAL * vhPerUnit}vh` }} aria-label="The Hyperiux journey, from possibility to experience">
      <div ref={stage} className="pj-stage" data-ready={ready || undefined}>
        <div className="pj-canvas">
          {live && (
            <SceneBoundary>
              <Canvas
                dpr={dpr}
                shadows={tier.shadows ? "percentage" : false}
                gl={{ antialias: !tier.post, powerPreference: "high-performance", alpha: false, stencil: false }}
                camera={{ fov: 52, near: 0.1, far: story.far, position: [0, 3, 46] }}
                onCreated={({ gl }) => {
                  gl.toneMapping = THREE.NeutralToneMapping;
                  gl.setClearColor(THEME.clear);
                }}
              >
                <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.2))} />
                <SceneWorld tier={tier} onReady={onReady} />
              </Canvas>
            </SceneBoundary>
          )}
        </div>
        <ChapterOverlays chapters={story.chapters} />
        <ChapterRail chapters={story.chapters} />
        <Threshold />
        <div className="pj-loader" aria-hidden={ready}>
          <span className="pj-loader__line" />
          <p className="pj-loader__label">Entering Hyperiux</p>
        </div>
      </div>
    </section>
  );
}
