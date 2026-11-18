"use client";

import { forwardRef } from "react";
import { HERO, OASIS_LINES } from "./content";
import { ASSETS } from "./config";

// HTML layers above the canvas. Nothing here captures the pointer, so text
// stays selectable and links stay clickable.

export const HeroOverlay = forwardRef(function HeroOverlay(_, ref) {
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-[5vw] pb-[13vh] max-[33.875rem]:pb-[18vh]">
      <div className="max-w-[40vw] max-[64rem]:max-w-[70vw] max-[33.875rem]:max-w-full">
        <h1 className="font-[family-name:var(--font-aeonikpro)] text-[5.4vw] font-normal leading-[0.98] tracking-[-0.025em] text-white max-[64rem]:text-[8vw] max-[33.875rem]:text-[11vw]">
          {HERO.title.map((line) => (
            <span key={line} data-hero-line className="block pb-[0.08em]">
              {line}
            </span>
          ))}
        </h1>
        <p data-hero-body className="pointer-events-auto mt-[1.8vw] max-w-[30vw] font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.5] text-white/80 max-[64rem]:max-w-[60vw] max-[64rem]:text-[2.2vw] max-[33.875rem]:mt-5 max-[33.875rem]:max-w-full max-[33.875rem]:text-[4vw]">
          {HERO.body}
        </p>
      </div>
      <div data-hero-reveal data-hero-cue className="absolute bottom-[6vh] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 max-[33.875rem]:bottom-[9vh]">
        <span className="font-[family-name:var(--font-aeonikpro)] text-[0.75vw] uppercase tracking-[0.3em] text-white/60 max-[64rem]:text-[1.6vw] max-[33.875rem]:text-[2.8vw]">{HERO.cue}</span>
        <span className="block h-[5vh] w-px origin-top animate-pulse bg-gradient-to-b from-[#FF5F00] to-transparent" />
      </div>
    </div>
  );
});

// The oasis's lines of copy: quiet, editorial, one at a time over its
// stretch of the way (the journey sets each one's opacity and drift from
// the scroll). The environment stays the subject.
const PLACE = {
  low: "items-end justify-center pb-[17vh] text-center",
  left: "items-center justify-start text-left",
  right: "items-center justify-end text-right",
  center: "items-center justify-center text-center",
};
export function OasisCopy({ lineRefs }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {OASIS_LINES.map((l, i) => (
        <div
          key={l.id}
          ref={(el) => (lineRefs.current[i] = el)}
          className={`absolute inset-0 flex px-[7vw] max-[33.875rem]:items-end max-[33.875rem]:justify-center max-[33.875rem]:pb-[16vh] max-[33.875rem]:text-center ${PLACE[l.place]}`}
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <div className="max-w-[34vw] max-[64rem]:max-w-[64vw] max-[33.875rem]:max-w-full">
            <p data-split="heading" className="font-[family-name:var(--font-aeonikpro)] text-[2.7vw] font-light leading-[1.08] tracking-[-0.015em] text-white [text-shadow:0_2px_28px_rgba(30,12,0,0.45)] max-[64rem]:text-[4.6vw] max-[33.875rem]:text-[7.4vw]">
              {l.text}
            </p>
            {l.body && (
              <p
                data-split="body"
                className={`mt-[1.2vw] max-w-[26vw] font-[family-name:var(--font-aeonikpro)] text-[0.98vw] leading-[1.55] text-white/80 [text-shadow:0_1px_18px_rgba(30,12,0,0.55)] max-[64rem]:max-w-[56vw] max-[64rem]:text-[2vw] max-[33.875rem]:mt-3 max-[33.875rem]:max-w-full max-[33.875rem]:text-[3.8vw] ${
                  l.place === "right" ? "ml-auto" : l.place === "left" ? "" : "mx-auto"
                }`}
              >
                {l.body}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Shown only when the forging GLB can't be used. Nothing stands in for it:
// a substitute slab or logo would misrepresent the asset.
export function AssetBadge({ problem }) {
  if (!problem) return null;
  const text =
    problem.kind === "missing-file"
      ? `Forging asset missing: public${ASSETS.forgeGlb} was not found, so the slab is not rendered.`
      : `Forging asset incomplete: ${ASSETS.forgeGlb} lacks ${problem.parts.join(", ")}, so the slab is not rendered.`;
  return (
    <div className="pointer-events-none absolute left-[1.2vw] top-[5.6vw] z-40 max-w-[22vw] rounded-md border border-[#FF5F00]/50 bg-black/60 px-3 py-2 font-mono text-[10px] leading-snug text-[#ffb07a] backdrop-blur-sm max-[64rem]:top-20 max-[64rem]:max-w-[70vw]">
      {text}
    </div>
  );
}
