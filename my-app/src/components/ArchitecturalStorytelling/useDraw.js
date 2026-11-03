"use client";

import { useLayoutEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Draws every [data-scene] inside `ref` as it scrolls through the screen:
// its framing rules and its masked images — scrubbed, so scrolling back
// undraws it — fills headlines in word by word, and brings any [data-rise]
// copy in (played once, as it arrives). With
// `reduced` nothing animates (the page's bp-static class shows it drawn).
export function useDraw(ref, reduced, deps = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const ctx = gsap.context(() => {
      root.querySelectorAll("[data-scene]").forEach((scene) => {
        const lines = scene.querySelectorAll("[data-draw]");
        const fades = scene.querySelectorAll("[data-fade]");
        const reveals = scene.querySelectorAll(".bp-reveal");
        const grows = scene.querySelectorAll("[data-grow]");
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: scene, start: "top 85%", end: "center 50%", scrub: 0.8 },
        });
        if (lines.length) tl.fromTo(lines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, stagger: 1 / lines.length }, 0);
        if (fades.length) tl.fromTo(fades, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.6 / fades.length }, 0.3);
        if (grows.length) tl.fromTo(grows, { scaleX: (i, el) => (el.dataset.grow === "x" ? 0 : 1), scaleY: (i, el) => (el.dataset.grow === "y" ? 0 : 1) }, { scaleX: 1, scaleY: 1, duration: 0.7, stagger: 0.5 / grows.length }, 0);
        if (reveals.length) tl.fromTo(reveals, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, stagger: 0.15, ease: "power2.out" }, 0.1);
      });
      // headlines: their words fill in from grey to ink as they rise
      root.querySelectorAll("[data-words]").forEach((el) => {
        gsap.fromTo(
          el.querySelectorAll("[data-word]"),
          { opacity: 0.14 },
          { opacity: 1, ease: "none", stagger: 0.12, scrollTrigger: { trigger: el, start: "top 92%", end: "top 62%", scrub: 0.8 } }
        );
      });
      // copy: rises in once, as it arrives (not scrubbed: reading should
      // never wait on the scroll)
      root.querySelectorAll("[data-rise]").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 28, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" } }
        );
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);
}
