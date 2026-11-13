"use client";

import { CHAPTERS } from "./content";

// The chapters' words: real text over the canvas (readable, selectable,
// read by screen readers), each line in a mask so it rises into view. The
// master timeline (Experience.jsx) shows and hides them, in step with the
// world.
export function ChapterOverlays({ chapters = CHAPTERS }) {
  return (
    <div className="pj-beats">
      {chapters.map((c, i) => (
        <article key={c.id} className={`pj-beat pj-beat--${c.kind || "chapter"}`} data-beat style={i === 0 ? undefined : { visibility: "hidden", opacity: 0 }}>
          <p className="pj-beat__eyebrow">
            <span className="pj-mask">
              <span data-in className="pj-mask__in">
                {c.n} — {c.label}
              </span>
            </span>
          </p>
          {c.kind === "reveal" ? (
            <h2 className="pj-reveal" aria-label={c.title[0]}>
              <span className="pj-mask">
                <span data-in className="pj-mask__in pj-reveal__word" aria-hidden>
                  HYPER<i className="pj-reveal__bar" />UX
                </span>
              </span>
            </h2>
          ) : c.kind === "hero" ? (
            <h1 className="pj-beat__brand">
              <span className="pj-mask">
                <span data-in className="pj-mask__in">
                  {c.title}
                </span>
              </span>
            </h1>
          ) : (
            <h2 className="pj-beat__title">
              {c.title.map((line) => (
                <span key={line} className="pj-mask">
                  <span data-in className="pj-mask__in">
                    {line}
                  </span>
                </span>
              ))}
            </h2>
          )}
          <p className="pj-beat__body">
            <span className="pj-mask">
              <span data-in className="pj-mask__in">
                {c.body}
              </span>
            </span>
          </p>
          {c.kind === "hero" && (
            <p className="pj-beat__cue" aria-hidden>
              <span className="pj-beat__cue-line" />
              Scroll to enter
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

// Where the visitor is in the journey: six chapters along a hairline.
export function ChapterRail({ chapters = CHAPTERS }) {
  return (
    <nav className="pj-rail" data-rail aria-label="Journey chapters">
      <ol className="pj-rail__list" style={{ gridTemplateColumns: `repeat(${chapters.length}, 1fr)` }}>
        {chapters.map((c) => (
          <li key={c.id} className="pj-rail__item" data-chapter>
            <span className="pj-rail__n">{c.n}</span>
            <span className="pj-rail__label">{c.label}</span>
          </li>
        ))}
      </ol>
      <span className="pj-rail__track" aria-hidden>
        <span className="pj-rail__fill" data-rail-fill />
      </span>
    </nav>
  );
}

// The threshold: the page's warm white, opening over the world.
export function Threshold() {
  return (
    <div className="pj-threshold" aria-hidden>
      <div className="pj-threshold__veil" data-veil />
    </div>
  );
}
