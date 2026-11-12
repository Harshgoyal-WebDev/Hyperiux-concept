// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OrdButton, OrdMark } from "./Buttons";
import { onIntroDone } from "./Animations/intro";
import { prefersReducedMotion } from "./Animations/reducedMotion";
import { useElementHeightKey } from "./Animations/useResizeKey";
import ScrambleLinkButton from "./effects/scramble-link-button";
import { LINKS, ROUTES } from "./nav";
import MobileMenu from "./MobileMenu";
import { THEME } from "../theme";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const Header = () => {
  const headerRef = useRef<HTMLElement>(null);
  const footerKey = useElementHeightKey("#ord-footer");
  const pathname = usePathname();

  useGSAP(
    () =>
      onIntroDone(() => {
        if (prefersReducedMotion()) return;
        // fromTo, not from: if this runs twice (React dev remounts) a from() would animate to a half-way value
        gsap.fromTo(headerRef.current, { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.3, ease: "expo.out", delay: 0.4 });
      }),
    [],
  );

  useGSAP(() => {
    // Declared first: a trigger can toggle while it is being created (a page that opens mid-section)
    const tone: ScrollTrigger[] = [];
    const syncTone = () => {
      const light = tone.some((t) => t.isActive);
      headerRef.current?.toggleAttribute("data-light", light);
      gsap.to(headerRef.current, {
        color: light ? THEME.ink : THEME.bone,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    };
    gsap.utils.toArray<HTMLElement>("[data-ord-light]").forEach((el) =>
      tone.push(ScrollTrigger.create({ trigger: el, start: "top 6%", end: "bottom 6%", onToggle: syncTone })),
    );

    const frame = requestAnimationFrame(() => {
      const lightNow = gsap.utils.toArray<HTMLElement>("[data-ord-light]").some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= window.innerHeight * 0.06 && r.bottom >= window.innerHeight * 0.06;
      });
      gsap.set(headerRef.current, { color: lightNow ? THEME.ink : THEME.bone });
      headerRef.current?.toggleAttribute("data-light", lightNow);
    });

    let hidden = false;
    const progress = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        // Past the top 30% of the hero the bar frosts, so links stay readable over any section
        headerRef.current?.toggleAttribute("data-scrolled", self.scroll() > window.innerHeight * 0.3);
        const hide = self.direction === 1 && self.scroll() > window.innerHeight * 0.1;
        if (hide === hidden) return;
        hidden = hide;
        gsap.to(headerRef.current, {
          yPercent: hide ? -100 : 0,
          duration: prefersReducedMotion() ? 0 : 0.7,
          ease: "expo.out",
          overwrite: "auto",
        });
      },
    });

    return () => {
      tone.forEach((t) => t.kill());
      progress.kill();
      cancelAnimationFrame(frame);
      gsap.set(headerRef.current, { yPercent: 0 });
    };
  }, { dependencies: [footerKey, pathname], revertOnUpdate: true });

  return (
    <div data-ord-hide>
      <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 flex items-center justify-between ord-container py-[1.6vw] text-(--ord-bone) transition-[background-color,backdrop-filter] duration-500 ease-out data-[scrolled]:bg-(--ord-ink)/45 data-[scrolled]:backdrop-blur-lg data-[scrolled]:data-[light]:bg-(--ord-bone)/55 max-lg:py-[2.4vw] max-md:py-[4.4vw]">
        <a href={ROUTES.home} className="ord-draw group flex w-[20%] items-center gap-3 max-lg:w-auto">
          <OrdMark />
          <span className="text-30 font-medium">Ordin</span>
        </a>
        <nav className="flex items-center gap-10 max-lg:hidden">
          {LINKS.map((l) => (
            <ScrambleLinkButton
              key={l.label}
              href={l.href}
              text={l.label}
              hoverColor={THEME.primaryLight}
              showLine
              className="text-22 opacity-70 hover:opacity-100"
            />
          ))}
        </nav>
        <div className="flex w-[20%] items-center justify-end gap-3 max-lg:w-auto">
          <span className="max-md:hidden">
            <OrdButton href={ROUTES.pricing}>Get Started</OrdButton>
          </span>
          <MobileMenu />
        </div>
      </header>
    </div>
  );
};

export default Header;
