"use client";

import { Mark } from "./Brand";
import { HERO, PILLARS, STEPS } from "./content";
import { ServiceIcon } from "./WhiteStorySections";

// The Origin Forge without WebGL (or with reduced motion): the same story,
// told in still, CSS-only frames: the forgotten world and its four forces,
// the mark they forge, and the ivory ascent of the process.
const ICONS = ["strategy", "design", "development", "marketing"];

export default function StaticJourney({ reason }) {
  return (
    <div className="of-static">
      <section className="of-static__hero">
        <div className="of-static__glow" aria-hidden />
        <div className="of-wrap of-static__hero-inner">
          <p className="of-hero__brand">{HERO.brand}</p>
          <h1 className="of-hero__title">
            {HERO.title.map((l) => (
              <span key={l} className="of-line">
                {l}
              </span>
            ))}
            <span className="of-line of-accent">{HERO.accent}</span>
          </h1>
          <p className="of-hero__body">{HERO.body}</p>
          {reason && <p className="of-static__note">{reason}</p>}
        </div>
      </section>

      <section className="of-static__forces" aria-label="The four forces">
        <div className="of-wrap">
          <p className="of-beat__label">
            <span className="of-beat__n">05</span>The Four Forces
          </p>
          <ol className="of-static__pillars">
            {PILLARS.map((p, i) => (
              <li key={p.id} className="of-static__pillar">
                <span className="of-static__monolith" aria-hidden>
                  <span className="of-static__icon">
                    <ServiceIcon kind={ICONS[i]} />
                  </span>
                </span>
                <span className="of-beat__n">{p.n}</span>
                <h2 className="of-beat__title">{p.name}</h2>
                <p className="of-beat__body">{p.line}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="of-static__mark" aria-label="The Hyperiux mark">
        <Mark className="of-static__mark-svg" accent />
        <p className="of-beat__label">
          <span className="of-beat__n">15</span>Four forces. One identity.
        </p>
      </section>

      <section className="of-static__ascent" data-surface="light" aria-label="Our process">
        <div className="of-wrap">
          <h2 className="of-beat__display">
            Our <span className="of-accent">Process.</span>
          </h2>
          <ol className="of-static__steps">
            {STEPS.map((s, i) => (
              <li key={s.n} className="of-static__step" style={{ "--i": i }}>
                <span className="of-beat__step-n">[{s.n}]</span>
                <h3>{s.name}.</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
