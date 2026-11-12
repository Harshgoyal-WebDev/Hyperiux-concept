"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Mark, Wordmark } from "./Brand";
import { ABOUT, CLIENTS, CONTACT, CTA, INDUSTRIES, NAV, PROJECTS, SERVICES, TESTIMONIALS, VISION, WHY } from "./content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// The studio, after the film: a calm, white, editorial site in plain DOM.
// No WebGL here. Motion is restrained: lines of headlines rise in, thin
// orange rules draw themselves, and one orange line travels with the reader.

export default function WhiteStorySections() {
  const root = useRef();
  const [project, setProject] = useState(null);

  // reveal-on-enter for anything marked data-reveal (CSS does the motion)
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
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // the orange lines that draw with the scroll
  useGSAP(
    () => {
      root.current.querySelectorAll("[data-draw]").forEach((path) => {
        gsap.fromTo(
          path,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: path.closest("section"), start: "top 85%", end: "bottom 60%", scrub: 0.6 } }
        );
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} id="of-site" className="of-site" data-surface="light">
      <Arrival />
      <About />
      <Services />
      <Why />
      <Work onOpen={setProject} />
      <Impact />
      <Clients />
      <Vision />
      <FinalCta />
      <Footer />
      <ProjectPanel project={project} onClose={() => setProject(null)} />
    </div>
  );
}

// A headline whose lines rise in, one after another; `accent` is the last
// line, in orange.
function Headline({ as: Tag = "h2", lines, accent, className = "" }) {
  return (
    <Tag className={`of-h ${className}`} data-reveal>
      {lines.map((l, i) => (
        <span key={i} className="of-h__line" style={{ "--i": i }}>
          <span>
            {l}
            {i === lines.length - 1 && accent ? <em className="of-accent">{accent}</em> : null}
          </span>
        </span>
      ))}
    </Tag>
  );
}

function Label({ children }) {
  return (
    <p className="of-label" data-reveal>
      <span className="of-label__rule" />
      {children}
    </p>
  );
}

// 28 · the transition: the first thing the white light reveals
function Arrival() {
  return (
    <section className="of-arrival" aria-label="From a world of creation to lasting impact">
      <div className="of-wrap of-arrival__inner">
        <Headline as="p" className="of-arrival__title" lines={["From a World of Creation", "to "]} accent="Lasting Impact." />
        <svg className="of-arrival__curve" viewBox="0 0 600 700" fill="none" aria-hidden>
          <path d="M40 690 C 220 660 300 520 360 380 S 470 90 590 10" pathLength="1" className="of-draw of-draw--thick" data-draw />
          <path d="M70 700 C 250 670 330 530 390 390 S 500 100 600 22" pathLength="1" className="of-draw" data-draw />
        </svg>
      </div>
    </section>
  );
}

