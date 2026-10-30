"use client";

import { useEffect, useRef } from "react";
import { T } from "./tuning";
import { FOOTER } from "./footer";

// The site's footer (its content as on hyperiux-staging). Behind it, the
// garden again — the journey pins its canvas behind the page as the footer
// comes near (footer.js), so the last section scrolls away to uncover it,
// the particle body turned into the Hyperiux wordmark — dimmed a little,
// under the type. Until the garden is there (and on devices that let the
// scene go), it is a plain dark ground.

const CONTACT = [
  { label: "hi@hyperiux.com", href: "mailto:hi@hyperiux.com" },
  { label: "+91 8178 026 136", href: "tel:+918178026136" },
];
const SECTIONS = [
  { title: "Company", links: ["About", "Work", "Expertise", "Career", "Resources", "Contact us"] },
  { title: "Discover", links: ["The Vault", "Labs"] },
];
const SOCIAL = ["LinkedIn", "Instagram", "X", "Facebook"];

export default function SiteFooter() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    FOOTER.el = el;
    return () => {
      if (FOOTER.el === el) FOOTER.el = null;
    };
  }, []);

  return (
    <footer
      ref={ref}
      className="group relative z-10 flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[#0e0b09] px-[5vw] pb-[2vw] pt-[6vw] font-[family-name:var(--font-aeonikpro)] text-white data-[live=1]:bg-transparent max-[64rem]:px-6 max-[64rem]:pb-8 max-[64rem]:pt-24"
    >
      {/* the garden behind, dimmed: evenly, and more towards the foot (under the links) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(to bottom, rgba(10,10,10,${T.footerDim * 0.75}) 0%, rgba(10,10,10,${T.footerDim}) 55%, rgba(10,10,10,${Math.min(T.footerDim + 0.35, 0.95)}) 100%)` }}
      />

      <div className="relative flex flex-col items-start gap-[2vw] max-[64rem]:gap-6">
        <h2 className="w-[60%] text-[5.5vw] leading-[0.95] max-[64rem]:w-full max-[64rem]:text-[10vw]">Let&apos;s Bring Your Ideas To Life!</h2>
        <a
          href="mailto:hi@hyperiux.com"
          className="border border-white/60 px-[1.6vw] py-[0.65vw] text-[0.95vw] transition-colors duration-300 hover:border-[#ff5f00] hover:bg-[#ff5f00] hover:text-black max-[64rem]:px-5 max-[64rem]:py-2.5 max-[64rem]:text-sm"
        >
          Say Hi
        </a>
      </div>

      <div className="relative mt-[22vw] flex items-end justify-between gap-[6vw] max-[64rem]:mt-24 max-[64rem]:flex-col max-[64rem]:items-start max-[64rem]:gap-10">
        <div className="flex w-[35vw] flex-col gap-[1.2vw] text-[1.1vw] max-[64rem]:w-full max-[64rem]:gap-4 max-[64rem]:text-base">
          {CONTACT.map((c) => (
            <a key={c.href} href={c.href} className="w-fit border-b border-white/30 pb-1 transition-colors hover:border-[#ff5f00] hover:text-[#ff5f00]">
              {c.label}
            </a>
          ))}
          <p className="text-white/80">Grandslam I-Thum, A-40, Sector- 62, Noida, Uttar Pradesh (201309)</p>
          <div className="flex gap-[1.5vw] text-white/80 max-[64rem]:gap-5">
            {SOCIAL.map((s) => (
              <a key={s} href="#" className="transition-colors hover:text-[#ff5f00]">
                {s}
              </a>
            ))}
          </div>
        </div>

        <div className="flex gap-[8vw] max-[64rem]:gap-16">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-[0.8vw] max-[64rem]:gap-3">
              <h3 className="mb-[0.4vw] text-[1.4vw] font-medium max-[64rem]:text-lg">{section.title}</h3>
              {section.links.map((l) => (
                <a key={l} href="#" className="w-fit text-[1vw] text-white/80 transition-colors hover:text-[#ff5f00] max-[64rem]:text-base">
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="relative mt-[3vw] text-[0.85vw] text-white/60 max-[64rem]:mt-10 max-[64rem]:text-xs">© 2026 Hyperiux Immersion Labs. All rights reserved.</p>
    </footer>
  );
}
