"use client";

import { Component, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HyperiuxScene from "./scene/HyperiuxScene";
import { BeatOverlays, ChapterRail, SceneTransition } from "./Overlays";
import { LIGHT_TONE_AT, S, TOTAL, chapterAt } from "./timeline";
import { TONE_EVENT } from "./env";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// A broken scene must not take the page down: the overlays and the white
// site still work without it.
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[origin-forge] 3D scene failed", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const BEATS_LIGHT_AT = 98.3;
const setTone = (tone) => window.dispatchEvent(new CustomEvent(TONE_EVENT, { detail: tone }));

// The pinned cinematic section. One GSAP master timeline, scrubbed by one
// ScrollTrigger, drives the clock the 3D scene reads (S.t), every overlay,
// the chapter rail and the white transition. Scrolling back reverses all of
// it. Once the section is scrolled past, the canvas is unmounted (the
// WebGL context, geometries and textures are released) and mounted again
// only if the visitor scrolls back up into it.
export default function HyperiuxExperience({ env }) {
  const { tier, debugT } = env;
  const section = useRef();
  const stage = useRef();
  const [live, setLive] = useState(true);
  const [ready, setReady] = useState(false);
  const [dpr, setDpr] = useState(tier.dpr);
  const onReady = useCallback(() => setReady(true), []);

  useGSAP(
    () => {
      const root = stage.current;
      S.t = 0;
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      tl.to(S, { t: TOTAL, duration: TOTAL }, 0);

      // beats: in, hold, out
      root.querySelectorAll("[data-beat]").forEach((el) => {
        const a = +el.dataset.a;
        const b = +el.dataset.b;
        const parts = el.querySelectorAll("[data-in]");
        if (a > 0) {
          tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, a);
          tl.fromTo(parts, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.08, ease: "power2.out" }, a);
        }
        if (b < TOTAL) tl.to(el, { autoAlpha: 0, y: -14, duration: 0.6, ease: "power1.in" }, b - 0.6);
      });

      // the rail fades before the summit
      const rail = root.querySelector("[data-rail]");
      const fill = root.querySelector("[data-rail-fill]");
      const items = root.querySelectorAll("[data-chapter]");
      tl.to(rail, { autoAlpha: 0, duration: 0.8 }, 96.6);

      // summit → white: a line sweeps across, then the light opens. (The
      // line's svg stays hidden until then: a dashed, non-scaling stroke can
      // leave a sliver of itself showing.)
      tl.fromTo(root.querySelector(".of-transition__svg"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 97.2);
      tl.fromTo(root.querySelectorAll("[data-sweep]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.7, ease: "power2.inOut" }, 97.3);
      tl.fromTo(root.querySelector("[data-wipe]"), { clipPath: "circle(0% at 82% 14%)" }, { clipPath: "circle(150% at 82% 14%)", duration: 1.5, ease: "power2.in" }, 98.4);
      tl.set({}, {}, TOTAL);

      let tone = null;
      let chapter = -1;
      const onUpdate = () => {
        const t = S.t;
        fill.style.transform = `scaleX(${t / TOTAL})`;
        const c = chapterAt(t);
        if (c !== chapter) {
          chapter = c;
          items.forEach((it, i) => it.classList.toggle("is-active", i === c));
        }
        // the header turns dark-on-light with the ivory hall; the beats stay
        // light-on-dark over the bronze stairs, and turn only for the white
        const next = t > LIGHT_TONE_AT ? "light" : "dark";
        if (next !== tone) {
          tone = next;
          setTone(next);
        }
        const ink = t > BEATS_LIGHT_AT ? "light" : "dark";
        if (ink !== root.dataset.tone) root.dataset.tone = ink;
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
        scrub: 0.85,
        animation: tl,
        onLeave: () => {
          setLive(false);
          setTone("light");
        },
        onEnterBack: () => {
          setLive(true);
          tone = null;
          onUpdate();
        },
      });
      onUpdate();
      // landing mid-page (reload, deep link): don't mount a scene nobody sees
      if (section.current.getBoundingClientRect().bottom < 0) setLive(false);
    },
    { scope: section, dependencies: [debugT] }
  );

  return (
    <section ref={section} id="of-experience" className="of-experience" style={{ height: `${TOTAL * tier.vhPerUnit}vh` }} aria-label="The Origin Forge, a scroll-driven film">
      <div ref={stage} className="of-stage" data-ready={ready || undefined} data-tone="dark">
        <div className="of-canvas">
          {live && (
            <SceneBoundary>
              <Canvas
                dpr={dpr}
                shadows={tier.shadows}
                gl={{ antialias: !tier.post, powerPreference: "high-performance", alpha: false, stencil: false }}
                camera={{ fov: 40, near: 0.1, far: 900, position: [0, 2.3, 62] }}
                onCreated={({ gl }) => {
                  gl.toneMapping = THREE.NeutralToneMapping;
                  gl.setClearColor("#070706");
                }}
              >
                <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} />
                <HyperiuxScene tier={tier} onReady={onReady} />
              </Canvas>
            </SceneBoundary>
          )}
        </div>
        <BeatOverlays />
        <ChapterRail />
        <SceneTransition />
        <div className="of-loader" aria-hidden={ready}>
          <svg viewBox="0 0 500 501" className="of-loader__mark" aria-hidden>
            <path d="M40 13H106.261V222.826H40V13Z" />
            <path d="M459.654 487.869H393.394V278.043H459.654V487.869Z" />
            <path d="M40.1406 278.043V487.869H106.401V322.217L198.062 287.983V223.931L40.1406 278.043Z" />
            <path d="M393.527 178.653V13.0007H460.892V222.826L291.927 290.889V222.826L393.527 178.653Z" />
          </svg>
          <p className="of-loader__label">Entering the forge</p>
        </div>
      </div>
    </section>
  );
}

