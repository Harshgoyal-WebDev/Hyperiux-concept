import { CHAPTERS } from "./content";

// Without WebGL, or with reduced motion: the same eight chapters, as still
// compositions (drawn in CSS: limestone planes, arches, the orange line)
// with their words, in the normal flow of the page. Nothing pins, nothing
// is scroll-driven; every word is there.
export default function StaticJourney({ reason, chapters = CHAPTERS }) {
  return (
    <section className="pj-static" aria-label="The Hyperiux journey, from possibility to experience">
      {chapters.map((c, i) => (
        <article key={c.id} className={`pj-still pj-still--${c.id}`}>
          <div className="pj-still__art" aria-hidden>
            <span className="pj-still__arch" />
            <span className="pj-still__arch pj-still__arch--far" />
            {i > 0 && <span className="pj-still__line" />}
          </div>
          <div className="pj-still__copy">
            <p className="pj-beat__eyebrow">
              {c.n} — {c.label}
            </p>
            {c.kind === "hero" ? <h1 className="pj-beat__brand">{c.title}</h1> : <h2 className="pj-beat__title">{c.title.join(" ")}</h2>}
            <p className="pj-beat__body">{c.body}</p>
            {i === 0 && reason && <p className="pj-static__note">{reason}</p>}
          </div>
        </article>
      ))}
    </section>
  );
}
