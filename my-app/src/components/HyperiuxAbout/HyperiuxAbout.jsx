"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import AboutHero from "./hero/AboutHero";
import Team from "./sections/Team";
import { AboutFooter, Expertise, Intro, Join } from "./sections/Sections";
import ClientsGrid from "@/components/HyperiuxHome/Home/ClientsGrid";
import { CTA } from "./content";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// The Hyperiux about page, in the forging-sand-dune-concept-v3's language:
// a short 3D hero at dusk (the monolith opening onto the forge's light),
// whiting out onto the white site — who we are, the team (after
// lusion.co/about), expertise, clients, join us — and the dark footer.
export default function HyperiuxAbout() {
  return (
    <main className="w-full">
      <Header />
      <AboutHero />
      <WhiteSite />
      <AboutFooter />
    </main>
  );
}

function WhiteSite() {
  const root = useRef(null);
  const lenis = useLenis();

  useGSAP(
    () => {
      const splits = [];
      gsap.utils.toArray("[data-split]").forEach((el) => {
        const split = new SplitText(el, { type: "lines", mask: "lines" });
        splits.push(split);
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 1.1,
          stagger: 0.08,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" },
        });
      });
      gsap.utils.toArray("[data-fade]").forEach((el) => {
        gsap.from(el, {
          y: 40,
          autoAlpha: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
        });
      });
      ScrollTrigger.batch("[data-fade-stagger]", {
        start: "top 90%",
        onEnter: (els) => gsap.fromTo(els, { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.09, ease: "power3.out", overwrite: true }),
        onLeaveBack: (els) => gsap.to(els, { y: 50, autoAlpha: 0, duration: 0.5, overwrite: true }),
      });
      gsap.set("[data-fade-stagger]", { autoAlpha: 0 });
      return () => splits.forEach((s) => s.revert());
    },
    { scope: root }
  );

  // the page grows as images and fonts settle: measure again
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        lenis?.resize();
        ScrollTrigger.refresh();
      });
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [lenis]);

  return (
    <div ref={root} data-about-white className="relative z-10 bg-white text-[#111]">
      <Intro />
      <Team />
      <Expertise />
      <ClientsGrid />
      <Join />
    </div>
  );
}

// True once the header sits over the white page (from the hero's whiteout
// on) and not over the footer: dark type and the black logo there.
function useOverLight() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const check = () => {
      const white = document.querySelector("[data-about-white]");
      const hero = document.querySelector("[data-about-hero]");
      const footer = document.querySelector("[data-about-footer]");
      if (!white) return setLight(false);
      const vh = window.innerHeight;
      const travel = Math.max((hero?.offsetHeight || vh) - vh, 1);
      // (the whiteout is most of the way in over the hero's last 7%)
      const whiteIn = (white.getBoundingClientRect().top - vh) / travel <= 0.07;
      const overFooter = footer && footer.getBoundingClientRect().top <= 80;
      setLight(whiteIn && !overFooter);
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

const NAV = [
  { label: "Home", href: "/forging-sand-dune-concept-v3" },
  { label: "About", href: "/about", current: true },
  { label: "Team", href: "#team" },
];

function Header() {
  const light = useOverLight();
  const lenis = useLenis();
  const go = (e, href) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const el = document.querySelector(href);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.8 });
    else el.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-[5vw] py-[2.2vw] transition-colors duration-500 max-[33.875rem]:px-[6vw] max-[33.875rem]:py-5 ${
        light ? "text-[#111]" : "text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.35)]"
      }`}
    >
      <Link href="/forging-sand-dune-concept-v3" className="pointer-events-auto flex items-center gap-[0.7vw] max-[33.875rem]:gap-2" aria-label="Hyperiux home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light ? "/hyperiux-icon-black.svg" : "/hyperiux-icon-white.svg"} alt="" className="h-[2.1vw] w-auto max-[64rem]:h-7" />
        <span className="font-[family-name:var(--font-aeonikpro)] text-[1.15vw] tracking-[0.06em] max-[64rem]:text-base">HYPERIUX</span>
      </Link>
      <nav className="pointer-events-auto flex items-center gap-[2vw] font-[family-name:var(--font-aeonikpro)] text-[0.95vw] max-[64rem]:text-sm max-[33.875rem]:gap-4">
        {NAV.map((n) =>
          n.href.startsWith("#") ? (
            <a key={n.label} href={n.href} onClick={(e) => go(e, n.href)} className="opacity-70 transition-opacity hover:opacity-100 max-[33.875rem]:hidden">
              {n.label}
            </a>
          ) : (
            <Link
              key={n.label}
              href={n.href}
              aria-current={n.current ? "page" : undefined}
              className={`flex items-center gap-2 transition-opacity hover:opacity-100 max-[33.875rem]:hidden ${n.current ? "opacity-100" : "opacity-70"}`}
            >
              {n.current && <span className="block size-[6px] rounded-full bg-[#FF5F00]" />}
              {n.label}
            </Link>
          )
        )}
        <a
          href={`mailto:${CTA.email}`}
          className={`rounded-full border px-[1.3vw] py-[0.55vw] transition-colors max-[64rem]:px-4 max-[64rem]:py-2 ${
            light ? "border-[#111]/40 hover:bg-[#111] hover:text-white" : "border-white/60 hover:bg-white hover:text-black"
          }`}
        >
          Start a Project
        </a>
      </nav>
    </header>
  );
}
