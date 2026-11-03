"use client";

import { useEffect, useRef } from "react";
import { FRAMES } from "./content";
import { FrameText } from "./FrameText";
import { onWorld, smooth, win } from "./world/store";

// The opening, frames 01–09: a tall stretch of page with one sticky screen.
// The drawing is the world behind it (world/): the core cube drawing itself,
// its construction, the camera's dolly into the mark, the core, its
// structure, the five connections, the journey through the city, and the
// turn from the dark ground to the light one into the four disciplines.
// Here, only each frame's copy, brought in and out by world time — the same
// clock as the drawing, so they never drift apart, scrolling either way.
const OPENING = FRAMES.slice(0, 9);

export default function OpeningStage({ reduced }) {
  const ref = useRef(null);

  useEffect(() => {
    if (reduced) return;
    const blocks = [...ref.current.querySelectorAll("[data-frame-text]")];
    let last = [];
    return onWorld(({ W }) => {
      blocks.forEach((el, i) => {
        const n = i + 1;
        const a = n === 1 ? 1 - smooth(0.74, 0.94, W) : n === 9 ? win(W, 8.05, 8.3) : win(W, n - 1.02, n - 0.8, n - 0.24, n - 0.05);
        if (Math.abs(a - (last[i] ?? -1)) < 0.002) return;
        last[i] = a;
        const y = (1 - a) * 26 * (W < n - 0.5 ? 1 : -1);
        el.style.opacity = String(a);
        el.style.visibility = a < 0.01 ? "hidden" : "visible";
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
    });
  }, [reduced]);

  if (reduced) {
    return (
      <section ref={ref} aria-label="Introduction" className="relative h-[100svh]">
        <FrameText frame={OPENING[0]} first />
      </section>
    );
  }
  return (
    <section ref={ref} data-world-opening="" aria-label="The blueprint" className="relative h-[1000vh] max-md:h-[820vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {OPENING.map((f, i) => (
          <FrameText key={f.n} frame={f} first={i === 0} />
        ))}
      </div>
    </section>
  );
}
