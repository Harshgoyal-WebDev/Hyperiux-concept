"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useLenis } from "lenis/react";
import { ACTS, BEATS, DISCIPLINES } from "./content";
import { STATE, STORY, beatQ, onStory, scrollFor, smooth } from "./story";
import { CLUSTERS } from "./world/states";

// The opening: a tall section whose sticky screen holds the copy of beats
// 01–15 over the canvas. One ScrollTrigger (CuriosityToImpact.jsx) turns
// its scroll into the story's time; here, every tick, each beat's lines rise
// in as it begins and leave as it ends — written straight to the DOM.

const Line = ({ children, className = "" }) => (
  <span className={`cti-line ${className}`}>
    <span className="cti-line-in">{children}</span>
  </span>
);

function Title({ lines, as: Tag = "h2", className }) {
  return (
    <Tag className={className}>
      {lines.map((segs, i) => (
        <Line key={i}>
          {segs[0]}
          {segs[1] && <span className="text-[#FF5F1F]">{segs[1]}</span>}
        </Line>
      ))}
    </Tag>
  );
}

function Caps({ lines }) {
  return (
    <p className="cti-caps">
      {lines.map((l, i) => (
        <Line key={i} className={l.startsWith("@") ? "text-[#FF5F1F]" : ""}>
          {l.replace(/^@/, "")}
        </Line>
      ))}
    </p>
  );
}

const PLACE = {
  centre: "inset-0 flex items-center justify-center text-center",
  low: "left-[var(--gutter)] bottom-[16vh] max-w-[30rem]",
  lowRight: "right-[calc(var(--gutter)+3rem)] bottom-[16vh] text-left max-md:left-[var(--gutter)] max-md:right-auto",
  hero: "left-[var(--gutter)] top-1/2 -translate-y-1/2 max-w-[40rem] max-md:top-auto max-md:bottom-[12vh] max-md:translate-y-0 max-md:pr-[var(--gutter)]",
  left: "left-[var(--gutter)] top-1/2 -translate-y-1/2 max-w-[38rem] max-md:top-auto max-md:bottom-[14vh] max-md:translate-y-0",
  impact: "left-[var(--gutter)] top-1/2 -translate-y-1/2 max-w-[34rem] max-md:top-auto max-md:bottom-[12vh] max-md:translate-y-0 max-md:pr-[var(--gutter)]",
};

function Beat({ b, lenis }) {
  const explore = () => lenis?.scrollTo(scrollFor(5, 0.3), { duration: 2.4 });
  if (b.layout === "none" || b.layout === "labels") return null;
  return (
    <div data-beat={b.n} className={`cti-beat absolute ${PLACE[b.layout]}`}>
      {b.caps && <Caps lines={b.caps} />}
      {b.eyebrow && (
        <p className="cti-eyebrow mb-5">
          <Line>{b.eyebrow}</Line>
        </p>
      )}
      {b.title && <Title lines={b.title} as={b.n === 4 ? "h1" : "h2"} className={b.n === 4 ? "cti-hero" : "cti-display"} />}
      {b.body && (
        <p className="cti-body mt-6 max-w-[26rem]">
          <Line>{b.body}</Line>
        </p>
      )}
      {b.cta && (
        <div className="mt-9">
          <Line>
            <button type="button" onClick={explore} className="cti-cta-dark">
              <span className="size-1.5 rounded-full bg-[#FF5F1F]" aria-hidden="true" />
              {b.cta}
            </button>
          </Line>
        </div>
      )}
    </div>
  );
}

