"use client";

import { useState } from "react";
import { useLenis } from "lenis/react";
import { NAV } from "./content";

// Fixed and transparent over the story; its ink follows the world (white
// in the dark, ink in the white: --cti-ink, set by CuriosityToImpact.jsx).

const mark = {
  WebkitMaskImage: "url(/hyperiux-icon-white.svg)",
  maskImage: "url(/hyperiux-icon-white.svg)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  backgroundColor: "currentColor",
};

export default function Header() {
  const lenis = useLenis();
  const [open, setOpen] = useState(false);
  const go = (e, to) => {
    e.preventDefault();
    setOpen(false);
    const el = document.querySelector(to);
    if (el) lenis ? lenis.scrollTo(el, { duration: 1.8 }) : el.scrollIntoView();
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 text-[var(--cti-ink)]">
      <div className="cti-container flex h-[76px] items-center justify-between">
        <a href="#top" onClick={(e) => go(e, "#top")} className="flex items-center gap-2.5" aria-label="Hyperiux, back to the start">
          <span className="block size-[22px]" style={mark} aria-hidden="true" />
          <span className="text-[15px] font-semibold tracking-[0.04em]">HYPERIUX.</span>
        </a>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)} className="cti-nav text-[13px]">
              {n.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="flex size-10 flex-col items-center justify-center gap-[5px] md:hidden"
          aria-expanded={open}
          aria-controls="cti-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          <span className={`block h-px w-5 bg-current transition-transform ${open ? "translate-y-[3px] rotate-45" : ""}`} />
          <span className={`block h-px w-5 bg-current transition-transform ${open ? "-translate-y-[3px] -rotate-45" : ""}`} />
        </button>
      </div>
      {open && (
        <nav id="cti-menu" aria-label="Main" className="cti-container flex flex-col gap-1 border-t border-[color:var(--cti-line)] bg-[var(--cti-bg)] py-6 md:hidden">
          {NAV.map((n) => (
            <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)} className="py-2 text-[22px] tracking-[-0.01em]">
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
