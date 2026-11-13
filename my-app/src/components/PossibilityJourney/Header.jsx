"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { Mark, Wordmark } from "../OriginForge/Brand";
import { CONTACT, NAV } from "./content";

// Minimal navigation over the whole page: dark ink over the light
// architecture and the page. Over the journey it floats on nothing; once the
// page has taken over it settles onto a warm-white bar. (Written to the
// element directly: scrolling never re-renders React.)
export default function Header({ theme = "dark" }) {
  const lenis = useLenis();
  const el = useRef();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = document.getElementById("pj-site")?.getBoundingClientRect().top <= 1;
      el.current?.toggleAttribute("data-solid", !!past);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("pj-menu-open", open);
    return () => document.documentElement.classList.remove("pj-menu-open");
  }, [open]);

  // In-page links. A long jump through the pinned journey is made at once
  // (the world catches up behind the threshold's white).
  const go = (e, to) => {
    e.preventDefault();
    setOpen(false);
    const target = document.querySelector(to);
    if (!target) return;
    const j = document.getElementById("pj-journey");
    const inJourney = j && j.getBoundingClientRect().bottom > window.innerHeight;
    if (lenis) lenis.scrollTo(target, { immediate: inJourney, duration: inJourney ? 0 : 1.3 });
    else target.scrollIntoView({ behavior: inJourney ? "auto" : "smooth" });
  };

  return (
    <header ref={el} className="pj-header">
      <a href="#top" className="pj-header__brand" onClick={(e) => go(e, "#top")} aria-label="Hyperiux, back to top">
        <Mark className="pj-header__mark" accent />
        <Wordmark className="pj-header__word" />
      </a>
      <nav className="pj-header__nav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)} className="pj-link">
            {n.label}
          </a>
        ))}
      </nav>
      <div className="pj-header__end">
        <a href="#pj-site" className="pj-header__skip" onClick={(e) => go(e, "#pj-site")}>
          Skip intro
        </a>
        <a href={theme === "light" ? "/from-possibility" : "/from-possibility/light"} className="pj-header__theme" aria-label={theme === "light" ? "Switch to the dark version" : "Switch to the light version"}>
          <span className="pj-header__theme-dot" aria-hidden />
          {theme === "light" ? "Dark" : "Light"}
        </a>
        <a href={CONTACT.mailto} className="pj-pill pj-pill--ghost pj-header__cta">
          Start a project
        </a>
        <button type="button" className="pj-header__menu" aria-expanded={open} aria-controls="pj-menu" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="pj-header__burger" aria-hidden />
        </button>
      </div>
      <div id="pj-menu" className="pj-menu" data-open={open || undefined} hidden={!open}>
        <nav aria-label="Menu">
          {NAV.map((n) => (
            <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)}>
              {n.label}
            </a>
          ))}
        </nav>
        <a href={CONTACT.mailto} className="pj-pill pj-pill--solid">
          Start a project
        </a>
      </div>
    </header>
  );
}
