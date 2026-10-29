"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { CTA, SOLUTIONS } from "./content";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

// The real 2D site the journey resolves into.
export default function WhiteWebsite() {
  const root = useRef(null);

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
      ScrollTrigger.refresh();
      return () => splits.forEach((s) => s.revert());
    },
    { scope: root }
  );

  return (
    <div ref={root} data-white-site className="relative z-10 bg-white text-[#111]">
      <section className="relative px-[7vw] pb-[10vw] pt-[16vh] max-[33.875rem]:pt-[14vh]">
        <p data-fade className="flex items-center gap-3 font-[family-name:var(--font-aeonikpro)] text-[1vw] uppercase tracking-[0.28em] text-[#111]/60 max-[64rem]:text-[2vw] max-[33.875rem]:text-[3.4vw]">
          <span className="block size-[9px] rounded-full bg-[#FF5F00]" />
          {SOLUTIONS.eyebrow}
        </p>
        <h2 data-split className="mt-[2vw] font-[family-name:var(--font-aeonikpro)] text-[5vw] font-normal leading-[1.02] tracking-[-0.025em] max-[64rem]:text-[8vw] max-[33.875rem]:mt-5 max-[33.875rem]:text-[10.5vw]">
          {SOLUTIONS.title[0]}
          <br />
          <span className="text-[#FF5F00]">{SOLUTIONS.title[1]}</span>
        </h2>

        <div className="mt-[6vw] grid grid-cols-2 gap-[1.6vw] max-[33.875rem]:mt-10 max-[33.875rem]:grid-cols-1 max-[33.875rem]:gap-4">
          {SOLUTIONS.items.map((item, i) => (
            <article
              key={item.title}
              data-fade
              className="flex min-h-[19vw] flex-col justify-between rounded-(--border-radius) bg-[#f3f3f1] p-[2.4vw] max-[64rem]:min-h-[34vw] max-[33.875rem]:min-h-0 max-[33.875rem]:gap-8 max-[33.875rem]:p-6"
            >
              <div className="flex items-start justify-between gap-6">
                <h3 className="font-[family-name:var(--font-aeonikpro)] text-[2.4vw] font-normal leading-tight max-[64rem]:text-[4vw] max-[33.875rem]:text-[7vw]">{item.title}</h3>
                <span className="font-[family-name:var(--font-orbitron)] text-[0.85vw] text-[#FF5F00] max-[64rem]:text-[1.8vw] max-[33.875rem]:text-[3.2vw]">0{i + 1}</span>
              </div>
              <div>
                <p className="max-w-[30vw] font-[family-name:var(--font-aeonikpro)] text-[1.05vw] leading-[1.55] text-[#111]/70 max-[64rem]:max-w-none max-[64rem]:text-[2.1vw] max-[33.875rem]:text-[4vw]">
                  {item.body}
                </p>
                <ul className="mt-[1.4vw] flex flex-wrap gap-[0.5vw] max-[33.875rem]:mt-4 max-[33.875rem]:gap-2">
                  {item.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full border border-[#111]/15 px-[0.9vw] py-[0.35vw] font-[family-name:var(--font-aeonikpro)] text-[0.8vw] text-[#111]/70 max-[64rem]:px-3 max-[64rem]:py-1 max-[64rem]:text-[1.7vw] max-[33.875rem]:text-[3.2vw]"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-[7vw] pb-[8vw] pt-[4vw] max-[33.875rem]:pb-20">
        <div className="flex items-end justify-between gap-[4vw] border-t border-[#111]/10 pt-[5vw] max-[64rem]:flex-col max-[64rem]:items-start max-[33.875rem]:pt-12">
          <h2 data-split className="max-w-[48vw] font-[family-name:var(--font-aeonikpro)] text-[4.4vw] font-normal leading-[1.04] tracking-[-0.02em] max-[64rem]:max-w-none max-[64rem]:text-[7vw] max-[33.875rem]:text-[10vw]">
            {CTA.title}
          </h2>
          <div data-fade className="flex flex-col items-start gap-[0.8vw] font-[family-name:var(--font-aeonikpro)] text-[1.2vw] max-[64rem]:text-[2.4vw] max-[33.875rem]:gap-3 max-[33.875rem]:text-[4.4vw]">
            <a href={`mailto:${CTA.email}`} className="group inline-flex items-center gap-3 rounded-full bg-[#FF5F00] px-[2vw] py-[0.9vw] text-white transition-colors hover:bg-[#111] max-[64rem]:px-6 max-[64rem]:py-3">
              Start a Project
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a href={`mailto:${CTA.email}`} className="text-[#111]/80 hover:text-[#FF5F00]">
              {CTA.email}
            </a>
            <a href={`tel:${CTA.phone.replace(/\s/g, "")}`} className="text-[#111]/80 hover:text-[#FF5F00]">
              {CTA.phone}
            </a>
            <p className="max-w-[22vw] text-[0.85vw] leading-[1.5] text-[#111]/50 max-[64rem]:max-w-none max-[64rem]:text-[1.8vw] max-[33.875rem]:text-[3.4vw]">{CTA.address}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
