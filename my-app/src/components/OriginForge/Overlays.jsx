"use client";

import { BEATS, CHAPTERS } from "./timeline";
import { HERO } from "./content";

// The text that sits over the 3D journey: one beat at a time, kept small and
// to the edges so the world carries the story. Every element here is
// animated by the master timeline (HyperiuxExperience.jsx), never by React
// state, so scrolling costs no re-renders.

export function BeatOverlays() {
  return (
    <div className="of-beats" aria-live="off">
      {BEATS.map((b) => (
        <div key={b.n} className={`of-beat of-beat--${b.kind || "caption"}`} data-beat data-a={b.a} data-b={b.b}>
          <p className="of-beat__label" data-in>
            <span className="of-beat__n">{b.n}</span>
            {b.label}
          </p>
          <BeatBody beat={b} />
        </div>
      ))}
    </div>
  );
}

function BeatBody({ beat }) {
  switch (beat.kind) {
    case "hero":
      return (
        <div className="of-hero">
          <p className="of-hero__brand" data-in>
            {HERO.brand}
          </p>
          <h1 className="of-hero__title">
            {HERO.title.map((l) => (
              <span key={l} className="of-line" data-in>
                {l}
              </span>
            ))}
            <span className="of-line of-accent" data-in>
              {HERO.accent}
            </span>
          </h1>
          <p className="of-hero__body" data-in>
            {HERO.body}
          </p>
          <p className="of-hero__cue" data-in>
            <span className="of-hero__cue-line" />
            Scroll to enter
          </p>
        </div>
      );
    case "pillar":
      return (
        <div className="of-beat__foot">
          <h2 className="of-beat__title" data-in>
            {beat.title}
          </h2>
          <p className="of-beat__body" data-in>
            {beat.body}
          </p>
        </div>
      );
    case "process":
      return (
        <div className="of-beat__foot of-beat__foot--high">
          <h2 className="of-beat__display" data-in>
            Our <span className="of-accent">Process.</span>
          </h2>
          <p className="of-beat__body" data-in>
            {beat.body}
          </p>
        </div>
      );
    case "step":
      return (
        <div className="of-beat__foot of-beat__foot--high">
          <p className="of-beat__step-n" data-in>
            [{beat.step.n}]
          </p>
          <h2 className="of-beat__display" data-in>
            {beat.step.name}.
          </h2>
          <p className="of-beat__body" data-in>
            {beat.step.body}
          </p>
        </div>
      );
    case "summit":
      return null;
    default:
      return (
        <div className="of-beat__foot">
          <p className="of-beat__body" data-in>
            {beat.body}
          </p>
        </div>
      );
  }
}

// Chapter rail: five chapters, a hairline fill (scaled by the timeline).
export function ChapterRail() {
  return (
    <nav className="of-rail" aria-label="Chapters" data-rail>
      <div className="of-rail__track">
        <div className="of-rail__fill" data-rail-fill />
      </div>
      <ol className="of-rail__list">
        {CHAPTERS.map((c, i) => (
          <li key={c.name} className="of-rail__item" data-chapter={i} style={{ left: `${c.a}%` }}>
            <span className="of-rail__n">0{i + 1}</span>
            <span className="of-rail__name">{c.name}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// The summit → white transition: a copper-orange line sweeps across the
// screen along the railing's curve, and from its end the light opens into
// the white of the site.
export function SceneTransition() {
  return (
    <div className="of-transition" aria-hidden>
      <svg className="of-transition__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <path className="of-transition__glow" d="M -60 940 C 260 980 420 760 560 560 S 820 120 1080 -60" pathLength="1" data-sweep />
        <path className="of-transition__line" d="M -60 940 C 260 980 420 760 560 560 S 820 120 1080 -60" pathLength="1" data-sweep />
      </svg>
      <div className="of-transition__white" data-wipe />
    </div>
  );
}