export default function Intro({ introRef, height }) {
  const stageRef = useRef(null);
  const lenis = useLenis();

  useEffect(() => {
    const stage = stageRef.current;
    const beats = [...stage.querySelectorAll("[data-beat]")].map((el) => ({
      el,
      n: +el.dataset.beat,
      lines: [...el.querySelectorAll(".cti-line-in")],
      last: "",
    }));
    const labels = [...stage.querySelectorAll("[data-label]")];
    const actNum = stage.querySelector("[data-act-num]");
    const ticks = [...stage.querySelectorAll("[data-tick]")];
    const scrollHint = stage.querySelector("[data-scroll-hint]");
    const v = new THREE.Vector3();
    let lastAct = -1;
    let lastBeat = -1;

    return onStory((story) => {
      // each beat: its lines rise in, one after another; then it leaves
      for (const b of beats) {
        const q = beatQ(b.n);
        const enter = b.n === 1 ? smooth(0.35, 1, story.boot) : 1;
        const out = smooth(0.8, 0.97, q);
        const shown = (b.n === 1 ? enter : smooth(0.02, 0.2, q)) * (1 - out);
        const key = `${shown.toFixed(3)}|${q.toFixed(3)}`;
        if (key === b.last) continue;
        b.last = key;
        b.el.style.visibility = shown > 0.001 ? "visible" : "hidden";
        b.el.style.opacity = (1 - out).toFixed(3);
        // (Tailwind's centring is the `translate` property: this composes with it)
        b.el.style.transform = `translateY(${(-out * 24).toFixed(1)}px)`;
        b.lines.forEach((l, i) => {
          const r = b.n === 1 ? enter : smooth(0.03 + i * 0.035, 0.22 + i * 0.035, q);
          l.style.transform = `translateY(${((1 - r) * 110).toFixed(1)}%)`;
        });
      }

      // the disciplines, where their clusters are (07)
      const la = STATE.labels;
      labels.forEach((el, i) => {
        if (la < 0.002 || !story.camera) {
          el.style.opacity = "0";
          return;
        }
        v.fromArray(CLUSTERS[i]).project(story.camera);
        el.style.opacity = (la * (v.z < 1 ? 1 : 0)).toFixed(3);
        el.style.transform = `translate(${(((v.x + 1) / 2) * window.innerWidth).toFixed(1)}px, ${(((1 - v.y) / 2) * window.innerHeight).toFixed(1)}px)`;
      });

      // the act and its beats, on the right
      let beat = 1;
      for (const b of BEATS) if (beatQ(b.n) > 0) beat = b.n;
      if (beat !== lastBeat) {
        lastBeat = beat;
        const act = BEATS[beat - 1].act;
        if (act !== lastAct) {
          lastAct = act;
          actNum.textContent = String(act + 1).padStart(2, "0");
        }
        ticks.forEach((t) => t.classList.toggle("is-on", +t.dataset.tick === beat));
        ticks.forEach((t) => t.classList.toggle("is-act", BEATS[+t.dataset.tick - 1].act === act));
      }
      scrollHint.style.opacity = (smooth(0.5, 1, story.boot) * (1 - smooth(0.02, 0.1, story.p))).toFixed(3);
    });
  }, []);

  return (
    <section ref={introRef} aria-label="From curiosity to impact" className="relative z-10" style={{ height }}>
      <div ref={stageRef} className="sticky top-0 h-[100svh] w-full overflow-hidden text-[var(--cti-ink)]">
        {BEATS.map((b) => (
          <Beat key={b.n} b={b} lenis={lenis} />
        ))}

        {DISCIPLINES.map((d) => (
          <span key={d} data-label className="cti-label absolute left-0 top-0 opacity-0" aria-hidden="true">
            <span className="cti-label-dot" />
            {d}
          </span>
        ))}

        {/* the act, and its beats */}
        <div className="absolute right-[var(--gutter)] top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex" aria-hidden="true">
          <span data-act-num className="font-mono text-[11px] tracking-[0.2em]">
            01
          </span>
          <div className="flex flex-col items-end gap-[7px]">
            {BEATS.map((b) => (
              <span key={b.n} data-tick={b.n} className="cti-tick" title={ACTS[b.act]} />
            ))}
          </div>
        </div>

        <div data-scroll-hint className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 opacity-0" aria-hidden="true">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="cti-scroll-line" />
        </div>
      </div>
    </section>
  );
}
