"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ABOUT, CLIENTS, CONTACT, FRAMES, INDUSTRIES, NAV, PROCESS, PROJECTS, SERVICES, SOCIAL, TESTIMONIALS } from "./content";
import { FrameLabel, Headline } from "./FrameText";
import { Frame, Rule } from "./blueprint";
import { useScrollTo } from "./scroll";
import { onWorld } from "./world/store";

const label = (n) => FRAMES[n - 1].label;
const YEAR = 2026;
const SECTION = "relative px-[6vw] py-[16vh] max-md:py-[12vh]";

// A section's heading: its number and label, the headline, a line under it.
function SectionHead({ n, title, body, className = "" }) {
  return (
    <header className={`relative z-10 ${className}`}>
      <div data-rise="">
        <FrameLabel n={n} label={label(n)} />
      </div>
      <Headline text={title} words className="mt-6 text-[2.3rem] leading-[1.02] md:text-[3.6vw]" />
      {body && (
        <p data-rise="" className="mt-6 max-w-[34rem] text-[1rem] leading-relaxed text-[var(--bp-muted)] md:text-[1.05vw]">
          {body}
        </p>
      )}
    </header>
  );
}

// Where a section's place in the world is framed: the camera arrives there
// as this is in the middle of the screen (world/store.js). Nothing is drawn
// in it; it keeps the copy clear of the drawing behind.
const Slot = ({ n, className = "" }) => <div data-world={n} className={`bp-slot pointer-events-none ${className}`} aria-hidden="true" />;

// ---------------------------------------------------------------------------
// 10 – 13 the four disciplines
// ---------------------------------------------------------------------------
export function ServiceSections() {
  return SERVICES.map((s, i) => (
    <section key={s.id} id={s.id} className={SECTION}>
      <div className={`flex items-center gap-[6vw] max-md:flex-col max-md:items-stretch ${i % 2 ? "md:flex-row-reverse" : ""}`}>
        <div className="md:w-[38%]">
          <SectionHead n={s.n} title={s.line} body={s.body} />
          <p data-rise="" className="bp-mono mt-8 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--bp-fg)]">
            {s.name}
          </p>
          <ul data-rise="" className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.9rem] text-[var(--bp-muted)] md:text-[0.95vw]">
            {s.skills.map((k) => (
              <li key={k} className="flex items-center gap-3">
                <span className="size-1.5 shrink-0 bg-[var(--bp-accent)]" aria-hidden="true" />
                {k}
              </li>
            ))}
          </ul>
        </div>
        <Slot n={s.n} className="aspect-[4/3] md:w-[52%] max-md:aspect-square" />
      </div>
    </section>
  ));
}

// ---------------------------------------------------------------------------
// 14 the process: the stage lit as the diagram is scrolled through
// ---------------------------------------------------------------------------
// (the stage lit in the world, by the same clock: layout.js, 14)
const stageAt = (W) => Math.min(PROCESS.length - 1, Math.max(0, Math.floor((W - 13.12) / 0.17)));

