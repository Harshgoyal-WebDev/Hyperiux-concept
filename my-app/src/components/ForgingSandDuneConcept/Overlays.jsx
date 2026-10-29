"use client";

import { forwardRef } from "react";
import { HERO, SECTIONS } from "./content";
import { ASSETS, RAIL } from "./config";

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

// The key pillars' pins: a dot in a breathing ring, both glowing like the
// beam (white-hot cores, orange falloff), and its label, kept over each rock by
// the scene (Pillars sets each button's transform / opacity every frame).
export function Pins({ pinRefs, onOpen }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          ref={(el) => (pinRefs.current[i] = el)}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={`${s.tag}: take a closer look`}
          className="group absolute left-0 top-0 -ml-5 -mt-5 size-10 cursor-pointer rounded-full opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          style={{ visibility: "hidden", pointerEvents: "none" }}
        >
          {/* a glowing ring that breathes (fsd-pin-breathe, globals.css) round a glowing dot */}
          <span className="absolute left-1/2 top-1/2 block size-[1.5vw] min-h-[22px] min-w-[22px] animate-[fsd-pin-breathe_2.6s_ease-in-out_infinite] rounded-full border-[1.5px] border-[#ffd9b0]" />
          <span className="absolute left-1/2 top-1/2 block size-[0.5vw] min-h-[8px] min-w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff1e0] shadow-[0_0_3px_1px_#ffc890,0_0_9px_3px_rgba(255,95,0,0.9),0_0_20px_6px_rgba(255,95,0,0.45)] transition-transform duration-300 group-hover:scale-125" />
          <span className="absolute left-full top-1/2 flex -translate-y-1/2 items-center gap-[0.5vw] whitespace-nowrap font-[family-name:var(--font-aeonikpro)] text-[0.72vw] uppercase tracking-[0.22em] text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] transition-colors group-hover:text-white max-[64rem]:gap-2 max-[64rem]:text-[1.6vw] max-[33.875rem]:text-[2.8vw]">
            <span className="text-[#FF5F00]">{s.n}</span>
            {s.tag}
          </span>
        </button>
      ))}
    </div>
  );
}

// A pillar's close-up copy: revealed once the camera has arrived (the rock
// is framed on the right; on a phone it sits above, the copy below), with
// the way back to the journey.
export function CloseUp({ index, shown, onClose }) {
  const s = SECTIONS[index];
  if (!s) return null;
  // staggered on the way in, all at once on the way out
  const after = (delay) => ({ transitionDelay: shown ? `${delay}ms` : "0ms" });
  const reveal = `transition-[opacity,transform,color,background-color] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={s.tag}
      className={`absolute inset-0 z-40 flex items-center px-[5vw] max-[33.875rem]:items-end max-[33.875rem]:pb-[12vh] ${shown ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-[60vw] bg-gradient-to-r from-black/55 via-black/25 to-transparent transition-opacity duration-700 max-[33.875rem]:inset-x-0 max-[33.875rem]:top-auto max-[33.875rem]:h-[70vh] max-[33.875rem]:w-full max-[33.875rem]:bg-gradient-to-t ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div className="relative flex max-w-[38vw] flex-col gap-[1.4vw] max-[64rem]:max-w-[70vw] max-[33.875rem]:max-w-full max-[33.875rem]:gap-4">
        <div className={`flex items-center gap-[0.8vw] max-[33.875rem]:gap-3 ${reveal}`} style={after(0)}>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FF5F00] px-3 py-1 font-[family-name:var(--font-aeonikpro)] text-[0.7vw] uppercase tracking-[0.2em] text-white max-[64rem]:text-[1.5vw] max-[33.875rem]:text-[2.8vw]">
            <span className="opacity-70">{s.n}</span>
            {s.tag}
          </span>
          <span className="font-[family-name:var(--font-aeonikpro)] text-[0.7vw] tracking-[0.2em] text-white/55 max-[64rem]:text-[1.5vw] max-[33.875rem]:text-[2.8vw]">
            {s.n} / {String(SECTIONS.length).padStart(2, "0")}
          </span>
        </div>
        <h2 className="font-[family-name:var(--font-aeonikpro)] text-[4.2vw] font-normal uppercase leading-[0.95] tracking-[-0.02em] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.3)] max-[64rem]:text-[7vw] max-[33.875rem]:text-[10vw]">
          {s.title.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <span
                className={`block transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] ${shown ? "translate-y-0" : "translate-y-[110%]"}`}
                style={after(80 + i * 90)}
              >
                {line}
              </span>
            </span>
          ))}
        </h2>
        <p
          className={`max-w-[26vw] font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase leading-[1.5] tracking-[0.08em] text-white/85 max-[64rem]:max-w-[60vw] max-[64rem]:text-[1.8vw] max-[33.875rem]:max-w-full max-[33.875rem]:text-[3.2vw] ${reveal}`}
          style={after(380)}
        >
          {s.body}
        </p>
        <button
          type="button"
          onClick={onClose}
          className={`mt-[0.8vw] flex w-fit cursor-pointer items-center gap-[0.8vw] rounded-full border border-white/50 px-[1.3vw] py-[0.6vw] font-[family-name:var(--font-aeonikpro)] text-[0.8vw] uppercase tracking-[0.18em] text-white hover:bg-white hover:text-black max-[64rem]:gap-2 max-[64rem]:px-4 max-[64rem]:py-2 max-[64rem]:text-[1.6vw] max-[33.875rem]:text-[3vw] ${reveal}`}
          style={after(500)}
        >
          <span aria-hidden="true">←</span>
          Back to the journey
          <span className="text-white/45 max-[64rem]:hidden">Esc</span>
        </button>
      </div>
    </div>
  );
}

export const ProgressRail = forwardRef(function ProgressRail({ fillRef, itemRefs, onJump }, ref) {
  return (
    <nav ref={ref} aria-label="Forging progress" className="absolute inset-x-[5vw] bottom-[3.2vh] z-30 max-[33.875rem]:inset-x-[6vw]">
      <div className="relative h-px w-full bg-white/20 transition-colors duration-500 group-data-[white=true]/journey:bg-black/15">
        <div ref={fillRef} className="absolute inset-0 origin-left scale-x-0 bg-[#FF5F00]" />
      </div>
      <ol className="relative mt-0 h-[3.4vh]">
        {RAIL.map((item, i) => (
          <li key={item.label} className="absolute top-0 -translate-x-1/2" style={{ left: `${item.at * 100}%` }}>
            <button
              type="button"
              ref={(el) => (itemRefs.current[i] = el)}
              onClick={() => onJump(item.at)}
              className="group flex -translate-y-[5px] cursor-pointer flex-col items-center gap-[0.7vh] text-white/45 transition-colors duration-300 data-[active=true]:text-white group-data-[white=true]/journey:text-black/40 group-data-[white=true]/journey:data-[active=true]:text-[#111]"
            >
              <span className="block size-[9px] rounded-full border border-current bg-[#0c0a09] transition-colors duration-300 group-data-[active=true]:border-[#FF5F00] group-data-[active=true]:bg-[#FF5F00]" />
              <span className="font-[family-name:var(--font-aeonikpro)] text-[0.72vw] uppercase tracking-[0.22em] max-[64rem]:text-[1.4vw] max-[33.875rem]:hidden">{item.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
});

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
