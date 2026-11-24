"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { useLenis } from "lenis/react";
import { SectionLabel } from "./Team";
import { CTA, EXPERTISE, INTRO, JOIN } from "../content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Who we are: the statement lighting up word by word with the scroll, the
// site's paragraph, and the four meeting points of its positioning.
export function Intro() {
  const root = useRef(null);
  useGSAP(
    () => {
      gsap.fromTo(
        "[data-word]",
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.08,
          ease: "none",
          scrollTrigger: { trigger: "[data-statement]", start: "top 80%", end: "bottom 45%", scrub: true },
        }
      );
    },
    { scope: root }
  );
  return (
    <section ref={root} id="who-we-are" className="relative bg-white px-[5vw] pb-[6vw] pt-[12vw] text-[#111] max-[33.875rem]:px-[6vw] max-[33.875rem]:pt-24">
      <div className="grid grid-cols-12 gap-[2vw] max-[64rem]:gap-y-6">
        <SectionLabel index={INTRO.index} label={INTRO.label} className="col-span-3 max-[64rem]:col-span-12" />
        <div className="col-span-9 max-[64rem]:col-span-12">
          <p data-statement className="font-[family-name:var(--font-aeonikpro)] text-[4.2vw] font-normal leading-[1.08] tracking-[-0.025em] max-[64rem]:text-[7vw] max-[33.875rem]:text-[9.4vw]">
            {INTRO.statement.split(" ").map((w, i) => (
              <span key={i} data-word className={`inline-block pr-[0.25em] ${/conversion|web/i.test(w) ? "text-[#FF5F00]" : ""}`}>
                {w}
              </span>
            ))}
          </p>
          <p data-fade className="mt-[3vw] max-w-[40vw] font-[family-name:var(--font-aeonikpro)] text-[1.15vw] leading-[1.65] text-[#111]/70 max-[64rem]:mt-8 max-[64rem]:max-w-none max-[64rem]:text-[2.3vw] max-[33.875rem]:text-[4vw]">
            {INTRO.body}
          </p>
        </div>
      </div>

      <div className="mt-[8vw] grid grid-cols-4 gap-[2vw] max-[64rem]:mt-16 max-[64rem]:grid-cols-2 max-[64rem]:gap-y-10 max-[33.875rem]:grid-cols-1">
        {INTRO.pillars.map((item) => (
          <div key={item.n} data-fade-stagger className="group border-t border-[#111]/15 pt-[1.6vw] max-[33.875rem]:pt-5">
            <p className="font-[family-name:var(--font-orbitron)] text-[0.9vw] tracking-[0.2em] text-[#FF5F00] max-[64rem]:text-[2vw] max-[33.875rem]:text-[3.4vw]">{item.n}</p>
            <h3 className="mt-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[2vw] font-normal max-[64rem]:mt-2 max-[64rem]:text-[4.4vw] max-[33.875rem]:text-[7vw]">{item.title}</h3>
            <p className="mt-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[1vw] leading-[1.5] text-[#111]/65 max-[64rem]:mt-2 max-[64rem]:text-[2.2vw] max-[33.875rem]:text-[4vw]">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Area of expertise: the four solutions, each under its letter.
export function Expertise() {
  return (
    <section id="expertise" className="relative bg-[#f3f3f1] px-[5vw] py-[9vw] text-[#111] max-[33.875rem]:px-[6vw] max-[33.875rem]:py-20">
      <div className="grid grid-cols-12 gap-[2vw] max-[64rem]:gap-y-6">
        <SectionLabel index={EXPERTISE.index} label={EXPERTISE.label} className="col-span-3 max-[64rem]:col-span-12" />
        <h2 data-split className="col-span-9 font-[family-name:var(--font-aeonikpro)] text-[4.4vw] font-normal leading-[1.04] tracking-[-0.025em] max-[64rem]:col-span-12 max-[64rem]:text-[7.4vw] max-[33.875rem]:text-[9.6vw]">
          {EXPERTISE.title[0]}
          <br />
          <span className="text-[#FF5F00]">{EXPERTISE.title[1]}</span>
        </h2>
      </div>
      <div className="mt-[6vw] grid grid-cols-4 gap-[1.2vw] max-[64rem]:mt-12 max-[64rem]:grid-cols-2 max-[64rem]:gap-4 max-[33.875rem]:grid-cols-1">
        {EXPERTISE.items.map((item, i) => (
          <article
            key={item.title}
            data-fade-stagger
            className="group relative flex min-h-[30vw] flex-col justify-between overflow-hidden rounded-(--border-radius) bg-white p-[2vw] transition-colors duration-500 hover:bg-[#0e0b09] hover:text-white max-[64rem]:min-h-[52vw] max-[64rem]:p-6 max-[33.875rem]:min-h-0 max-[33.875rem]:gap-10"
          >
            {/* the forge's glow, rising on hover */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 translate-y-full bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,95,0,0.45),transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-y-0" />
            <div className="relative flex items-start justify-between">
              <span className="font-[family-name:var(--font-orbitron)] text-[5vw] leading-none text-[#111]/10 transition-colors duration-500 group-hover:text-[#FF5F00] max-[64rem]:text-[12vw] max-[33.875rem]:text-[18vw]">
                {item.glyph}
              </span>
              <span className="font-[family-name:var(--font-orbitron)] text-[0.75vw] tracking-[0.14em] text-[#FF5F00] max-[64rem]:text-[1.8vw] max-[33.875rem]:text-[3.2vw]">0{i + 1}</span>
            </div>
            <div className="relative">
              <h3 className="font-[family-name:var(--font-aeonikpro)] text-[1.9vw] font-normal leading-tight max-[64rem]:text-[4vw] max-[33.875rem]:text-[7vw]">{item.title}</h3>
              <p className="mt-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[0.95vw] leading-[1.55] text-[#111]/65 transition-colors duration-500 group-hover:text-white/75 max-[64rem]:mt-3 max-[64rem]:text-[2.1vw] max-[33.875rem]:text-[4vw]">
                {item.body}
              </p>
              <ul className="mt-[1.2vw] flex flex-wrap gap-[0.4vw] max-[64rem]:mt-4 max-[64rem]:gap-2">
                {item.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-[#111]/15 px-[0.8vw] py-[0.3vw] font-[family-name:var(--font-aeonikpro)] text-[0.72vw] text-[#111]/70 transition-colors duration-500 group-hover:border-white/25 group-hover:text-white/80 max-[64rem]:px-3 max-[64rem]:py-1 max-[64rem]:text-[1.7vw] max-[33.875rem]:text-[3.2vw]"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// Join us: a quiet invitation before the footer.
export function Join() {
  return (
    <section id="join" className="relative bg-white px-[5vw] py-[9vw] text-[#111] max-[33.875rem]:px-[6vw] max-[33.875rem]:py-20">
      <div className="grid grid-cols-12 gap-[2vw] border-t border-[#111]/10 pt-[5vw] max-[64rem]:gap-y-6 max-[33.875rem]:pt-12">
        <SectionLabel index={JOIN.index} label={JOIN.label} className="col-span-3 max-[64rem]:col-span-12" />
        <div className="col-span-9 flex items-end justify-between gap-[4vw] max-[64rem]:col-span-12 max-[64rem]:flex-col max-[64rem]:items-start">
          <div>
            <h2 data-split className="max-w-[46vw] font-[family-name:var(--font-aeonikpro)] text-[3.6vw] font-normal leading-[1.06] tracking-[-0.02em] max-[64rem]:max-w-none max-[64rem]:text-[6.4vw] max-[33.875rem]:text-[9vw]">
              {JOIN.title}
            </h2>
            <p data-fade className="mt-[1.8vw] max-w-[36vw] font-[family-name:var(--font-aeonikpro)] text-[1.05vw] leading-[1.6] text-[#111]/65 max-[64rem]:mt-5 max-[64rem]:max-w-none max-[64rem]:text-[2.2vw] max-[33.875rem]:text-[4vw]">
              {JOIN.body}
            </p>
          </div>
          <a
            data-fade
            href={`mailto:${CTA.email}?subject=${encodeURIComponent("Joining Hyperiux")}`}
            className="group inline-flex shrink-0 items-center gap-3 rounded-full bg-[#FF5F00] px-[2vw] py-[0.9vw] font-[family-name:var(--font-aeonikpro)] text-[1.15vw] text-white transition-colors hover:bg-[#111] max-[64rem]:px-6 max-[64rem]:py-3 max-[64rem]:text-[2.4vw] max-[33.875rem]:text-[4.4vw]"
          >
            {JOIN.cta}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

const SOCIAL = ["LinkedIn", "Instagram", "X", "Facebook"]; // (placeholders until the profiles are linked)
const PAGES = [
  {
    title: "Company",
    links: [
      { label: "Home", href: "/forging-sand-dune-concept-v3" },
      { label: "About", href: "/about" },
      { label: "Team", href: "#team" },
      { label: "Expertise", href: "#expertise" },
      { label: "Contact us", href: "#contact" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Clients", href: "#clients" },
      { label: "Join us", href: "#join" },
    ],
  },
];

// The site's footer (as on the concept page): the call to action, contact
// and links, over the dusk's last light.
export function AboutFooter() {
  const lenis = useLenis();
  const go = (e, href) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const el = document.querySelector(href);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.6 });
    else el.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <footer
      id="contact"
      data-about-footer
      className="relative z-10 flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[#0e0b09] px-[5vw] pb-[2vw] pt-[6vw] font-[family-name:var(--font-aeonikpro)] text-white max-[64rem]:px-6 max-[64rem]:pb-8 max-[64rem]:pt-24"
    >
      {/* the last of the dusk: a horizon glow low behind the type */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(ellipse_70%_60%_at_50%_100%,rgba(228,142,79,0.32)_0%,rgba(255,95,0,0.12)_40%,transparent_75%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-6vw] select-none text-center text-[22vw] font-medium leading-none tracking-[-0.05em] text-white/[0.035] max-[33.875rem]:bottom-[-2vw]">
        HYPERIUX
      </div>

      <div className="relative flex flex-col items-start gap-[2vw] max-[64rem]:gap-6">
        <h2 className="w-[60%] text-[5.5vw] leading-[0.95] max-[64rem]:w-full max-[64rem]:text-[10vw]">{CTA.title}</h2>
        <a
          href={`mailto:${CTA.email}`}
          className="border border-white/60 px-[1.6vw] py-[0.65vw] text-[0.95vw] transition-colors duration-300 hover:border-[#ff5f00] hover:bg-[#ff5f00] hover:text-black max-[64rem]:px-5 max-[64rem]:py-2.5 max-[64rem]:text-sm"
        >
          Say Hi
        </a>
      </div>

      <div className="relative mt-[18vw] flex items-end justify-between gap-[6vw] max-[64rem]:mt-24 max-[64rem]:flex-col max-[64rem]:items-start max-[64rem]:gap-10">
        <div className="flex w-[35vw] flex-col gap-[1.2vw] text-[1.1vw] max-[64rem]:w-full max-[64rem]:gap-4 max-[64rem]:text-base">
          <a href={`mailto:${CTA.email}`} className="w-fit border-b border-white/30 pb-1 transition-colors hover:border-[#ff5f00] hover:text-[#ff5f00]">
            {CTA.email}
          </a>
          <a href={`tel:${CTA.phone.replace(/\s/g, "")}`} className="w-fit border-b border-white/30 pb-1 transition-colors hover:border-[#ff5f00] hover:text-[#ff5f00]">
            {CTA.phone}
          </a>
          <p className="text-white/80">{CTA.address}</p>
          <div className="flex gap-[1.5vw] text-white/80 max-[64rem]:gap-5">
            {SOCIAL.map((s) => (
              <a key={s} href="#" onClick={(e) => e.preventDefault()} className="transition-colors hover:text-[#ff5f00]">
                {s}
              </a>
            ))}
          </div>
        </div>
        <div className="flex gap-[8vw] max-[64rem]:gap-16">
          {PAGES.map((section) => (
            <div key={section.title} className="flex flex-col gap-[0.8vw] max-[64rem]:gap-3">
              <h3 className="mb-[0.4vw] text-[1.4vw] font-medium max-[64rem]:text-lg">{section.title}</h3>
              {section.links.map((l) =>
                l.href.startsWith("#") ? (
                  <a key={l.label} href={l.href} onClick={(e) => go(e, l.href)} className="w-fit text-[1vw] text-white/80 transition-colors hover:text-[#ff5f00] max-[64rem]:text-base">
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} href={l.href} className="w-fit text-[1vw] text-white/80 transition-colors hover:text-[#ff5f00] max-[64rem]:text-base">
                    {l.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="relative mt-[3vw] text-[0.85vw] text-white/60 max-[64rem]:mt-10 max-[64rem]:text-xs">© 2026 Hyperiux Immersion Labs. All rights reserved.</p>
    </footer>
  );
}