export function ProcessSection() {
  const [active, setActive] = useState(0);
  useEffect(() => onWorld(({ W }) => setActive(stageAt(W))), []);
  const stage = PROCESS[active];
  return (
    <section id="process" data-world={14} className={SECTION}>
      <SectionHead n={14} title="A clear path from idea to impact." />
      <div className="mt-[8vh]">
        <Slot className="aspect-[16/6] max-md:aspect-[4/5]" />
        <div className="mt-8 flex items-baseline gap-6" aria-live="polite">
          <span className="bp-mono text-[var(--bp-accent)]">{stage.n}</span>
          <p className="text-[1.4rem] md:text-[1.6vw]">{stage.label}</p>
          <p className="text-[var(--bp-muted)] md:text-[1.05vw]">{stage.body}</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 15 – 16 the work, and the case study of the one chosen
// ---------------------------------------------------------------------------
function ProjectCard({ project, index, onOpen }) {
  return (
    <article data-scene="" className="group relative">
      <button type="button" onClick={onOpen} className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)]" aria-label={`${project.name}: open the case study`}>
        <div className="relative aspect-[880/996] overflow-hidden">
          <div className="bp-reveal absolute inset-0">
            <Image
              src={project.image}
              alt={`${project.name}, ${project.services.join(", ")}`}
              fill
              sizes="(max-width: 768px) 88vw, 40vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          </div>
          {/* its frame, drawn */}
          <Frame />
          <span className="bp-mono absolute left-3 top-3 bg-[var(--bp-bg)] px-2 py-1 text-[0.7rem] text-[var(--bp-fg)]">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className="mt-5 flex items-start justify-between gap-6">
          <div>
            <h3 className="text-[1.6rem] leading-none md:text-[2vw]">{project.name}</h3>
            <p className="bp-mono mt-3 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--bp-muted)]">{project.services.join(" · ")}</p>
          </div>
          <span className="flex items-center gap-3">
            <span className="bp-mono text-[0.75rem] text-[var(--bp-muted)]">{project.year}</span>
            <span className="flex size-9 items-center justify-center border border-[var(--bp-fg)] transition-colors group-hover:border-[var(--bp-accent)] group-hover:bg-[var(--bp-accent)] group-hover:text-white" aria-hidden="true">
              →
            </span>
          </span>
        </div>
      </button>
    </article>
  );
}

