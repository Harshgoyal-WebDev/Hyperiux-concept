"use client";

import { forwardRef } from "react";
import { GARDEN_SECTIONS, HERO } from "./content";
import { ASSETS } from "./config";

// HTML layers above the canvas. Nothing here captures the pointer except
// the rail buttons, so text stays selectable and links stay clickable.

export const HeroOverlay = forwardRef(function HeroOverlay(_, ref) {
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-[5vw] pb-[13vh] max-[33.875rem]:pb-[18vh]">
      <div className="max-w-[40vw] max-[64rem]:max-w-[70vw] max-[33.875rem]:max-w-full">
        <p data-hero-reveal className="mb-[1.6vw] font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase tracking-[0.32em] text-white/70 max-[64rem]:text-[1.8vw] max-[33.875rem]:mb-4 max-[33.875rem]:text-[3vw]">
          {HERO.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-aeonikpro)] text-[5.4vw] font-normal leading-[0.98] tracking-[-0.025em] text-white max-[64rem]:text-[8vw] max-[33.875rem]:text-[11vw]">
          {HERO.title.map((line) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <span data-hero-line className="block">
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p data-hero-reveal className="pointer-events-auto mt-[1.8vw] max-w-[30vw] font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.5] text-white/80 max-[64rem]:max-w-[60vw] max-[64rem]:text-[2.2vw] max-[33.875rem]:mt-5 max-[33.875rem]:max-w-full max-[33.875rem]:text-[4vw]">
          {HERO.body}
        </p>
      </div>
      <div data-hero-reveal className="absolute bottom-[6vh] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 max-[33.875rem]:bottom-[9vh]">
        <span className="font-[family-name:var(--font-aeonikpro)] text-[0.75vw] uppercase tracking-[0.3em] text-white/60 max-[64rem]:text-[1.6vw] max-[33.875rem]:text-[2.8vw]">{HERO.cue}</span>
        <span className="block h-[5vh] w-px origin-top animate-pulse bg-gradient-to-b from-[#FF5F00] to-transparent" />
      </div>
    </div>
  );
});

// The garden's section copy: one block per section, faded and lifted in and
// out by the journey (ForgingConcept sets each block's opacity / transform
// from the scroll), laid out round the composed shot — under the mark, to
// the left of the cube, under the cloud, centred under the ring.
const LAYOUT = {
  bottom: "items-end justify-start pb-[16vh]",
  left: "items-center justify-start",
  center: "items-end justify-center pb-[14vh] text-center",
};
export function GardenCopy({ blockRefs }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {GARDEN_SECTIONS.map((s, i) => (
        <div
          key={s.id}
          ref={(el) => (blockRefs.current[i] = el)}
          className={`absolute inset-0 flex px-[5vw] opacity-0 max-[33.875rem]:items-end max-[33.875rem]:pb-[16vh] ${LAYOUT[s.layout]}`}
          style={{ visibility: "hidden" }}
        >
          <div className={`flex max-w-[44vw] flex-col gap-[1.4vw] max-[64rem]:max-w-[80vw] max-[33.875rem]:max-w-full max-[33.875rem]:gap-4 ${s.layout === "center" ? "items-center" : ""}`}>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FF5F00] px-3 py-1 font-[family-name:var(--font-aeonikpro)] text-[0.7vw] uppercase tracking-[0.2em] text-white max-[64rem]:text-[1.5vw] max-[33.875rem]:text-[2.8vw]">
              <span className="opacity-70">{s.n}</span>
              {s.tag}
            </span>
            <h2 className="font-[family-name:var(--font-aeonikpro)] text-[4.6vw] font-normal uppercase leading-[0.95] tracking-[-0.02em] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.25)] max-[64rem]:text-[7vw] max-[33.875rem]:text-[10vw]">
              {s.title.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="max-w-[26vw] font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase leading-[1.5] tracking-[0.08em] text-white/85 max-[64rem]:max-w-[60vw] max-[64rem]:text-[1.8vw] max-[33.875rem]:max-w-full max-[33.875rem]:text-[3.2vw]">
              {s.body}
            </p>
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
