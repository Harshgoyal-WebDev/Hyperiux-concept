"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { CAPABILITIES, CONTACT, NAV, PROCESS, PROJECTS, SOCIAL, STUDIO, TESTIMONIALS } from "./content";
import { STATE, at, beatQ, onStory, smooth, STORY } from "./story";
import { GRID_LINES } from "./world/states";

// The white world (16–20): calm after the opening. The particles settle onto
// this grid (16), which is the work's structure (17); the idea lands on the
// headline's full stop and stays the page's one accent.

function Eyebrow({ n, children, dark = false }) {
  return (
    <p data-reveal className={`cti-eyebrow ${dark ? "" : "text-[#FF5F1F]"}`}>
      {n} / {children}
    </p>
  );
}

// the twelve columns of the page, as lines
export function GridLines({ className = "", attach = false }) {
  return (
    <div data-cti-grid={attach ? "" : undefined} className={`cti-container pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <div className="relative h-full">
        {Array.from({ length: GRID_LINES }, (_, i) => (
          <span key={i} className="absolute inset-y-0 w-px bg-[#E8E8E5]" style={{ left: `${(i / (GRID_LINES - 1)) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

// ---- 16 arrival ------------------------------------------------------------
export function Arrival({ arrivalRef, live }) {
  const gridRef = useRef(null);
  const dotRef = useRef(null);
  const panelRef = useRef(null);
  const copyRef = useRef(null);

  useEffect(() => {
    if (!live) return;
    return onStory(() => {
      const g = smooth(8.35, 8.95, STATE.stage);
      gridRef.current.style.opacity = g.toFixed(3);
      dotRef.current.style.opacity = smooth(at(16, 0.88), at(16, 0.98), STORY.t).toFixed(3);
      const q = beatQ(16);
      panelRef.current.style.transform = `translateX(${((1 - smooth(0.05, 0.75, q)) * 18).toFixed(2)}%)`;
      panelRef.current.style.opacity = smooth(0.05, 0.5, q).toFixed(3);
      copyRef.current.style.opacity = smooth(0.0, 0.45, q).toFixed(3);
    });
  }, [live]);

  return (
    <section ref={arrivalRef} id="work" aria-labelledby="arrival-title" className="relative z-10 flex min-h-[100svh] items-center overflow-hidden text-[#111214]">
      <div ref={gridRef} className="absolute inset-0" style={{ opacity: live ? 0 : 1 }}>
        <GridLines attach />
      </div>
      <div className="cti-container relative grid w-full items-center gap-12 py-28 md:grid-cols-12">
        <div ref={copyRef} className="md:col-span-5" style={{ opacity: live ? 0 : 1 }}>
          <p className="cti-eyebrow text-[#FF5F1F]">05 / Selected work</p>
          <h2 id="arrival-title" className="cti-display mt-6">
            Made to be experienced
            <span ref={dotRef} data-energy-land className="text-[#FF5F1F]" style={{ opacity: live ? 0 : 1 }}>
              .
            </span>
          </h2>
          <p className="cti-body mt-6 max-w-[22rem] text-[#777777]">A selection of digital experiences we&apos;ve designed and engineered.</p>
        </div>
        <div ref={panelRef} className="md:col-span-7 md:col-start-6" style={{ opacity: live ? 0 : 1 }}>
          <div className="relative aspect-[16/11] overflow-hidden rounded-[18px] bg-[#111214] md:-mr-[var(--gutter)] md:rounded-r-none">
            <Image src={PROJECTS[0].images[1]} alt="Montra — the app on a phone" fill sizes="(max-width: 768px) 90vw, 58vw" className="object-cover opacity-95" priority={false} />
            <div className="absolute bottom-5 left-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">
              <span className="size-1.5 rounded-full bg-[#FF5F1F]" />
              Montra · {PROJECTS[0].year}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- 17 work -----------------------------------------------------------------
function ProjectDialog({ project, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (project && !d.open) d.showModal();
    if (!project && d.open) d.close();
  }, [project]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="cti-dialog" aria-labelledby="project-title">
      {project && (
        <div className="grid gap-8 p-6 md:grid-cols-[1.25fr_1fr] md:p-10">
          <div className="grid gap-4">
            {project.images.map((src, i) => (
              <div key={src} className="relative aspect-[880/996] overflow-hidden rounded-xl bg-[#E8E8E5] md:aspect-[4/3]">
                <Image src={src} alt={`${project.name} — image ${i + 1}`} fill sizes="(max-width: 768px) 90vw, 45vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-6">
              <p className="cti-eyebrow text-[#FF5F1F]">{project.year}</p>
              <button type="button" onClick={onClose} className="cti-close" aria-label="Close project">
                ×
              </button>
            </div>
            <h3 id="project-title" className="cti-display mt-4">
              {project.name}
            </h3>
            <ul className="mt-6 flex flex-wrap gap-2">
              {project.services.map((s) => (
                <li key={s} className="rounded-full border border-[#E8E8E5] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#777777]">
                  {s}
                </li>
              ))}
            </ul>
            <p className="cti-body mt-6 text-[#777777]">{project.body}</p>
          </div>
        </div>
      )}
    </dialog>
  );
}

function ProjectCard({ p, featured = false, onOpen }) {
  const open = p.images ? () => onOpen(p) : null;
  const Tag = open ? "button" : "div";
  return (
    <Tag
      type={open ? "button" : undefined}
      onClick={open || undefined}
      data-reveal
      className={`cti-card group relative block w-full overflow-hidden rounded-[18px] text-left ${featured ? "bg-[#111214] text-white" : "bg-white"} ${open ? "cursor-pointer" : ""}`}
    >
      <div className={`relative overflow-hidden ${featured ? "aspect-[16/12] md:aspect-auto md:h-full md:min-h-[34rem]" : "aspect-[16/10]"}`}>
        {p.images ? (
          <Image src={p.images[0]} alt={`${p.name}`} fill sizes={featured ? "(max-width: 768px) 92vw, 56vw" : "(max-width: 768px) 92vw, 28vw"} className="cti-card-img object-cover" />
        ) : (
          <>
            <Image src={p.cover} alt="" fill sizes="(max-width: 768px) 92vw, 28vw" className="cti-card-img object-cover" />
            <span className="absolute inset-0 grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt={`${p.name} logo`} className="h-12 w-auto max-w-[65%] drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] md:h-16" />
            </span>
          </>
        )}
        {featured && <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#111214] to-transparent" aria-hidden="true" />}
      </div>
      <div className={`flex items-end justify-between gap-4 ${featured ? "absolute inset-x-0 bottom-0 p-7 md:p-9" : "px-5 py-4"}`}>
        <div>
          <p className={`${featured ? "text-[clamp(1.6rem,2.6vw,2.4rem)]" : "text-[17px]"} font-medium leading-tight tracking-[-0.02em]`}>
            {p.name}
            {open && (
              <span className="cti-arrow ml-2 inline-block text-[#FF5F1F]" aria-hidden="true">
                ↗
              </span>
            )}
          </p>
          <p className={`mt-1 text-[13px] ${featured ? "text-white/60" : "text-[#777777]"}`}>{p.services.join(" · ")}</p>
        </div>
        {open && <span className={`cti-view font-mono text-[10px] uppercase tracking-[0.2em] ${featured ? "text-white/70" : "text-[#777777]"}`}>View project</span>}
      </div>
    </Tag>
  );
}

export function Work() {
  const [open, setOpen] = useState(null);
  const pick = (id) => PROJECTS.find((p) => p.id === id);
  const side = ["yellow", "monielink", "dsw", "ams"].map(pick);
  return (
    <section aria-label="Work" className="relative z-10 bg-[#F7F7F5] pb-28 text-[#111214]">
      <GridLines />
      <div className="cti-container relative">
        <div className="grid gap-5 md:grid-cols-12">
          <div className="md:col-span-7">
            <ProjectCard p={pick("montra")} featured onOpen={setOpen} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 md:col-span-5">
            {side.map((p) => (
              <ProjectCard key={p.id} p={p} onOpen={setOpen} />
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-12">
          <div className="md:col-span-5">
            <ProjectCard p={pick("patronum")} onOpen={setOpen} />
          </div>
          <div className="md:col-span-4">
            <ProjectCard p={pick("hiveminds")} onOpen={setOpen} />
          </div>
          <div data-reveal className="flex flex-col justify-end md:col-span-3">
            <p className="cti-body text-[#777777]">Every one of them began as a single idea.</p>
            <a href="#contact" className="cti-link mt-4">
              Start yours <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
      <ProjectDialog project={open} onClose={() => setOpen(null)} />
    </section>
  );
}

// ---- 18 capabilities and process ------------------------------------------
export function Capabilities() {
  const [openN, setOpenN] = useState("01");
  const processRef = useRef(null);

  useEffect(() => {
    const el = processRef.current;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 45%",
      onUpdate: (s) => el.style.setProperty("--p", s.progress.toFixed(4)),
    });
    return () => st.kill();
  }, []);

  return (
    <section id="capabilities" aria-labelledby="cap-title" className="relative z-10 border-t border-[#E8E8E5] bg-[#F7F7F5] py-28 text-[#111214] md:py-36">
      <div className="cti-container grid gap-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <Eyebrow n="06">Capabilities</Eyebrow>
          <h2 id="cap-title" data-reveal className="cti-display mt-6">
            We create at the intersection of design and technology.
          </h2>
          <p data-reveal className="cti-body mt-6 max-w-[24rem] text-[#777777]">
            The work is the outcome. These are what make it possible: four disciplines, one connected way of working.
          </p>
        </div>
        <ul className="md:col-span-6 md:col-start-7">
          {CAPABILITIES.map((c) => {
            const isOpen = openN === c.n;
            return (
              <li key={c.n} data-reveal className="border-b border-[#E8E8E5] first:border-t">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`cap-${c.n}`}
                    onClick={() => setOpenN(isOpen ? null : c.n)}
                    className="group flex w-full items-center gap-6 py-6 text-left"
                  >
                    <span className="font-mono text-[12px] text-[#FF5F1F]">{c.n}</span>
                    <span className="flex-1 text-[clamp(1.15rem,1.6vw,1.45rem)] font-medium tracking-[-0.015em] transition-transform duration-500 group-hover:translate-x-1">{c.name}</span>
                    <span className={`cti-plus ${isOpen ? "is-open" : ""}`} aria-hidden="true" />
                  </button>
                </h3>
                <div id={`cap-${c.n}`} className={`cti-acc ${isOpen ? "is-open" : ""}`}>
                  <div className="overflow-hidden">
                    <p className="cti-body max-w-[30rem] pl-[2.6rem] text-[#777777]">{c.body}</p>
                    <ul className="flex flex-wrap gap-2 pb-7 pl-[2.6rem] pt-4">
                      {c.items.map((s) => (
                        <li key={s} className="rounded-full border border-[#E8E8E5] bg-white px-3 py-1 text-[12px] text-[#111214]">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* how: the process, its markers filling as it is read */}
      <div className="cti-container mt-24 md:mt-32">
        <p data-reveal className="cti-eyebrow text-[#777777]">
          How an idea becomes an experience
        </p>
        <ol ref={processRef} className="cti-process relative mt-10 grid gap-10 md:grid-cols-5 md:gap-6" style={{ "--p": 0 }}>
          <span className="cti-process-rail" aria-hidden="true" />
          {PROCESS.map((s, i) => (
            <li key={s.n} className="relative md:pt-10" style={{ "--i": i }}>
              <span className="cti-process-dot" aria-hidden="true" />
              <p className="font-mono text-[11px] tracking-[0.18em] text-[#FF5F1F]">{s.n}</p>
              <h3 className="mt-2 text-[20px] font-medium tracking-[-0.015em]">{s.label}</h3>
              <p className="cti-body mt-2 text-[#777777]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---- studio: the people behind it ---------------------------------------
export function Studio() {
  return (
    <section id="studio" aria-labelledby="studio-title" className="relative z-10 border-t border-[#E8E8E5] bg-[#F7F7F5] py-28 text-[#111214] md:py-32">
      <div className="cti-container grid gap-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <Eyebrow n="07">Studio</Eyebrow>
          <h2 id="studio-title" data-reveal className="cti-display-sm mt-6">
            {STUDIO.title}
          </h2>
          <p data-reveal className="cti-body mt-6 max-w-[26rem] text-[#777777]">
            {STUDIO.body}
          </p>
        </div>
        <div className="grid gap-10 md:col-span-6 md:col-start-7">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} data-reveal className="border-l border-[#FF5F1F] pl-6">
              <blockquote className="text-[clamp(1.05rem,1.35vw,1.3rem)] leading-[1.45] tracking-[-0.01em]">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#777777]">
                {t.name} · {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- 19 the vault ---------------------------------------------------------
// its previews are working components (a magnetic button, a toggle, a
// wave), not pictures of them
function Magnetic() {
  const ref = useRef(null);
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.35;
    const y = (e.clientY - r.top - r.height / 2) * 0.35;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const leave = () => (ref.current.style.transform = "");
  return (
    <div className="grid h-full place-items-center" onPointerMove={move} onPointerLeave={leave}>
      <span ref={ref} className="cti-magnetic">
        Hover me
      </span>
    </div>
  );
}

function Toggle() {
  const [on, setOn] = useState(true);
  return (
    <div className="grid h-full place-items-center">
      <button type="button" role="switch" aria-checked={on} onClick={() => setOn(!on)} className={`cti-switch ${on ? "is-on" : ""}`} aria-label="Preview toggle">
        <span />
      </button>
    </div>
  );
}

export function WaveLines({ className = "", count = 22, color = "#FF5F1F", light = false }) {
  return (
    <svg viewBox="0 0 800 400" preserveAspectRatio="none" className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const k = i / (count - 1);
        const y0 = 230 + k * 60;
        const d = `M -20 ${y0} C 180 ${y0 - 150 + k * 40}, 360 ${y0 + 120 - k * 90}, 560 ${y0 - 60 + k * 30} S 760 ${y0 - 190 + k * 70}, 830 ${y0 - 120}`;
        return <path key={i} d={d} fill="none" stroke={light && i % 3 ? "#A9AAAD" : color} strokeOpacity={(0.25 + 0.6 * Math.sin(k * Math.PI)).toFixed(3)} strokeWidth="1" className="cti-wave" style={{ animationDelay: `${-i * 0.35}s` }} />;
      })}
    </svg>
  );
}

export function Vault() {
  return (
    <section id="vault" aria-labelledby="vault-title" className="relative z-10 bg-[#F7F7F5] pb-28 text-[#111214] md:pb-36">
      <div className="cti-container">
        <div data-reveal className="relative overflow-hidden rounded-[24px] bg-[#111214] px-7 py-12 text-white md:px-14 md:py-16">
          <WaveLines className="absolute inset-x-0 bottom-0 h-[70%] w-full opacity-80" />
          <div className="relative grid gap-12 md:grid-cols-12">
            <div className="md:col-span-6">
              <p className="cti-eyebrow text-[#FF5F1F]">08 / The Vault</p>
              <h2 id="vault-title" className="cti-display mt-6">
                A library of interactions.
                <br />
                <span className="text-[#FF5F1F]">Built for developers.</span>
              </h2>
              <p className="cti-body mt-6 max-w-[26rem] text-white/60">A growing collection of premium, production-ready interactions, components and WebGL experiments.</p>
              {/* (the Vault has no public URL in this project yet) */}
              <a href="#vault" className="cti-cta-orange mt-10">
                Explore the Vault <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="relative h-[19rem] md:col-span-6 md:h-auto md:min-h-[22rem]">
              <div className="cti-pane absolute left-0 top-4 h-[11rem] w-[62%]">
                <p className="cti-pane-label">Magnetic button</p>
                <Magnetic />
              </div>
              <div className="cti-pane absolute right-0 top-20 h-[9rem] w-[46%]">
                <p className="cti-pane-label">Toggle</p>
                <Toggle />
              </div>
              <div className="cti-pane absolute bottom-0 left-[18%] h-[8.5rem] w-[64%] overflow-hidden">
                <p className="cti-pane-label">Flow lines · WebGL-free</p>
                <WaveLines className="absolute inset-0 h-full w-full" count={14} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- 20 closing ------------------------------------------------------------
export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="relative z-10 overflow-hidden border-t border-[#E8E8E5] bg-[#F7F7F5] text-[#111214]">
      <WaveLines className="pointer-events-none absolute -right-[10%] top-0 h-[85%] w-[80%] opacity-90" count={34} light />
      <div className="cti-container relative pb-16 pt-28 md:pt-40">
        <Eyebrow n="09">Let&apos;s connect</Eyebrow>
        <h2 id="contact-title" data-reveal className="cti-display-xl mt-6 max-w-[54rem]">
          Have something ambitious in mind?
          <br />
          <span className="text-[#FF5F1F]">Let&apos;s bring it to life.</span>
        </h2>
        <div data-reveal className="mt-12">
          <a href={`mailto:${CONTACT.email}`} className="cti-cta-orange">
            Start a project <span aria-hidden="true">↗</span>
          </a>
        </div>

        <footer className="mt-28 grid gap-10 border-t border-[#E8E8E5] pt-10 text-[14px] md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#777777]">Write to us</p>
            <a href={`mailto:${CONTACT.email}`} className="cti-link mt-3 text-[18px]">
              {CONTACT.email}
            </a>
            <a href={CONTACT.phoneHref} className="mt-2 block text-[#777777] hover:text-[#111214]">
              {CONTACT.phone}
            </a>
          </div>
          <address className="not-italic text-[#777777] md:col-span-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Studio</p>
            <p className="mt-3 leading-relaxed">
              {CONTACT.company}
              <br />
              {CONTACT.address}
            </p>
          </address>
          <nav aria-label="Footer" className="md:col-span-2 md:col-start-9">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#777777]">Menu</p>
            <ul className="mt-3 space-y-1.5">
              {NAV.map((n) => (
                <li key={n.to}>
                  <a href={n.to} className="hover:text-[#FF5F1F]">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="md:col-span-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#777777]">Follow</p>
            {/* (no profile URLs in the project yet) */}
            <ul className="mt-3 space-y-1.5 text-[#777777]">
              {SOCIAL.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777777] md:col-span-12">© {new Date().getFullYear()} Hyperiux · From curiosity to impact</p>
        </footer>
      </div>
    </section>
  );
}
