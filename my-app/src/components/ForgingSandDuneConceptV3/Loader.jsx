"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { T } from "./tuning";
import { loadProgress, startLoading } from "./loading";
import { prepareSound, unlockSound } from "./audio";
import { cubeOnScreen, loaderTiming } from "./loaderScene";

// The loader: all dark, only the outline of the cube cut out of the slab in
// the middle, drawing itself as the scene's assets come in (loading.js).
// Then "Hold to enter": pressed and held (the pointer, a finger, or the
// space / enter key), a bar under the cube fills, and behind the dark the
// scene's outlines glow in from the centre (Rig.jsx LoaderRevealEffect);
// let go too soon and it all falls back. Held long enough, a sweep reveals
// the scene in random patches, glowing along their edges, as the camera
// comes in from far off (J.arrive, Rig.jsx).
//
// (without the post effects — the lightest devices — the dark is this
// screen itself, fading away instead)

// The live loader's cube is drawn over the cube cut out of the slab, exactly
// — its hexagon and the three inner edges from their joint, as they lie on
// the screen: known from the opening shot from the first frame, then as the
// scene itself projects it (loaderScene.js cubeOnScreen). Never a stand-in
// of another shape.
const easeInOut = (x) => x * x * (3 - 2 * x);

// (the tuning panel's "Replay loader": the journey runs the loader again)
export const REPLAY_LOADER_EVENT = "forging-sand-dune-concept-v3:replay-loader";

