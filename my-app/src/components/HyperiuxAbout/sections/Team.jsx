"use client";

import { useCallback, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Portrait from "./Portrait";
import { TEAM, TEAM_COPY } from "../content";

gsap.registerPlugin(useGSAP);

const pad = (n) => String(n).padStart(3, "0");
const LINK_LABELS = { linkedin: "LinkedIn", x: "X", instagram: "Instagram", dribbble: "Dribbble", behance: "Behance", site: "Website" };

// The team, after lusion.co/about: the leads one at a time, large, with
// their story (swipe / drag / arrows to change), then everyone in a grid.
export default function Team() {
  const leads = TEAM.filter((p) => p.lead);
  return (
    <section id="team" className="relative bg-white px-[5vw] pb-[10vw] pt-[8vw] text-[#111] max-[33.875rem]:px-[6vw] max-[33.875rem]:pb-24 max-[33.875rem]:pt-20">
      <div className="grid grid-cols-12 gap-[2vw] max-[64rem]:gap-y-6">
        <SectionLabel index={TEAM_COPY.index} label={TEAM_COPY.label} className="col-span-3 max-[64rem]:col-span-12" />
        <div className="col-span-9 max-[64rem]:col-span-12">
          <h2 data-split className="font-[family-name:var(--font-aeonikpro)] text-[5vw] font-normal leading-[1.02] tracking-[-0.025em] max-[64rem]:text-[8vw] max-[33.875rem]:text-[10.5vw]">
            {TEAM_COPY.title[0]}
            <br />
            <span className="text-[#FF5F00]">{TEAM_COPY.title[1]}</span>
          </h2>
          <p data-fade className="mt-[2vw] max-w-[38vw] font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.6] text-[#111]/70 max-[64rem]:mt-5 max-[64rem]:max-w-none max-[64rem]:text-[2.2vw] max-[33.875rem]:text-[4vw]">
            {TEAM_COPY.body}
          </p>
        </div>
      </div>

      {leads.length > 0 && <LeadSlider leads={leads} />}
      <TeamGrid />
    </section>
  );
}

export function SectionLabel({ index, label, className = "", dark = false }) {
  return (
    <p
      data-fade
      className={`flex items-center gap-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase tracking-[0.28em] max-[64rem]:gap-3 max-[64rem]:text-[1.8vw] max-[33.875rem]:text-[3vw] ${dark ? "text-white/60" : "text-[#111]/60"} ${className}`}
    >
      <span className="font-[family-name:var(--font-orbitron)] tracking-[0.12em] text-[#FF5F00]">[ {index} ]</span>
      {label}
    </p>
  );
}

function LeadSlider({ leads }) {
  const root = useRef(null);
  const [active, setActive] = useState(0);
  const busy = useRef(false);
  const drag = useRef(null);
  const total = leads.length;

  const dirRef = useRef(0); // the way the last change went (0: none yet)

  const go = useCallback(
    (next) => {
      if (busy.current || total < 2) return;
      const to = ((next % total) + total) % total;
      if (to === active) return;
      const dir = next > active ? 1 : -1;
      busy.current = true;
      dirRef.current = dir;
      const el = root.current;
      // the text out, the next portrait wiping in over the current one
      gsap.to(el.querySelectorAll("[data-lead-text]"), {
        yPercent: -105 * dir,
        duration: 0.45,
        stagger: 0.04,
        ease: "power3.in",
        onComplete: () => setActive(to),
      });
      const img = el.querySelector(`[data-lead-img="${to}"]`);
      gsap.set(el.querySelectorAll("[data-lead-img]"), { zIndex: 0 });
      gsap.set(el.querySelector(`[data-lead-img="${active}"]`), { zIndex: 1 });
      gsap.fromTo(
        img,
        { zIndex: 2, clipPath: dir > 0 ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.05, ease: "expo.inOut" }
      );
      gsap.fromTo(img.firstChild, { scale: 1.18 }, { scale: 1, duration: 1.4, ease: "expo.out" });
    },
    [active, total]
  );

  // the new person's text in (once the change has rendered it)
  useGSAP(
    () => {
      const dir = dirRef.current;
      if (!dir) return;
      gsap.fromTo(
        root.current.querySelectorAll("[data-lead-text]"),
        { yPercent: 105 * dir },
        { yPercent: 0, duration: 0.8, stagger: 0.05, ease: "power4.out", onComplete: () => (busy.current = false) }
      );
    },
    { scope: root, dependencies: [active] }
  );

  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1));
  };

  const p = leads[active];
  const leadIndex = TEAM.indexOf(p);

  return (
    <div
      ref={root}
      data-fade
      className="relative mt-[7vw] grid touch-pan-y select-none grid-cols-12 gap-[2vw] border-t border-[#111]/10 pt-[3vw] max-[64rem]:mt-14 max-[64rem]:gap-y-8 max-[64rem]:pt-8"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Leadership"
      tabIndex={0}
    >
      {/* portraits, stacked */}
      <div className="group relative col-span-5 aspect-[4/5] cursor-grab overflow-hidden rounded-(--border-radius) active:cursor-grabbing max-[64rem]:col-span-12 max-[64rem]:mx-auto max-[64rem]:w-[70%] max-[33.875rem]:w-full">
        {leads.map((person, i) => (
          <div key={person.name + i} data-lead-img={i} className="absolute inset-0" style={{ zIndex: i === active ? 1 : 0 }}>
            <Portrait person={person} index={TEAM.indexOf(person)} className="size-full" sizes="(max-width: 64rem) 90vw, 40vw" priority={i === 0} />
          </div>
        ))}
        <span className="absolute left-[1.4vw] top-[1.4vw] z-10 rounded-full bg-black/35 px-[0.8vw] py-[0.3vw] font-[family-name:var(--font-orbitron)] text-[0.65vw] tracking-[0.18em] text-white backdrop-blur-sm max-[64rem]:left-4 max-[64rem]:top-4 max-[64rem]:px-3 max-[64rem]:py-1 max-[64rem]:text-[10px]">
          [ {pad(active + 1)} / {pad(total)} ]
        </span>
      </div>

      {/* their story */}
      <div className="col-span-6 col-start-7 flex flex-col justify-between max-[64rem]:col-span-12 max-[64rem]:col-start-1">
        <div aria-live="polite">
          <div className="flex items-center justify-between gap-4 font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase tracking-[0.24em] text-[#111]/50 max-[64rem]:text-[1.8vw] max-[33.875rem]:text-[3vw]">
            <span className="overflow-hidden">
              <span data-lead-text className="block">
                Leadership — {p.discipline}
              </span>
            </span>
            <span className="font-[family-name:var(--font-orbitron)] tracking-[0.12em] text-[#FF5F00]">[ {pad(leadIndex + 1)} ]</span>
          </div>
          <h3 className="mt-[2.6vw] overflow-hidden font-[family-name:var(--font-aeonikpro)] text-[4.6vw] font-normal uppercase leading-[0.95] tracking-[-0.03em] max-[64rem]:mt-6 max-[64rem]:text-[8vw] max-[33.875rem]:text-[11vw]">
            <span data-lead-text className="block pb-[0.06em]">
              {p.name}
            </span>
          </h3>
          <p className="mt-[0.8vw] overflow-hidden font-[family-name:var(--font-aeonikpro)] text-[1.5vw] text-[#FF5F00] max-[64rem]:mt-2 max-[64rem]:text-[3vw] max-[33.875rem]:text-[5.4vw]">
            <span data-lead-text className="block">
              {p.role}
            </span>
          </p>
          <p className="mt-[2.4vw] max-w-[34vw] overflow-hidden font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.6] text-[#111]/70 max-[64rem]:mt-6 max-[64rem]:max-w-none max-[64rem]:text-[2.2vw] max-[33.875rem]:text-[4vw]">
            <span data-lead-text className="block">
              {p.bio}
            </span>
          </p>
          {p.links && (
            <div className="mt-[1.8vw] flex gap-[1.4vw] overflow-hidden font-[family-name:var(--font-aeonikpro)] text-[0.95vw] max-[64rem]:mt-5 max-[64rem]:gap-5 max-[64rem]:text-[2vw] max-[33.875rem]:text-[3.8vw]">
              <span data-lead-text className="flex gap-[1.4vw] max-[64rem]:gap-5">
                {Object.entries(p.links).map(([k, href]) => (
                  <a key={k} href={href} target="_blank" rel="noreferrer" className="border-b border-[#111]/25 pb-0.5 transition-colors hover:border-[#FF5F00] hover:text-[#FF5F00]">
                    {LINK_LABELS[k] || k} ↗
                  </a>
                ))}
              </span>
            </div>
          )}
        </div>

        {total > 1 && (
          <div className="mt-[3vw] flex items-end justify-between gap-6 max-[64rem]:mt-10">
            <div className="flex gap-[0.8vw] max-[64rem]:gap-3">
              {leads.map((person, i) => (
                <button
                  key={person.name + i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${person.name}`}
                  aria-current={i === active}
                  className={`group relative aspect-[4/5] w-[4.2vw] cursor-pointer overflow-hidden rounded-[0.5vw] transition-[opacity,transform] duration-500 max-[64rem]:w-14 max-[64rem]:rounded-md ${
                    i === active ? "opacity-100 ring-2 ring-[#FF5F00] ring-offset-2" : "opacity-50 hover:opacity-90"
                  }`}
                >
                  <Portrait person={person} index={TEAM.indexOf(person)} className="size-full" sizes="80px" compact />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-[1vw] max-[64rem]:gap-3">
              <span className="font-[family-name:var(--font-aeonikpro)] text-[0.75vw] uppercase tracking-[0.24em] text-[#111]/40 max-[64rem]:hidden">Drag to change</span>
              <ArrowButton dir={-1} onClick={() => go(active - 1)} />
              <ArrowButton dir={1} onClick={() => go(active + 1)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArrowButton({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir > 0 ? "Next" : "Previous"}
      className="group flex size-[3.6vw] cursor-pointer items-center justify-center rounded-full border border-[#111]/20 text-[1.2vw] transition-colors duration-300 hover:border-[#FF5F00] hover:bg-[#FF5F00] hover:text-white max-[64rem]:size-12 max-[64rem]:text-lg"
    >
      <span className={`transition-transform duration-300 ${dir > 0 ? "group-hover:translate-x-0.5" : "group-hover:-translate-x-0.5"}`}>{dir > 0 ? "→" : "←"}</span>
    </button>
  );
}

function TeamGrid() {
  const root = useRef(null);

  // a slight tilt towards the pointer
  useGSAP(
    () => {
      if (!window.matchMedia("(hover: hover)").matches) return;
      const cards = gsap.utils.toArray("[data-card]", root.current);
      const offs = cards.map((card) => {
        const inner = card.querySelector("[data-card-tilt]");
        const rx = gsap.quickTo(inner, "rotationX", { duration: 0.6, ease: "power3.out" });
        const ry = gsap.quickTo(inner, "rotationY", { duration: 0.6, ease: "power3.out" });
        const move = (e) => {
          const r = card.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 8);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
        };
        const leave = () => {
          rx(0);
          ry(0);
        };
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerleave", leave);
        return () => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerleave", leave);
        };
      });
      return () => offs.forEach((off) => off());
    },
    { scope: root }
  );

  return (
    <div ref={root} className="mt-[9vw] max-[64rem]:mt-20">
      <div className="flex items-end justify-between border-b border-[#111]/10 pb-[1.4vw] max-[64rem]:pb-4">
        <h3 data-fade className="font-[family-name:var(--font-aeonikpro)] text-[2.4vw] font-normal leading-none max-[64rem]:text-[4.6vw] max-[33.875rem]:text-[7vw]">
          {TEAM_COPY.gridLabel}
        </h3>
        <span data-fade className="font-[family-name:var(--font-orbitron)] text-[0.85vw] tracking-[0.14em] text-[#FF5F00] max-[64rem]:text-[1.8vw] max-[33.875rem]:text-[3.2vw]">
          [ {pad(TEAM.length)} ]
        </span>
      </div>
      <ul className="mt-[2.4vw] grid grid-cols-4 gap-x-[1.6vw] gap-y-[3.6vw] max-[64rem]:mt-8 max-[64rem]:grid-cols-3 max-[64rem]:gap-x-4 max-[64rem]:gap-y-10 max-[33.875rem]:grid-cols-2 max-[33.875rem]:gap-x-3">
        {TEAM.map((person, i) => (
          <li key={person.name + i} data-card data-fade-stagger className="group [perspective:900px]">
            <div data-card-tilt className="will-change-transform [transform-style:preserve-3d]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-(--border-radius)">
                <Portrait person={person} index={i} className="size-full" />
                {/* the bio over the portrait, on hover */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-[12%] bg-gradient-to-t from-black/80 via-black/40 to-transparent p-[1.4vw] pt-[5vw] opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 max-[64rem]:hidden">
                  <p className="font-[family-name:var(--font-aeonikpro)] text-[0.9vw] leading-[1.5] text-white/90">{person.bio}</p>
                </div>
                <span className="absolute left-[1vw] top-[1vw] font-[family-name:var(--font-orbitron)] text-[0.6vw] tracking-[0.16em] text-white/80 max-[64rem]:left-3 max-[64rem]:top-3 max-[64rem]:text-[9px]">
                  [ {pad(i + 1)} ]
                </span>
              </div>
            </div>
            <div className="mt-[1.2vw] flex items-start justify-between gap-3 max-[64rem]:mt-3">
              <div>
                <p className="relative w-fit font-[family-name:var(--font-aeonikpro)] text-[1.4vw] leading-tight max-[64rem]:text-[2.8vw] max-[33.875rem]:text-[4.4vw]">
                  {person.name}
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-[#FF5F00] transition-transform duration-500 ease-out group-hover:scale-x-100" />
                </p>
                <p className="mt-[0.3vw] font-[family-name:var(--font-aeonikpro)] text-[0.95vw] text-[#111]/55 max-[64rem]:mt-1 max-[64rem]:text-[2vw] max-[33.875rem]:text-[3.4vw]">{person.role}</p>
              </div>
              <span className="mt-[0.3vw] shrink-0 rounded-full border border-[#111]/15 px-[0.7vw] py-[0.2vw] font-[family-name:var(--font-aeonikpro)] text-[0.7vw] text-[#111]/60 transition-colors duration-300 group-hover:border-[#FF5F00] group-hover:text-[#FF5F00] max-[64rem]:px-2 max-[64rem]:text-[1.6vw] max-[33.875rem]:hidden">
                {person.discipline}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
