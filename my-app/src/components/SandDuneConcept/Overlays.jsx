"use client";

import { forwardRef } from "react";
import { ABOUT, HERO, JOURNEY } from "./content";
import { RAIL } from "./config";

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

export function JourneyCaptions({ captionRefs }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {JOURNEY.map((item, i) => (
        <div
          key={item.n}
          ref={(el) => (captionRefs.current[i] = el)}
          className={`invisible absolute top-1/2 w-[26vw] -translate-y-1/2 opacity-0 max-[64rem]:w-[60vw] max-[33.875rem]:top-auto max-[33.875rem]:bottom-[22vh] max-[33.875rem]:w-[86vw] max-[33.875rem]:translate-y-0 ${
            i % 2 === 0 ? "right-[7vw] max-[33.875rem]:right-[7vw]" : "left-[7vw] max-[33.875rem]:left-[7vw]"
          }`}
        >
          <p className="font-[family-name:var(--font-orbitron)] text-[0.9vw] tracking-[0.2em] text-[#FF5F00] max-[64rem]:text-[2vw] max-[33.875rem]:text-[3.4vw]">{item.n}</p>
          <h2 className="mt-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[2.6vw] font-normal leading-[1.05] text-white max-[64rem]:text-[5vw] max-[33.875rem]:mt-2 max-[33.875rem]:text-[8vw]">
            {item.title}
          </h2>
          <p className="mt-[0.9vw] font-[family-name:var(--font-aeonikpro)] text-[1.05vw] leading-[1.5] text-white/75 max-[64rem]:text-[2.2vw] max-[33.875rem]:mt-3 max-[33.875rem]:text-[4vw]">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export const AboutOverlay = forwardRef(function AboutOverlay({ paragraphRef }, ref) {
  return (
    <div ref={ref} className="pointer-events-none invisible absolute inset-0 z-20 opacity-0">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,8,7,0.62)_0%,rgba(10,8,7,0.35)_38%,rgba(10,8,7,0)_62%)] max-[33.875rem]:bg-[linear-gradient(180deg,rgba(10,8,7,0.75)_0%,rgba(10,8,7,0.4)_60%,rgba(10,8,7,0)_85%)]" />
      <div className="relative flex h-full flex-col justify-center px-[7vw] max-[33.875rem]:justify-start max-[33.875rem]:pt-[14vh]">
        <p className="font-[family-name:var(--font-aeonikpro)] text-[1.25vw] text-white max-[64rem]:text-[2.8vw] max-[33.875rem]:text-[4.6vw]">
          About <span className="text-[#FF5F00]">Hyperiux</span>
        </p>
        <h2 className="mt-[1.4vw] max-w-[38vw] font-[family-name:var(--font-aeonikpro)] text-[3vw] font-normal leading-[1.08] tracking-[-0.015em] text-white max-[64rem]:max-w-[80vw] max-[64rem]:text-[5.4vw] max-[33.875rem]:mt-3 max-[33.875rem]:max-w-full max-[33.875rem]:text-[8vw]">
          {ABOUT.title}
        </h2>
        <p
          ref={paragraphRef}
          className="pointer-events-auto mt-[1.8vw] max-w-[34vw] font-[family-name:var(--font-aeonikpro)] text-[1.12vw] leading-[1.6] text-white/80 max-[64rem]:max-w-[80vw] max-[64rem]:text-[2.3vw] max-[33.875rem]:mt-4 max-[33.875rem]:max-w-full max-[33.875rem]:text-[3.6vw]"
        >
          {ABOUT.body}
        </p>
      </div>
    </div>
  );
});

export const ProgressRail = forwardRef(function ProgressRail({ fillRef, itemRefs, onJump }, ref) {
  return (
    <nav ref={ref} aria-label="Journey progress" className="absolute inset-x-[5vw] bottom-[3.2vh] z-30 max-[33.875rem]:inset-x-[6vw]">
      <div className="relative h-px w-full bg-white/20">
        <div ref={fillRef} className="absolute inset-0 origin-left scale-x-0 bg-[#FF5F00]" />
      </div>
      <ol className="relative mt-0 h-[3.4vh]">
        {RAIL.map((item, i) => (
          <li key={item.label} className="absolute top-0 -translate-x-1/2" style={{ left: `${item.at * 100}%` }}>
            <button
              type="button"
              ref={(el) => (itemRefs.current[i] = el)}
              onClick={() => onJump(item.at)}
              className="group flex -translate-y-[5px] cursor-pointer flex-col items-center gap-[0.7vh] text-white/45 transition-colors duration-300 data-[active=true]:text-white"
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

export function PlaceholderBadge({ asset }) {
  if (!asset || asset.kind === "glb") return null;
  const text =
    asset.kind === "placeholder"
      ? "Placeholder monolith extruded from hyperiux-icon.svg. The Blender asset public/models/hyperiux-monolith.glb has not been delivered."
      : "Monolith asset missing: public/models/hyperiux-monolith.glb (placeholder disabled)";
  return (
    <div className="pointer-events-none absolute left-[1.2vw] top-[5.6vw] z-40 max-w-[22vw] rounded-md border border-[#FF5F00]/50 bg-black/60 px-3 py-2 font-mono text-[10px] leading-snug text-[#ffb07a] backdrop-blur-sm max-[64rem]:top-20 max-[64rem]:max-w-[70vw]">
      {text}
    </div>
  );
}
