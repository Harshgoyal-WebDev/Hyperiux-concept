"use client";

import { ABOUT, HERO, JOURNEY } from "./content";

// Reduced-motion and no-WebGL version of the intro: the same story and
// copy as normal page sections, no pinned camera flight. With WebGL the
// hero shows a single still render of State 01 (passed in as `still`);
// without it, a CSS composition of the monolith with the real logo cut
// out of it via a mask.
export default function StaticJourney({ still = null }) {
  return (
    <div className="relative bg-[#0e0b09] text-white">
      <section className="relative h-screen overflow-hidden">
        {still || <CssMonolith />}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end px-[5vw] pb-[13vh]">
          <p className="mb-[1.6vw] font-[family-name:var(--font-aeonikpro)] text-[0.85vw] uppercase tracking-[0.32em] text-white/70 max-[64rem]:text-[1.8vw] max-[33.875rem]:mb-4 max-[33.875rem]:text-[3vw]">
            {HERO.eyebrow}
          </p>
          <h1 className="font-[family-name:var(--font-aeonikpro)] text-[5.4vw] font-normal leading-[0.98] tracking-[-0.025em] max-[64rem]:text-[8vw] max-[33.875rem]:text-[11vw]">
            {HERO.title.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </h1>
          <p className="pointer-events-auto mt-[1.8vw] max-w-[30vw] font-[family-name:var(--font-aeonikpro)] text-[1.1vw] leading-[1.5] text-white/80 max-[64rem]:max-w-[60vw] max-[64rem]:text-[2.2vw] max-[33.875rem]:max-w-full max-[33.875rem]:text-[4vw]">
            {HERO.body}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-[2vw] px-[7vw] py-[9vw] max-[64rem]:grid-cols-2 max-[33.875rem]:grid-cols-1 max-[33.875rem]:gap-10 max-[33.875rem]:py-20">
        {JOURNEY.map((item) => (
          <div key={item.n} className="border-t border-white/15 pt-[1.6vw] max-[33.875rem]:pt-5">
            <p className="font-[family-name:var(--font-orbitron)] text-[0.9vw] tracking-[0.2em] text-[#FF5F00] max-[64rem]:text-[2vw] max-[33.875rem]:text-[3.4vw]">{item.n}</p>
            <h2 className="mt-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[2vw] font-normal max-[64rem]:text-[4.4vw] max-[33.875rem]:text-[7vw]">{item.title}</h2>
            <p className="mt-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[1vw] leading-[1.5] text-white/70 max-[64rem]:text-[2.2vw] max-[33.875rem]:text-[4vw]">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="px-[7vw] pb-[10vw] max-[33.875rem]:pb-24">
        <p className="font-[family-name:var(--font-aeonikpro)] text-[1.25vw] max-[64rem]:text-[2.8vw] max-[33.875rem]:text-[4.6vw]">
          About <span className="text-[#FF5F00]">Hyperiux</span>
        </p>
        <h2 className="mt-[1.4vw] max-w-[50vw] font-[family-name:var(--font-aeonikpro)] text-[3vw] font-normal leading-[1.08] max-[64rem]:max-w-none max-[64rem]:text-[5.4vw] max-[33.875rem]:text-[8vw]">
          {ABOUT.title}
        </h2>
        <p className="mt-[1.8vw] max-w-[46vw] font-[family-name:var(--font-aeonikpro)] text-[1.12vw] leading-[1.6] text-white/80 max-[64rem]:max-w-none max-[64rem]:text-[2.3vw] max-[33.875rem]:text-[4vw]">
          {ABOUT.body}
        </p>
      </section>

      {/* dark → white into the site */}
      <div className="h-[60vh] bg-[linear-gradient(180deg,#0e0b09_0%,#d8c2ae_55%,#ffffff_100%)]" />
    </div>
  );
}

function CssMonolith() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#232a36_0%,#59595e_45%,#e48e4f_68%,#9a5430_70%,#5d311c_100%)]">
      <div className="absolute bottom-[26%] left-1/2 h-[64vh] w-[52vh] -translate-x-1/2 bg-[#15110f] [mask-composite:exclude] [mask-image:url(/hyperiux-icon-black.svg),linear-gradient(#000_0_0)] [mask-position:center_45%,center] [mask-repeat:no-repeat] [mask-size:78%,100%] [-webkit-mask-composite:xor]" />
      <div className="absolute bottom-0 left-1/2 h-[26%] w-[2px] -translate-x-1/2 bg-[#FF5F00] shadow-[0_0_12px_#FF5F00]" />
    </div>
  );
}
