"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Wordmark } from "../OriginForge/Brand";
import { CASE, CLIENTS, CONTACT, CTA, DISCIPLINES, FOOTER_NAV, HERO, INSIGHTS, OUTCOMES, PROCESS, PROJECTS, STUDIO, TESTIMONIALS } from "./content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// The page after the journey: warm white, editorial, the same type and the
// same orange thread, now as a line and a word. Sections 09–20.
//
// Its stills of architecture are renders of the journey's own world
// (public/assets/possibility), so the page is the same place in daylight.
const ART = { dark: "/assets/possibility/dark", light: "/assets/possibility/light" };

// a heading whose lines rise out of masks when it comes into view
function Lines({ as: Tag = "h2", lines, accent, className }) {
  return (
    <Tag className={`pj-lines ${className || ""}`} data-reveal>
      {lines.map((l, i) => (
        <span key={i} className="pj-mask">
          <span className="pj-mask__in" style={{ transitionDelay: `${i * 90}ms` }}>
            {l}
            {accent && i === lines.length - 1 && <em className="pj-accent">{accent}</em>}
          </span>
        </span>
      ))}
    </Tag>
  );
}

const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden className="pj-arrow">
    <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ServiceIcon({ id }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 40 40" className="pj-icon" aria-hidden>
      {id === "strategy" && (
        <g {...p}>
          <path d="M20 6 34 13 20 20 6 13Z" />
          <path d="M6 20l14 7 14-7" />
          <path d="M6 27l14 7 14-7" />
        </g>
      )}
      {id === "design" && (
        <g {...p}>
          <path d="M11 7l17 13-8 1.6L16 30Z" />
          <path d="M20 21.6 27 31" />
        </g>
      )}
      {id === "technology" && (
        <g {...p}>
          <path d="M14 11 5 20l9 9M26 11l9 9-9 9M23 8l-6 24" />
        </g>
      )}
      {id === "growth" && (
        <g {...p}>
          <path d="M9 32V25M16 32V19M23 32V14M30 32V8" />
        </g>
      )}
      {id === "spark" && (
        <g {...p}>
          <path d="M22 5 10 22h9l-2 13 13-18h-9Z" />
        </g>
      )}
      {id === "target" && (
        <g {...p}>
          <circle cx="20" cy="20" r="13" />
          <circle cx="20" cy="20" r="7.5" />
          <circle cx="20" cy="20" r="2" />
        </g>
      )}
      {id === "layers" && (
        <g {...p}>
          <path d="M20 7 34 14 20 21 6 14Z" />
          <path d="M6 21l14 7 14-7" />
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------

export default function Site({ theme = "dark" }) {
  const root = useRef();
  const art = ART[theme] || ART.dark;
  const [project, setProject] = useState(null);

  // reveals: each [data-reveal] gets .is-in as it enters
  useEffect(() => {
    const els = root.current.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // gentle parallax on the architectural stills, and the process steps
  // advancing with the scroll through their section
  useGSAP(
    () => {
      gsap.utils.toArray("[data-parallax]").forEach((el) => {
        gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });
      const detail = root.current.querySelector("[data-steps]");
      if (detail) {
        ScrollTrigger.create({
          trigger: detail,
          start: "top 60%",
          end: "bottom 60%",
          onUpdate: (self) => {
            const i = Math.min(PROCESS.steps.length - 1, Math.floor(self.progress * PROCESS.steps.length));
            if (detail.dataset.lock !== "1") setStep(detail, i);
          },
        });
      }
    },
    { scope: root }
  );

  return (
    <div ref={root} id="pj-site" className="pj-site">
      <Hero art={art} />
      <Services />
      <Work onOpen={setProject} />
      <CaseStudy onOpen={setProject} />
      <Outcome />
      <Clients />
      <Process art={art} />
      <ProcessDetail />
      <Studio art={art} />
      <Insights />
      <FinalCta art={art} />
      <Footer />
      <ProjectDialog project={project} onClose={() => setProject(null)} />
    </div>
  );
}

function setStep(detail, i) {
  detail.dataset.active = String(i);
  detail.querySelectorAll("[data-step]").forEach((el, k) => {
    el.classList.toggle("is-active", k === i);
    el.classList.toggle("is-done", k < i);
    el.setAttribute("aria-selected", k === i ? "true" : "false");
  });
  detail.querySelectorAll("[data-step-panel]").forEach((el, k) => el.classList.toggle("is-active", k === i));
}

// 09 -------------------------------------------------------------------------
function Hero({ art }) {
  return (
    <section className="pj-hero" aria-labelledby="pj-hero-title">
      <div className="pj-wrap pj-hero__grid">
        <div className="pj-hero__copy">
          <p className="pj-eyebrow" data-reveal>
            <span className="pj-eyebrow__line" /> Hyperiux
          </p>
          <h1 id="pj-hero-title" className="pj-hero__title pj-lines" data-reveal>
            {HERO.title.map((l, i) => (
              <span key={i} className="pj-mask">
                <span className="pj-mask__in" style={{ transitionDelay: `${i * 90}ms` }}>
                  {l}
                </span>
              </span>
            ))}
            <span className="pj-mask">
              <span className="pj-mask__in pj-accent" style={{ transitionDelay: "180ms" }}>
                {HERO.accent}
                <span className="pj-underline" aria-hidden />
              </span>
            </span>
          </h1>
          <p className="pj-hero__body" data-reveal>
            {HERO.body}
          </p>
          <div className="pj-hero__ctas" data-reveal>
            <a href="#pj-work" className="pj-pill pj-pill--solid">
              Explore Our Work <Arrow />
            </a>
            <a href={CONTACT.mailto} className="pj-pill pj-pill--ghost">
              Start a Project
            </a>
          </div>
        </div>
        <figure className="pj-hero__art pj-art" data-reveal>
          <div className="pj-art__frame">
            <Image src={`${art}/hero.jpg`} alt="A courtyard open to the sky, an orange-leaved tree standing in a basin of still water." fill sizes="(max-width: 900px) 100vw, 46vw" priority data-parallax />
          </div>
        </figure>
      </div>
    </section>
  );
}

// 10 -------------------------------------------------------------------------
function Services() {
  return (
    <section className="pj-section" id="pj-services" aria-labelledby="pj-services-title">
      <div className="pj-wrap">
        <header className="pj-head">
          <p className="pj-label" data-reveal>
            10 — What We Do
          </p>
          <div className="pj-head__row">
            <Lines lines={["Our Capabilities"]} className="pj-h2" />
            <span className="pj-count" data-reveal>
              0 — 04
            </span>
          </div>
        </header>
        <ul className="pj-services">
          {DISCIPLINES.map((d, i) => (
            <li key={d.id} className="pj-service" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="pj-service__n">{d.n}</span>
              <ServiceIcon id={d.id} />
              <h3 className="pj-service__name">{d.name}</h3>
              <p className="pj-service__body">{d.body}</p>
              <span className="pj-service__go" aria-hidden>
                <Arrow />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// 11 -------------------------------------------------------------------------
function Work({ onOpen }) {
  return (
    <section className="pj-section" id="pj-work" aria-labelledby="pj-work-title">
      <div className="pj-wrap">
        <header className="pj-head">
          <p className="pj-label" data-reveal>
            11 — Selected Work
          </p>
          <Lines lines={["Work that people", "come back to."]} className="pj-h2" />
        </header>
        <ul className="pj-work">
          {PROJECTS.map((p, i) => (
            <li key={p.id} className={`pj-work__item pj-work__item--${i}`} data-reveal>
              <button type="button" className="pj-work__card" onClick={() => onOpen(p)} aria-label={`${p.name}, ${p.year}: view project`}>
                <span className="pj-work__img">
                  <Image src={p.images[0]} alt={`${p.name}, project imagery`} fill sizes="(max-width: 900px) 100vw, 50vw" />
                </span>
                <span className="pj-work__meta">
                  <span className="pj-work__name">{p.name}</span>
                  <span className="pj-work__info">
                    {p.services.join(" · ")} — {p.year}
                  </span>
                </span>
                <span className="pj-work__go" aria-hidden>
                  <Arrow />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// 12 -------------------------------------------------------------------------
function CaseStudy({ onOpen }) {
  const p = PROJECTS.find((x) => x.id === CASE.project);
  return (
    <section className="pj-section pj-case" aria-labelledby="pj-case-title">
      <div className="pj-wrap pj-case__grid">
        <div className="pj-case__copy">
          <p className="pj-label" data-reveal>
            12 — {CASE.label} · {p.name}
          </p>
          <Lines lines={CASE.title} className="pj-h2" />
          <p className="pj-body" data-reveal>
            {CASE.body}
          </p>
          <dl className="pj-facts" data-reveal>
            <div>
              <dt>Client</dt>
              <dd>{p.name}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{p.year}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{p.services.join(", ")}</dd>
            </div>
          </dl>
          <button type="button" className="pj-textlink" onClick={() => onOpen(p)} data-reveal>
            View Case Study <Arrow />
          </button>
        </div>
        <figure className="pj-case__art pj-art" data-reveal>
          <div className="pj-art__frame">
            <Image src={p.images[1] || p.images[0]} alt={`${p.name}, project imagery`} fill sizes="(max-width: 900px) 100vw, 52vw" data-parallax />
          </div>
        </figure>
      </div>
    </section>
  );
}

// 13 -------------------------------------------------------------------------
function Outcome() {
  const q = TESTIMONIALS[0];
  return (
    <section className="pj-section pj-outcome" aria-labelledby="pj-outcome-title">
      <div className="pj-wrap">
        <header className="pj-head">
          <p className="pj-label" data-reveal>
            13 — The Outcome
          </p>
          <Lines lines={["What changes when", "the pieces work as one."]} className="pj-h2" />
        </header>
        <ul className="pj-outcomes">
          {OUTCOMES.map((o, i) => (
            <li key={o.title} className="pj-outcome__item" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="pj-outcome__icon">
                <ServiceIcon id={o.icon} />
              </span>
              <h3>{o.title}</h3>
              <p>{o.body}</p>
            </li>
          ))}
        </ul>
        <figure className="pj-quote" data-reveal>
          <blockquote>“{q.quote}”</blockquote>
          <figcaption>
            <span className="pj-quote__name">{q.name}</span>
            <span className="pj-quote__role">{q.role}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

// 14 -------------------------------------------------------------------------
function Clients() {
  return (
    <section className="pj-section pj-clients" aria-labelledby="pj-clients-title">
      <div className="pj-wrap">
        <header className="pj-head">
          <p className="pj-label" data-reveal>
            14 — Trusted By
          </p>
          <Lines lines={["Built together", "with ambitious brands."]} className="pj-h2" />
        </header>
        <ul className="pj-logos">
          {CLIENTS.map((c, i) => (
            <li key={c.name} className="pj-logo" data-reveal style={{ transitionDelay: `${(i % 6) * 60}ms` }}>
              <Image src={c.logo} alt={c.name} width={160} height={56} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// 15 -------------------------------------------------------------------------
function Process({ art }) {
  return (
    <section className="pj-section pj-process" aria-labelledby="pj-process-title">
      <div className="pj-wrap pj-process__grid">
        <div className="pj-process__copy">
          <p className="pj-label" data-reveal>
            15 — Our Process
          </p>
          <Lines lines={["Our Process"]} className="pj-h2" />
          <p className="pj-lead" data-reveal>
            {PROCESS.intro[0]}
          </p>
          <p className="pj-body" data-reveal>
            {PROCESS.body}
          </p>
          <ol className="pj-process__list" data-reveal>
            {PROCESS.steps.map((s) => (
              <li key={s.n}>
                <span>{s.n}</span> {s.name}
              </li>
            ))}
          </ol>
        </div>
        <figure className="pj-process__art pj-art" data-reveal>
          <div className="pj-art__frame">
            <Image src={`${art}/process.jpg`} alt="A passage of limestone arches, a line of orange light running down its floor." fill sizes="(max-width: 900px) 100vw, 50vw" data-parallax />
          </div>
        </figure>
      </div>
    </section>
  );
}

// 16 -------------------------------------------------------------------------
function ProcessDetail() {
  const ref = useRef();
  const pick = (i) => {
    const el = ref.current;
    el.dataset.lock = "1";
    setStep(el, i);
    clearTimeout(el._unlock);
    el._unlock = setTimeout(() => (el.dataset.lock = "0"), 2500);
  };
  return (
    <section className="pj-section pj-steps" aria-labelledby="pj-steps-title">
      <div className="pj-wrap" ref={ref} data-steps data-active="0">
        <header className="pj-head">
          <p className="pj-label" data-reveal>
            16 — Process Detail
          </p>
          <Lines lines={["From a first question", "to a living experience."]} className="pj-h2" />
        </header>
        <div className="pj-steps__track" role="tablist" aria-label="Process steps">
          <span className="pj-steps__rule" aria-hidden />
          {PROCESS.steps.map((s, i) => (
            <button key={s.n} type="button" role="tab" data-step className={`pj-step ${i === 0 ? "is-active" : ""}`} aria-selected={i === 0} onClick={() => pick(i)}>
              <span className="pj-step__n">{s.n}</span>
              <span className="pj-step__name">{s.name}</span>
            </button>
          ))}
        </div>
        <div className="pj-steps__panels">
          {PROCESS.steps.map((s, i) => (
            <div key={s.n} className={`pj-steps__panel ${i === 0 ? "is-active" : ""}`} data-step-panel role="tabpanel">
              <h3>{s.name}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 17 -------------------------------------------------------------------------
function Studio({ art }) {
  return (
    <section className="pj-section pj-studio" id="pj-about" aria-labelledby="pj-studio-title">
      <div className="pj-wrap pj-studio__grid">
        <div className="pj-studio__copy">
          <p className="pj-label" data-reveal>
            17 — The Studio
          </p>
          <Lines lines={STUDIO.title} className="pj-h2" />
          <p className="pj-body" data-reveal>
            {STUDIO.body}
          </p>
          <ul className="pj-principles">
            {STUDIO.principles.map((p, i) => (
              <li key={p.k} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                <h3>{p.k}.</h3>
                <p>{p.v}</p>
              </li>
            ))}
          </ul>
        </div>
        <figure className="pj-studio__art pj-art" data-reveal>
          <div className="pj-art__frame">
            <Image src={`${art}/studio.jpg`} alt="Slabs of glass standing in a limestone hall, each etched with a sign." fill sizes="(max-width: 900px) 100vw, 44vw" data-parallax />
          </div>
        </figure>
      </div>
    </section>
  );
}

// 18 -------------------------------------------------------------------------
function Insights() {
  const track = useRef();
  const by = (d) => {
    const el = track.current;
    const card = el.querySelector("li");
    el.scrollBy({ left: d * ((card?.offsetWidth || 320) + 24), behavior: "smooth" });
  };
  return (
    <section className="pj-section pj-insights" id="pj-insights" aria-labelledby="pj-insights-title">
      <div className="pj-wrap">
        <header className="pj-head pj-head--row">
          <div>
            <p className="pj-label" data-reveal>
              18 — Insights
            </p>
            <Lines lines={["Ideas that move", "the industry forward."]} className="pj-h2" />
          </div>
          <div className="pj-insights__nav" data-reveal>
            <button type="button" onClick={() => by(-1)} aria-label="Previous articles">
              <Arrow />
            </button>
            <button type="button" onClick={() => by(1)} aria-label="Next articles">
              <Arrow />
            </button>
          </div>
        </header>
        <ul className="pj-insights__track" ref={track}>
          {INSIGHTS.map((a, i) => (
            <li key={a.title} className="pj-article" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="pj-article__img">
                <Image src={a.image} alt="" fill sizes="(max-width: 900px) 80vw, 30vw" />
              </span>
              <span className="pj-article__cat">{a.category}</span>
              <h3 className="pj-article__title">{a.title}</h3>
              <span className="pj-article__soon">Article coming soon</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// 19 -------------------------------------------------------------------------
function FinalCta({ art }) {
  return (
    <section className="pj-section pj-cta" id="pj-contact" aria-labelledby="pj-cta-title">
      <div className="pj-wrap pj-cta__grid">
        <div className="pj-cta__copy">
          <p className="pj-label" data-reveal>
            19 — Call to Action
          </p>
          <Lines as="h2" lines={CTA.title} accent={CTA.accent} className="pj-h1" />
          <p className="pj-body" data-reveal>
            {CTA.body}
          </p>
          <a href={CONTACT.mailto} className="pj-pill pj-pill--solid" data-reveal>
            {CTA.button} <Arrow />
          </a>
        </div>
        <figure className="pj-cta__art pj-art" data-reveal>
          <div className="pj-art__frame">
            <Image src={`${art}/cta.jpg`} alt="Curved limestone walls, a beam of orange light running across the floor." fill sizes="(max-width: 900px) 100vw, 46vw" data-parallax />
          </div>
        </figure>
      </div>
    </section>
  );
}

// 20 -------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="pj-footer">
      <div className="pj-wrap pj-footer__grid">
        <div className="pj-footer__brand">
          <Wordmark className="pj-footer__word" />
          <ul className="pj-footer__contact">
            <li>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            </li>
            <li>
              {CONTACT.address[0]}, {CONTACT.address[1]}, India
            </li>
          </ul>
        </div>
        <nav className="pj-footer__nav" aria-label="Footer">
          {FOOTER_NAV.map((n) => (
            <a key={n.to} href={n.to} className="pj-link">
              {n.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="pj-wrap pj-footer__base">
        <p>© {new Date().getFullYear()} {CONTACT.company}. All rights reserved.</p>
        <svg className="pj-footer__thread" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
          <path d="M0 30 C 120 30 180 8 400 6" />
        </svg>
      </div>
    </footer>
  );
}

// the project, opened (the site has no case-study pages yet)
function ProjectDialog({ project, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (project && !d.open) d.showModal();
    if (!project && d.open) d.close();
  }, [project]);
  return (
    <dialog ref={ref} className="pj-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="pj-dialog-title">
      {project && (
        <div className="pj-dialog__inner">
          <button type="button" className="pj-dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <p className="pj-label">
            {project.year} · {project.services.join(" · ")}
          </p>
          <h2 id="pj-dialog-title" className="pj-h2">
            {project.name}
          </h2>
          <p className="pj-body">{project.intro}</p>
          <div className="pj-dialog__images">
            {project.images.map((src) => (
              <span key={src} className="pj-dialog__img">
                <Image src={src} alt={`${project.name}, project imagery`} fill sizes="(max-width: 900px) 92vw, 60vw" />
              </span>
            ))}
          </div>
          <a href={CONTACT.mailto} className="pj-pill pj-pill--solid">
            Start a project like this <Arrow />
          </a>
        </div>
      )}
    </dialog>
  );
}