export default function Loader({ J, problem, onEnter, onGone, post = true, replay = false }) {
  const root = useRef(null);
  const contentRef = useRef(null);
  const hexRef = useRef(null);
  const facesRef = useRef(null);
  const labelRef = useRef(null);
  const svgRef = useRef(null);
  const barRef = useRef(null);
  const percentRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const [sound, setSoundPref] = useState(true);
  const soundRef = useRef(true);
  const entering = useRef(false);
  const holding = useRef(false);

  // (the sound built ahead, quietly, once everything is in — so entering
  // only has to start it, fading in, with no wait)
  useEffect(() => {
    if (!ready) return;
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => prepareSound(), { timeout: 1500 });
    return () => cancel(id);
  }, [ready]);
  const problemRef = useRef(problem);
  useEffect(() => {
    problemRef.current = problem;
  }, [problem]);

  // (the header waits in the dark too, until the sweep has come in)
  useEffect(() => {
    const els = [document.querySelector("header"), document.querySelector("[data-hero]")].filter(Boolean);
    for (const el of els) el.style.opacity = "0";
    return () => {
      for (const el of els) el.style.opacity = "";
    };
  }, []);

  // the cube kept over the slab's own (and the words under it)
  useEffect(() => {
    let raf;
    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const p = cubeOnScreen(w, h);
      if (svgRef.current) svgRef.current.style.opacity = p ? "1" : "0";
      if (!p) {
        if (labelRef.current) labelRef.current.style.transform = `translate(${(w / 2).toFixed(1)}px, ${(h * 0.5).toFixed(1)}px) translateX(-50%)`;
        raf = requestAnimationFrame(tick);
        return;
      }
      const hex = hexRef.current;
      if (hex) {
        let d = "";
        for (let i = 0; i < 6; i++) d += `${i ? "L" : "M"}${p[i * 2].toFixed(1)},${p[i * 2 + 1].toFixed(1)}`;
        hex.setAttribute("d", d + "Z");
      }
      const faces = facesRef.current?.children;
      if (faces) {
        // (out from the joint to the hexagon's corners 0, 2 and 4)
        [0, 2, 4].forEach((k, n) => {
          faces[n]?.setAttribute("d", `M${p[12].toFixed(1)},${p[13].toFixed(1)}L${p[k * 2].toFixed(1)},${p[k * 2 + 1].toFixed(1)}`);
        });
      }
      if (labelRef.current) {
        let cx = 0;
        let bottom = -Infinity;
        for (let i = 0; i < 6; i++) {
          cx += p[i * 2] / 6;
          bottom = Math.max(bottom, p[i * 2 + 1]);
        }
        labelRef.current.style.transform = `translate(${cx.toFixed(1)}px, ${(bottom + Math.max(h * 0.03, 18)).toFixed(1)}px) translateX(-50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // loading: the cube's outline draws itself — eased towards the real
  // progress, never back, closed only when everything is in
  useEffect(() => {
    startLoading();
    // (run again from the panel: everything is in already)
    let shown = replay ? 0.999 : 0;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = loadProgress(J, problemRef.current);
      const goal = target >= 1 ? 1 : Math.min(target, 0.97);
      shown = Math.max(shown, shown + (goal - shown) * (1 - Math.exp(-dt * 4)));
      if (target >= 1 && 1 - shown < 0.004) shown = 1;
      if (hexRef.current) hexRef.current.style.strokeDashoffset = String(1 - shown);
      if (percentRef.current) percentRef.current.textContent = `${String(Math.round(shown * 100)).padStart(2, "0")}%`;
      if (shown >= 1) {
        setReady(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [J, replay]);

  const enter = () => {
    if (entering.current) return;
    entering.current = true;
    holding.current = false;
    // (the music once the loader is done — its reveal over — not before)
    onEnter({ quiet: !soundRef.current, soundDelay: 0.4 + loaderTiming().total });
    // the cube flares, and it all lifts away...
    gsap.to(contentRef.current, { autoAlpha: 0, scale: 1.08, filter: "blur(6px)", duration: 0.8, ease: "power2.in" });
    // ...as the sweep reveals the scene behind (Rig.jsx), the outlines
    // fading with the dark they are drawn on
    const duration = loaderTiming().total;
    // (a beat first: entering starts the sound and the scene's entrance, a
    // busy frame or two — over the outlines, not eating into the sweep)
    const lag = 0.4;
    gsap.to(J, { loaderSweep: 1, duration, delay: lag, ease: "none" });
    // (without the post effects, this screen is the dark: it fades)
    if (!post && root.current) gsap.to(root.current, { backgroundColor: "rgba(3,2,2,0)", duration, delay: lag, ease: "power1.inOut" });
    for (const el of [document.querySelector("header"), document.querySelector("[data-hero]")]) {
      if (el) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 1, delay: lag + duration * 0.6, ease: "power1.out", clearProps: "opacity" });
    }
    gsap.delayedCall(lag + duration, () => {
      J.loaderHold = 0;
      setGone(true);
      onGone?.();
    });
  };

  // held: the bar fills (and the cube's faces draw in, and the scene's
  // outlines glow in behind); let go, it all drains back, quicker
  useEffect(() => {
    if (!ready) return;
    let v = 0;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const span = Math.max(T.loaderHold, 0.2);
      v = Math.min(Math.max(v + (holding.current ? dt / span : (-dt * 2.5) / span), 0), 1);
      const e = easeInOut(v);
      J.loaderHold = e;
      if (barRef.current) barRef.current.style.transform = `scaleX(${v})`;
      // (each edge drawn as far as the bar has filled — measured along the
      // edge itself: pathLength 1)
      if (facesRef.current) for (const line of facesRef.current.children) line.style.strokeDashoffset = String(1 - v);
      if (v >= 1) {
        enter();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // (enter reads only refs and stable props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, J]);

  // the hold: the pointer or a finger anywhere on the screen, or the space
  // or enter key
  useEffect(() => {
    if (!ready) return;
    const up = () => {
      holding.current = false;
    };
    const typing = (e) => {
      const el = e.target;
      return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || el?.isContentEditable;
    };
    const keyDown = (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat && !entering.current && !typing(e)) {
        e.preventDefault();
        holding.current = true;
        if (soundRef.current) unlockSound();
      }
    };
    const keyUp = (e) => {
      if (e.key === " " || e.key === "Enter") up();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [ready]);
  const press = (e) => {
    if (!ready || entering.current) return;
    if (e.button !== undefined && e.button !== 0) return;
    holding.current = true;
    // (the press is the gesture the browser needs before sound can start)
    if (soundRef.current) unlockSound();
  };

  if (gone) return null;
  // (out of <main>: over the header, out of the journey's sticky frame)
  return createPortal(
    <div
      ref={root}
      className={`fixed inset-0 z-[100] select-none [-webkit-touch-callout:none] [touch-action:none] ${ready ? "cursor-pointer" : ""}`}
      // (dark until the scene is in; then, with the post effects, the dark is
      // the scene's own — Rig.jsx — and this screen only carries the cube)
      style={{ backgroundColor: ready && post ? "rgba(3,2,2,0)" : "rgb(3,2,2)", transition: "background-color 0.6s ease-out" }}
      role="dialog"
      aria-label="Loading the experience"
      aria-busy={!ready}
      onPointerDown={press}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={contentRef} className="absolute inset-0">
        <Corners />
        {/* the cube, over the slab's own (placed every frame, above) */}
        <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ opacity: 0, transition: "opacity 0.6s ease-out" }} aria-hidden="true">
          <path ref={hexRef} pathLength="1" fill="none" stroke="rgba(255,236,220,0.85)" strokeWidth="1" strokeLinejoin="round" style={{ strokeDasharray: "1 1", strokeDashoffset: 1 }} />
          <g ref={facesRef} fill="none" stroke="#ff7a2a" strokeWidth="1.2" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px rgba(255,95,0,0.8))" }}>
            {[0, 1, 2].map((n) => (
              <path key={n} pathLength="1" style={{ strokeDasharray: "1 1", strokeDashoffset: 1 }} />
            ))}
          </g>
        </svg>
        {/* (the bar and the words under the cube; centred until it is there,
            then easing down under it) */}
        <div ref={labelRef} className="absolute left-0 top-0 flex flex-col items-center" style={{ transform: "translate(50vw, 50vh) translateX(-50%)", transition: "transform 0.6s ease-out" }}>
          {/* the hold's bar */}
          <div className={`h-[2px] w-[9vw] overflow-hidden bg-white/12 transition-opacity duration-700 max-[64rem]:w-32 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            <div ref={barRef} className="h-full w-full origin-left bg-[#ff5f00]" style={{ transform: "scaleX(0)" }} />
          </div>
          <p className={`${LABEL} mt-[1.1vw] max-[64rem]:mt-4`} aria-live="polite">
            {ready ? (
              <span className="animate-[pulse_2.4s_ease-in-out_infinite]">Hold to enter</span>
            ) : (
              <>
                Loading <span ref={percentRef}>00%</span>
              </>
            )}
          </p>
        </div>
        {/* the sound, on or off for the way in (the header's toggle can change it later) */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            soundRef.current = !soundRef.current;
            setSoundPref(soundRef.current);
          }}
          className={`${LABEL} absolute bottom-[2.2vw] right-[2.6vw] cursor-pointer transition-opacity duration-700 hover:text-white focus-visible:text-white focus-visible:outline-none max-[64rem]:bottom-6 max-[64rem]:right-6 ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
          tabIndex={ready ? 0 : -1}
          aria-pressed={sound}
        >
          Sound {sound ? "on" : "off"}
        </button>
      </div>
    </div>,
    // (beside the page's <main>, inside the layout that carries the site's
    // fonts: on <body> it would fall back to Arial)
    document.querySelector("main")?.parentElement ?? document.body
  );
}

const LABEL = "font-[family-name:var(--font-aeonikpro)] text-[0.72vw] uppercase tracking-[0.28em] text-white/60 max-[64rem]:text-[11px]";

// the cube cut out of the slab, in outline: its hexagon drawing itself as
// the scene loads, its faces as it is held

// four corner marks framing the screen
function Corners() {
  const mark = "absolute h-[0.9vw] w-[0.9vw] border-white/30 max-[64rem]:h-3 max-[64rem]:w-3";
  return (
    <div className="pointer-events-none absolute inset-[1.6vw] max-[64rem]:inset-4" aria-hidden="true">
      <span className={`${mark} left-0 top-0 border-l border-t`} />
      <span className={`${mark} right-0 top-0 border-r border-t`} />
      <span className={`${mark} bottom-0 left-0 border-b border-l`} />
      <span className={`${mark} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}

// The loader as the page arrives, before its script runs: the same dark and
// the cube, still, in the server's HTML, so the hero never shows first. The
// live loader takes its place (or it simply goes, for a review frame).
export function LoaderCover() {
  return (
    <div className="fixed inset-0 z-[100] bg-[rgb(3,2,2)]" aria-hidden="true">
      <Corners />
      {/* (no cube yet: it is drawn over the slab's own, once that is there) */}
      <div className="absolute left-0 top-0 flex flex-col items-center" style={{ transform: "translate(50vw, 50vh) translateX(-50%)" }}>
        <div className="h-[2px] w-[9vw] opacity-0 max-[64rem]:w-32" />
        <p className={`${LABEL} mt-[1.1vw] max-[64rem]:mt-4`}>Loading 00%</p>
      </div>
    </div>
  );
}