// 29 · about
function About() {
  return (
    <section id="of-about" className="of-section of-about">
      <div className="of-wrap">
        <Label>{ABOUT.label}</Label>
        <div className="of-split">
          <Headline lines={ABOUT.title} accent={ABOUT.accent} className="of-h--xl" />
          <div className="of-about__copy">
            <p className="of-lead" data-reveal>
              {ABOUT.lead}
            </p>
            {ABOUT.body.map((p) => (
              <p key={p.slice(0, 16)} className="of-body" data-reveal>
                {p}
              </p>
            ))}
            <a className="of-link of-link--arrow" href={CONTACT.aboutUrl} target="_blank" rel="noreferrer" data-reveal>
              More about the studio
            </a>
          </div>
        </div>
        <ul className="of-beliefs">
          {ABOUT.beliefs.map((b, i) => (
            <li key={b.k} className="of-belief" data-reveal style={{ "--i": i }}>
              <span className="of-belief__n">0{i + 1}</span>
              <h3 className="of-belief__k">{b.k}</h3>
              <p className="of-belief__v">{b.v}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// 30 · what we do
export function ServiceIcon({ kind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" };
  switch (kind) {
    case "strategy":
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <path d="M24 5 41 14.5v19L24 43 7 33.5v-19Z" />
          <path d="M7 14.5 24 24l17-9.5M24 24v19" />
        </svg>
      );
    case "design":
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <path d="M12 42c-8-10 10-16 3-36M23 42c-8-10 10-16 3-36M34 42c-8-10 10-16 3-36" />
        </svg>
      );
    case "development":
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <path d="M24 6 42 14 24 22 6 14Z" />
          <path d="m6 24 18 8 18-8M6 34l18 8 18-8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" {...common} aria-hidden>
          <path d="M27 4 10 27h12l-3 17 19-24H26Z" />
        </svg>
      );
  }
}

function Services() {
  return (
    <section id="of-services" className="of-section of-services">
      <div className="of-wrap">
        <Label>What we do</Label>
        <div className="of-section__head">
          <Headline lines={["Everything You Need", "to "]} accent="Move Forward." className="of-h--xl" />
          <p className="of-body of-section__intro" data-reveal>
            Four disciplines that usually live in four different places. Here they are one team, working on one system: yours.
          </p>
        </div>
        <ol className="of-services__grid">
          {SERVICES.map((s, i) => (
            <li key={s.id} className="of-service" data-reveal style={{ "--i": i }}>
              <a className="of-service__link" href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`${s.name} with Hyperiux`)}`}>
                <span className="of-service__rule" />
                <span className="of-service__top">
                  <span className="of-service__icon">
                    <ServiceIcon kind={s.icon} />
                  </span>
                  <span className="of-service__n">0{i + 1}</span>
                </span>
                <h3 className="of-service__name">{s.name}</h3>
                <p className="of-service__body">{s.body}</p>
                <ul className="of-service__skills">
                  {s.skills.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
                <span className="of-service__cta">
                  Discuss {s.name.split(" ")[0]} <span aria-hidden>→</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// why hyperiux
function Why() {
  return (
    <section className="of-section of-why">
      <div className="of-wrap">
        <Label>Why Hyperiux</Label>
        <div className="of-split of-split--top">
          <div className="of-why__sticky">
            <Headline lines={["Built Different", ""]} accent="by Design." className="of-h--xl" />
          </div>
          <ol className="of-why__list">
            {WHY.map((w) => (
              <li key={w.n} className="of-why__item" data-reveal>
                <span className="of-why__n">{w.n}</span>
                <div>
                  <h3 className="of-why__title">
                    <span className="of-underline">{w.title}</span>
                  </h3>
                  <p className="of-why__body">{w.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// selected work
function Work({ onOpen }) {
  return (
    <section id="of-work" className="of-section of-work">
      <div className="of-wrap">
        <Label>Selected work</Label>
        <div className="of-section__head">
          <Headline lines={["Ideas That Become", ""]} accent="Experiences." className="of-h--xl" />
          <p className="of-body of-section__intro" data-reveal>
            A few of the brands we have designed, built and grown with.
          </p>
        </div>
        <ul className="of-work__grid">
          {PROJECTS.map((p, i) => (
            <li key={p.id} className={`of-project of-project--${i}`} data-reveal style={{ "--i": i % 2 }}>
              <button type="button" className="of-project__btn" onClick={() => onOpen(p)} aria-label={`View project: ${p.name}`}>
                <span className="of-project__media">
                  <Image src={p.images[0]} alt={`${p.name}: website on devices`} fill sizes="(max-width: 820px) 100vw, 46vw" className="of-project__img" />
                </span>
                <span className="of-project__meta">
                  <span className="of-project__row">
                    <span className="of-project__name">{p.name}</span>
                    <span className="of-project__year">{p.year}</span>
                  </span>
                  <span className="of-project__cat">{p.services.join(" · ")}</span>
                  <span className="of-project__intro">{p.intro}</span>
                  <span className="of-link of-link--arrow of-project__view">View project</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProjectPanel({ project, onClose }) {
  const dialog = useRef();
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (project && !d.open) d.showModal();
    if (!project && d.open) d.close();
  }, [project]);
  return (
    <dialog ref={dialog} className="of-panel" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()} aria-label={project ? `${project.name} project` : "Project"}>
      {project && (
        <div className="of-panel__inner">
          <button type="button" className="of-panel__close" onClick={onClose}>
            Close <span aria-hidden>×</span>
          </button>
          <p className="of-label">
            <span className="of-label__rule" />
            Project · {project.year}
          </p>
          <h3 className="of-panel__title">{project.name}</h3>
          <dl className="of-panel__facts">
            <div>
              <dt>Client</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{project.year}</dd>
            </div>
            <div>
              <dt>Services</dt>
              <dd>{project.services.join(", ")}</dd>
            </div>
          </dl>
          <p className="of-body">{project.intro} The full case study is being written. Ask us and we will walk you through the project.</p>
          <div className="of-panel__images">
            {project.images.map((src) => (
              <span key={src} className="of-panel__img">
                <Image src={src} alt={`${project.name}: project imagery`} fill sizes="(max-width: 820px) 90vw, 40vw" />
              </span>
            ))}
          </div>
          <a className="of-pill of-pill--dark" href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`About the ${project.name} project`)}`}>
            Ask about {project.name}
          </a>
        </div>
      )}
    </dialog>
  );
}

// impact: no numbers we can't stand behind, so the proof is in clients' words
function Impact() {
  const [lead, ...rest] = TESTIMONIALS;
  return (
    <section className="of-section of-impact">
      <div className="of-wrap">
        <Label>Our impact</Label>
        <div className="of-section__head">
          <Headline lines={["Turning Vision", "Into "]} accent="Real Growth." className="of-h--xl" />
          <p className="of-body of-section__intro" data-reveal>
            We would rather show you what the people we build with say than a wall of numbers.
          </p>
        </div>
        <figure className="of-quote of-quote--lead" data-reveal>
          <blockquote>
            <p>“{lead.quote}”</p>
          </blockquote>
          <figcaption className="of-quote__by">
            <span className="of-quote__face">
              <Image src={lead.image} alt="" fill sizes="64px" />
            </span>
            <span>
              <strong>{lead.name}</strong>
              <span>{lead.role}</span>
            </span>
          </figcaption>
        </figure>
        <div className="of-quotes">
          {rest.map((q, i) => (
            <figure key={q.name} className="of-quote" data-reveal style={{ "--i": i }}>
              <blockquote>
                <p>“{q.quote}”</p>
              </blockquote>
              <figcaption className="of-quote__by">
                <span className="of-quote__face">
                  <Image src={q.image} alt="" fill sizes="48px" />
                </span>
                <span>
                  <strong>{q.name}</strong>
                  <span>{q.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="of-industries" data-reveal>
          <p className="of-industries__label">Industries we build for</p>
          <ul>
            {INDUSTRIES.map((x, i) => (
              <li key={x}>
                <span>0{i + 1}</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// clients
function Clients() {
  return (
    <section className="of-section of-clients">
      <div className="of-wrap">
        <Label>Clients & partners</Label>
        <Headline lines={["Brands That", ""]} accent="Build With Us." className="of-h--xl" />
        <ul className="of-clients__grid" data-reveal>
          {CLIENTS.map((c) => (
            <li key={c.name} className="of-client">
              <span className="of-client__bg" style={{ backgroundImage: `url(${c.bg})` }} aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logo} alt={c.name} className="of-client__logo" loading="lazy" width={444} height={270} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// vision
function Vision() {
  return (
    <section className="of-section of-vision">
      <svg className="of-vision__line" viewBox="0 0 1440 400" preserveAspectRatio="none" fill="none" aria-hidden>
        <path d="M-20 300 C 300 300 420 120 720 140 S 1180 340 1460 80" pathLength="1" className="of-draw" data-draw />
      </svg>
      <div className="of-wrap of-vision__inner">
        <Label>Our vision</Label>
        <Headline lines={VISION.title} accent={VISION.accent} className="of-h--xxl" />
        <div className="of-vision__copy">
          {VISION.body.map((p) => (
            <p key={p.slice(0, 16)} className="of-body of-body--lg" data-reveal>
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

// final cta
function FinalCta() {
  return (
    <section id="of-contact" className="of-section of-cta">
      <div className="of-wrap">
        <Label>Start a project</Label>
        <Headline lines={CTA.title} accent={null} className="of-h--xxl of-cta__title" />
        <p className="of-h of-h--xxl of-cta__accent" data-reveal>
          <span className="of-h__line">
            <span>
              <em className="of-accent">{CTA.accent}</em>
            </span>
          </span>
        </p>
        <div className="of-cta__row">
          <div className="of-cta__copy" data-reveal>
            {CTA.body.map((l) => (
              <p key={l} className="of-body of-body--lg">
                {l}
              </p>
            ))}
          </div>
          <a className="of-cta__button" href={CONTACT.mailto} data-reveal>
            <span>{CTA.button}</span>
            <span className="of-cta__arrow" aria-hidden>
              →
            </span>
          </a>
        </div>
        <dl className="of-contact" data-reveal>
          <div>
            <dt>Email</dt>
            <dd>
              <a className="of-link" href={`mailto:${CONTACT.email}`}>
                {CONTACT.email}
              </a>
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>
              <a className="of-link" href={CONTACT.phoneHref}>
                {CONTACT.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt>Studio</dt>
            <dd>
              {CONTACT.address[0]}
              <br />
              {CONTACT.address[1]}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="of-footer">
      <div className="of-wrap">
        <div className="of-footer__top">
          <div className="of-footer__brand">
            <Mark className="of-footer__mark" accent />
            <Wordmark className="of-footer__word" />
            <p className="of-footer__line">Experiences engineered for growth.</p>
          </div>
          <nav className="of-footer__col" aria-label="Footer">
            <p className="of-footer__h">Explore</p>
            {NAV.map((n) => (
              <a key={n.to} href={n.to} className="of-link">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="of-footer__col">
            <p className="of-footer__h">Contact</p>
            <a href={`mailto:${CONTACT.email}`} className="of-link">
              {CONTACT.email}
            </a>
            <a href={CONTACT.phoneHref} className="of-link">
              {CONTACT.phone}
            </a>
          </div>
          <div className="of-footer__col">
            <p className="of-footer__h">Studio</p>
            <p>{CONTACT.company}</p>
            <p>{CONTACT.address[0]}</p>
            <p>{CONTACT.address[1]}</p>
          </div>
        </div>
        <div className="of-footer__bottom">
          <p>© 2026 {CONTACT.company}</p>
          <a href="#top" className="of-link">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