export function WorkSections() {
  const [featured, setFeatured] = useState(0);
  const scrollTo = useScrollTo();
  const open = (i) => {
    setFeatured(i);
    scrollTo("#case-study");
  };
  const p = PROJECTS[featured];
  const step = (d) => setFeatured((f) => (f + d + PROJECTS.length) % PROJECTS.length);
  return (
    <>
      <section id="work" className={SECTION}>
        <SectionHead n={15} title="Work that creates real impact." body="Selected projects, each a brand, a website and a growth story we built together." />
        <div data-world={15} className="mt-[10vh] grid grid-cols-2 gap-x-[4vw] gap-y-[10vh] max-md:grid-cols-1">
          {PROJECTS.map((proj, i) => (
            <div key={proj.id} className={i % 2 ? "md:mt-[16vh]" : ""}>
              <ProjectCard project={proj} index={i} onOpen={() => open(i)} />
            </div>
          ))}
        </div>
      </section>

      <section id="case-study" className={SECTION}>
        <div data-world={16} className="grid grid-cols-12 gap-[4vw] max-md:grid-cols-1">
          <div data-scene="" className="relative md:col-span-7">
            <div className="relative aspect-[880/996] w-[78%] overflow-hidden max-md:w-full">
              <div className="bp-reveal absolute inset-0">
                <Image key={p.id} src={p.image} alt={`${p.name} — featured project`} fill sizes="(max-width: 768px) 88vw, 46vw" className="object-cover" />
              </div>
            </div>
            {p.detail && (
              <div className="absolute bottom-[-8vh] right-0 aspect-[880/996] w-[38%] overflow-hidden border border-[var(--bp-fg)] bg-[var(--bp-bg)] max-md:hidden">
                <Image key={`${p.id}-d`} src={p.detail} alt={`${p.name} — detail`} fill sizes="20vw" className="object-cover" />
              </div>
            )}
            {/* construction lines past its edges */}
            <div className="pointer-events-none absolute -left-6 -top-6 h-[calc(100%+3rem)] w-[calc(78%+3rem)] max-md:hidden">
              <Rule dir="y" className="left-6 top-0" />
              <Rule className="left-0 top-6" />
            </div>
          </div>
          <div className="flex flex-col justify-center md:col-span-5">
            <SectionHead n={16} title={`${p.name}.`} />
            <dl className="bp-mono mt-10 grid grid-cols-[7rem_1fr] gap-y-4 border-t border-[var(--bp-guide)] pt-6 text-[0.78rem] uppercase tracking-[0.12em]">
              <dt className="text-[var(--bp-muted)]">Year</dt>
              <dd>{p.year}</dd>
              <dt className="text-[var(--bp-muted)]">Services</dt>
              <dd>{p.services.join(", ")}</dd>
            </dl>
            <p className="mt-8 max-w-[30rem] leading-relaxed text-[var(--bp-muted)] md:text-[1.05vw]">{p.body}</p>
            <div className="mt-10 flex items-center gap-3">
              <button type="button" onClick={() => step(-1)} className="flex size-11 cursor-pointer items-center justify-center border border-[var(--bp-fg)] transition-colors hover:border-[var(--bp-accent)] hover:bg-[var(--bp-accent)] hover:text-white" aria-label="Previous project">
                ←
              </button>
              <button type="button" onClick={() => step(1)} className="flex size-11 cursor-pointer items-center justify-center border border-[var(--bp-fg)] transition-colors hover:border-[var(--bp-accent)] hover:bg-[var(--bp-accent)] hover:text-white" aria-label="Next project">
                →
              </button>
              <span className="bp-mono ml-3 text-[0.75rem] text-[var(--bp-muted)]">
                <span className="text-[var(--bp-accent)]">{String(featured + 1).padStart(2, "0")}</span> / {String(PROJECTS.length).padStart(2, "0")}
              </span>
              <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`A project like ${p.name}`)}`} className="ml-auto border-b border-[var(--bp-fg)] pb-1 text-[0.95rem] transition-colors hover:border-[var(--bp-accent)] hover:text-[var(--bp-accent)]">
                Start a similar project
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 17 impact: what clients say, and who they are
// ---------------------------------------------------------------------------
export function ImpactSection() {
  const [i, setI] = useState(0);
  const t = TESTIMONIALS[i];
  return (
    <section id="impact" data-world={17} className={SECTION}>
      <SectionHead n={17} title="Experiences that move businesses forward." body="The brands we've built with, and what they say about the work." />
      <div className="mt-[10vh] grid grid-cols-12 gap-[4vw] max-md:grid-cols-1">
        <figure data-rise="" className="md:col-span-6">
          <blockquote className="relative border-l border-[var(--bp-accent)] pl-6 text-[1.25rem] leading-snug md:text-[1.6vw]">“{t.quote}”</blockquote>
          <figcaption className="mt-8 pl-6">
            <p>{t.name}</p>
            <p className="bp-mono mt-1 text-[0.75rem] uppercase tracking-[0.12em] text-[var(--bp-muted)]">{t.role}</p>
          </figcaption>
          <div className="mt-8 flex gap-2 pl-6">
            {TESTIMONIALS.map((x, k) => (
              <button
                key={x.name}
                type="button"
                onClick={() => setI(k)}
                aria-label={`Testimonial from ${x.name}`}
                aria-pressed={k === i}
                className={`h-1 w-10 cursor-pointer transition-colors ${k === i ? "bg-[var(--bp-accent)]" : "bg-[var(--bp-guide)] hover:bg-[var(--bp-fg)]"}`}
              />
            ))}
          </div>
        </figure>
        <div data-scene="" className="md:col-span-6">
          <p className="bp-mono mb-4 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--bp-muted)]">Clients</p>
          <ul className="grid grid-cols-4 max-md:grid-cols-3">
            {CLIENTS.map((c) => (
              <li key={c.name} className="relative flex aspect-[4/3] items-center justify-center p-[18%]">
                <Rule className="bottom-0 left-0" />
                <Rule dir="y" className="right-0 top-0" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logo} alt={c.name} loading="lazy" className="max-h-full max-w-full opacity-70 transition-opacity [filter:brightness(0)] hover:opacity-100" />
              </li>
            ))}
          </ul>
          <p className="bp-mono mt-10 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--bp-muted)]">Industries</p>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            {INDUSTRIES.map((n) => (
              <li key={n} className="flex items-center gap-3 text-[1rem]">
                <span className="size-1.5 bg-[var(--bp-accent)]" aria-hidden="true" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 18 the bigger picture
// ---------------------------------------------------------------------------
export function BiggerPicture() {
  return (
    <section id="bigger-picture" className={SECTION}>
      <SectionHead n={18} title="One connected vision." body="Capabilities, process and work: one system, built round the same cube." className="max-w-[40rem]" />
      <Slot n={18} className="mx-auto mt-[8vh] aspect-[16/8] max-w-[1100px] max-md:aspect-square" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 19 about
// ---------------------------------------------------------------------------
export function AboutSection() {
  const facts = [
    ["Studio", CONTACT.company],
    ["Office", CONTACT.address],
    ["Disciplines", SERVICES.map((s) => s.name).join(", ")],
    ["Industries", INDUSTRIES.join(", ")],
  ];
  return (
    <section id="about" className={SECTION}>
      <div data-world={19} className="grid grid-cols-12 gap-[4vw] max-md:grid-cols-1">
        <div className="md:col-span-6">
          <SectionHead n={19} title="Built for ambitious ideas." />
          <p data-rise="" className="mt-8 text-[1.3rem] leading-snug md:text-[1.7vw]">
            {ABOUT.title}
          </p>
          <p data-rise="" className="mt-6 max-w-[34rem] leading-relaxed text-[var(--bp-muted)] md:text-[1.05vw]">
            {ABOUT.body}
          </p>
        </div>
        <dl data-scene="" className="self-end md:col-span-6">
          {facts.map(([k, v]) => (
            <div key={k} className="relative grid grid-cols-[8rem_1fr] gap-4 py-5">
              <Rule className="left-0 top-0" />
              <dt className="bp-mono text-[0.72rem] uppercase tracking-[0.16em] text-[var(--bp-muted)]">{k}</dt>
              <dd className="text-[1rem]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 20 contact, and the footer
// ---------------------------------------------------------------------------
export function ContactSection() {
  const scrollTo = useScrollTo();
  return (
    <>
      <section id="contact" className={`${SECTION} pb-[10vh]`}>
        <div className="grid grid-cols-12 items-center gap-[4vw] max-md:grid-cols-1">
          <Slot n={20} className="aspect-square md:col-span-5 max-md:aspect-[4/3]" />
          <div className="md:col-span-7">
            <SectionHead n={20} title="Let's build what's next." body="Have an ambitious idea? Let's bring it to life." />
            <a
              href={`mailto:${CONTACT.email}?subject=${encodeURIComponent("Start a project")}`}
              className="group relative z-10 mt-10 inline-flex items-center gap-6 border border-[var(--bp-accent)] px-7 py-4 text-[1.05rem] text-[var(--bp-fg)] transition-colors hover:bg-[var(--bp-accent)] hover:text-white"
            >
              Start a Project
              <span className="text-[var(--bp-accent)] transition-colors group-hover:text-white" aria-hidden="true">
                →
              </span>
            </a>
            <div className="mt-12 grid grid-cols-3 gap-6 text-[0.95rem] max-md:grid-cols-1">
              <a href={`mailto:${CONTACT.email}`} className="w-fit border-b border-[var(--bp-guide)] pb-1 hover:border-[var(--bp-accent)] hover:text-[var(--bp-accent)]">
                {CONTACT.email}
              </a>
              <a href={CONTACT.phoneHref} className="w-fit border-b border-[var(--bp-guide)] pb-1 hover:border-[var(--bp-accent)] hover:text-[var(--bp-accent)]">
                {CONTACT.phone}
              </a>
              <p className="text-[var(--bp-muted)]">{CONTACT.address}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-[var(--bp-guide)] px-[6vw] py-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-[0.95rem]">
            {NAV.map((n) => (
              <a
                key={n.to}
                href={n.to}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(n.to);
                }}
                className="hover:text-[var(--bp-accent)]"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <ul className="flex gap-6 text-[0.95rem] text-[var(--bp-muted)]">
            {SOCIAL.map((s) => (
              <li key={s}>
                <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[var(--bp-accent)]">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="bp-mono mt-8 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--bp-muted)]">
          <span className="block size-4 bg-[var(--bp-fg)] [mask:url(/hyperiux-icon-white.svg)_center/contain_no-repeat]" aria-hidden="true" />
          © {YEAR} {CONTACT.company}. All rights reserved.
        </p>
      </footer>
    </>
  );
}

