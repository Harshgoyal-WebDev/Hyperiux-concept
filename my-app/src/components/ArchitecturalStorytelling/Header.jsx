"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONTACT, FRAMES, NAV } from "./content";
import { useScrollTo } from "./scroll";
import { WORLD, onWorld } from "./world/store";

// The official mark and wordmark, as masks (public/…svg), so they take the
// theme's ink: white on the dark opening, black on the light page.
const mask = (url) => ({ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", backgroundColor: "currentColor" });

// The header goes light over the light half of the page (the world's turn
// to the light ground does it already; this keeps it right everywhere, as
// soon as the light half reaches under the header).
function useOverLight() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.querySelector("[data-light-half]");
      setLight(!!el && el.getBoundingClientRect().top <= 72);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  return light;
}

export function Header() {
  const scrollTo = useScrollTo();
  const light = useOverLight();
  const [open, setOpen] = useState(false);
  const go = (e, to) => {
    e.preventDefault();
    setOpen(false);
    scrollTo(to);
  };
  return (
    <header className={`fixed inset-x-0 top-0 z-50 bg-transparent text-[var(--bp-fg)] ${light ? "bp-light" : ""}`}>
      <div className="flex h-[72px] items-center justify-between px-[6vw]">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)]" aria-label="Hyperiux home">
          <span className="block size-7" style={mask("/hyperiux-icon-white.svg")} aria-hidden="true" />
          <span className="block h-[14px] w-[114px] max-sm:hidden" style={mask("/assets/icons/hyperiux-wordmark.svg")} aria-hidden="true" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-[2.4vw] text-[0.9rem] max-md:hidden">
          {NAV.map((n) => (
            <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)} className="relative py-1 transition-colors hover:text-[var(--bp-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)]">
              {n.label}
            </a>
          ))}
          <a
            href={`mailto:${CONTACT.email}?subject=${encodeURIComponent("Start a project")}`}
            className="flex items-center gap-2 border border-[var(--bp-accent)] px-4 py-2 transition-colors hover:bg-[var(--bp-accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bp-accent)]"
          >
            <span className="size-1.5 bg-[var(--bp-accent)]" aria-hidden="true" />
            Start a Project
          </a>
        </nav>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="bp-menu" className="bp-mono cursor-pointer text-[0.75rem] uppercase tracking-[0.18em] md:hidden">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="bp-menu" aria-label="Main" className="flex flex-col gap-1 border-t border-[var(--bp-guide)] bg-[var(--bp-bg)] px-[6vw] py-6 md:hidden">
          {NAV.map((n) => (
            <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)} className="py-2 text-[1.6rem]">
              {n.label}
            </a>
          ))}
          <a href={`mailto:${CONTACT.email}`} className="mt-4 text-[var(--bp-accent)]">
            Start a Project →
          </a>
        </nav>
      )}
    </header>
  );
}

// Which frame is on screen: the world's clock (frame n runs n − 1 → n).
const currentFrame = () => Math.min(20, Math.max(1, Math.floor(WORLD.reduced ? WORLD.T : WORLD.Ts) + 1));

// Chapter progress: twenty ticks down the right edge (the active one
// orange, wide, with its name); on a phone, a slim bar under the header.
export function ScrollProgress() {
  const scrollTo = useScrollTo();
  const light = useOverLight();
  const [n, setN] = useState(1);
  const [p, setP] = useState(0);
  useEffect(() => {
    return onWorld(() => {
      setN(currentFrame());
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.round((window.scrollY / max) * 500) / 500 : 0);
    });
  }, []);
  const f = FRAMES[n - 1];
  return (
    <div className={`text-[var(--bp-fg)] ${light ? "bp-light" : ""}`}>
      <div className="fixed inset-x-0 top-[72px] z-40 h-px bg-[var(--bp-faint)] md:hidden" aria-hidden="true">
        <div className="h-full origin-left bg-[var(--bp-accent)]" style={{ transform: `scaleX(${p})` }} />
      </div>
      <nav aria-label="Chapters" className="fixed right-[2.2vw] top-1/2 z-40 -translate-y-1/2 max-md:hidden">
        <p className="bp-mono absolute bottom-full right-0 mb-4 whitespace-nowrap text-right text-[0.68rem] uppercase tracking-[0.16em] text-[var(--bp-muted)]" aria-live="polite">
          <span className="text-[var(--bp-accent)]">{String(n).padStart(2, "0")}</span> {f.label}
        </p>
        <ol className="flex flex-col items-end gap-[7px]">
          {FRAMES.map((fr) => (
            <li key={fr.n}>
              <button
                type="button"
                onClick={() => scrollTo(fr.n)}
                aria-label={`${String(fr.n).padStart(2, "0")} ${fr.label}`}
                aria-current={fr.n === n ? "step" : undefined}
                className="group flex h-2 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-[var(--bp-accent)]"
              >
                <span className={`block h-px transition-all duration-300 ${fr.n === n ? "w-5 bg-[var(--bp-accent)]" : fr.n < n ? "w-2.5 bg-[var(--bp-fg)]" : "w-2.5 bg-[var(--bp-guide)] group-hover:bg-[var(--bp-fg)]"}`} />
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
