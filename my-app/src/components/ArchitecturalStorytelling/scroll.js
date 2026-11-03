"use client";

import { useCallback } from "react";
import { useLenis } from "lenis/react";
import { FRAMES } from "./content";
import { yOf } from "./world/store";

// The page's y for a frame (1–20): the opening's frames are moments of the
// world's clock (their middle), the sections are elements.
export function frameY(n) {
  if (n <= 1) return 0;
  if (n <= 9) return yOf(n - 0.4);
  const el = document.getElementById(FRAMES[n - 1].id);
  return el ? el.getBoundingClientRect().top + window.scrollY : 0;
}

// Smooth scroll to a frame number, an anchor ("#work") or a y. Services
// (#capabilities) is the opening's frame 09.
export function useScrollTo() {
  const lenis = useLenis();
  return useCallback(
    (target) => {
      let y = target;
      if (target === "#capabilities") y = frameY(9);
      else if (typeof target === "string") {
        const el = document.querySelector(target);
        if (!el) return;
        y = el.getBoundingClientRect().top + window.scrollY;
      } else if (typeof target === "number" && target >= 1 && target <= 20 && Number.isInteger(target)) y = frameY(target);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduced ? 0 : Math.min(1 + Math.abs(y - window.scrollY) / (window.innerHeight * 8), 2.6);
      if (lenis) lenis.scrollTo(y, { duration, immediate: reduced, force: true });
      else window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    },
    [lenis]
  );
}
