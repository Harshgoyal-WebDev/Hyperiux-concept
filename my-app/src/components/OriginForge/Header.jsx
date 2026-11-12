"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { Mark, Wordmark } from "./Brand";
import { CONTACT, NAV } from "./content";
import { TONE_EVENT } from "./env";

// Minimal navigation over the whole page. Light-on-dark over the forge,
// dark-on-light over the stair hall and the white site: the experience
// reports its tone by event; light surfaces of the page (data-surface=
// "light") are detected on scroll. The tone is written to the element
// directly, so scrolling never re-renders React.
export default function Header({ experience = true }) {
  const lenis = useLenis();
  const el = useRef();
  const [open, setOpen] = useState(false);
  const expTone = useRef("dark");

  useEffect(() => {
    let surfaceLight = false;
    const apply = () => {
      const light = surfaceLight || expTone.current === "light";
      el.current?.setAttribute("data-tone", light ? "light" : "dark");
      const past = document.getElementById("of-site")?.getBoundingClientRect().top <= 1;
      el.current?.toggleAttribute("data-past-intro", !!past);
    };
    const onTone = (e) => {
      expTone.current = e.detail;
      apply();
    };
    const onScroll = () => {
      const y = 36;
      surfaceLight = [...document.querySelectorAll("[data-surface='light']")].some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= y && r.bottom > y;
      });
      apply();
    };
    window.addEventListener(TONE_EVENT, onTone);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener(TONE_EVENT, onTone);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // In-page links: a long jump through the pinned film is made instantly
  // (the film then catches up behind the white transition).
  const go = (e, to) => {
    e.preventDefault();
    setOpen(false);
    const target = document.querySelector(to);
    if (!target) return;
    const exp = document.getElementById("of-experience");
    const inFilm = exp && exp.getBoundingClientRect().bottom > window.innerHeight;
    if (lenis) lenis.scrollTo(target, { immediate: inFilm, duration: inFilm ? 0 : 1.4, offset: 0 });
    else target.scrollIntoView({ behavior: inFilm ? "auto" : "smooth" });
  };

  return (
    <header ref={el} className="of-header" data-tone="dark">
      <a href="#top" className="of-header__brand" onClick={(e) => go(e, "#top")} aria-label="Hyperiux, back to top">
        <Mark className="of-header__mark" accent />
        <Wordmark className="of-header__word" />
      </a>
      <nav className="of-header__nav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)} className="of-link">
            {n.label}
          </a>
        ))}
      </nav>
      <div className="of-header__actions">
        {experience && (
          <a href="#of-site" className="of-header__skip" onClick={(e) => go(e, "#of-site")}>
            Skip intro
          </a>
        )}
        <a href={CONTACT.mailto} className="of-pill">
          Start a project
        </a>
        <button type="button" className="of-header__menu" aria-expanded={open} aria-controls="of-menu" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">Menu</span>
          <span className="of-header__menu-bar" />
          <span className="of-header__menu-bar" />
        </button>
      </div>
      <div id="of-menu" className="of-menu" data-open={open || undefined} hidden={!open}>
        {NAV.map((n) => (
          <a key={n.to} href={n.to} onClick={(e) => go(e, n.to)}>
            {n.label}
          </a>
        ))}
        <a href={CONTACT.mailto} className="of-menu__cta">
          Start a project →
        </a>
      </div>
    </header>
  );
}
