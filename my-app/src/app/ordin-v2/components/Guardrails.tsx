// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isMobile, prefersReducedMotion } from "./Animations/reducedMotion";
import { useResizeKey } from "./Animations/useResizeKey";
import LineReveal from "./Animations/LineReveal";
import { THEME, alpha } from "../theme";
import { pinnedHeight } from "../config";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const POLICIES = [
  { name: "Scoped permissions", body: "Each agent touches only the tables, tools and inboxes its brief names." },
  { name: "All-or-nothing runs", body: "A job settles in full or rolls back. No half-paid batches." },
  { name: "Spend ceilings", body: "Limits live on the action itself, not in a prompt someone can talk around." },
  { name: "Human sign-off", body: "Anything outbound waits in a queue until a person approves it." },
  { name: "Full audit trail", body: "Every token, tool call and decision is signed and replayable." },
];


const Guardrails = () => {
  const root = useRef<HTMLElement>(null);
  const resizeKey = useResizeKey();

  useGSAP(
    () => {
      const section = root.current;
      const stage = section?.querySelector<HTMLElement>("[data-ord-stage]");
      const rings = section?.querySelector<HTMLElement>("[data-ord-rings]");
      if (!section || !stage || !rings) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-ord-policy]", section);
      const svg = section.querySelector<SVGSVGElement>("[data-ord-guard-wires]");
      const wires = gsap.utils.toArray<SVGPathElement>("[data-ord-guard-wire]", section);

      if (prefersReducedMotion()) {
        gsap.set(items, { opacity: 1 });
        return;
      }

      const spin = gsap.to("[data-ord-spin]", {
        rotate: (i) => (i % 2 ? -360 : 360),
        duration: (i) => 60 + i * 30,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });

      const box = stage.getBoundingClientRect();
      const r = rings.getBoundingClientRect();
      const cx = r.left - box.left + r.width / 2;
      const cy = r.top - box.top + r.height / 2;
      const edge = r.width * 0.46;
      const vw = window.innerWidth / 100;

      gsap.set(items, { opacity: 0 });

      const mobile = isMobile();
      if (svg) svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      items.forEach((item, i) => {
        const ir = item.getBoundingClientRect();
        const ex = ir.left - box.left - 1.2 * vw;
        const ey = ir.top - box.top + ir.height / 2;
        const a = Math.atan2(ey - cy, ex - cx);
        const sx = cx + Math.cos(a) * edge;
        const sy = cy + Math.sin(a) * edge;
        const mid = (sx + ex) / 2;
        wires[i]?.setAttribute("d", `M${sx} ${sy} C${mid} ${sy} ${mid} ${ey} ${ex} ${ey}`);
        const len = wires[i]?.getTotalLength() ?? 0;
        if (wires[i]) gsap.set(wires[i], { strokeDasharray: len, strokeDashoffset: len });
      });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        // Starts when the stage pins (below the section's top padding), once the globe sits inside the circle.
        // Ends a screen early: the last screen is where Platform slides up over this pinned stage
        scrollTrigger: {
          trigger: section.querySelector("[data-ord-stage]") ?? section,
          start: "top top",
          endTrigger: section,
          end: "bottom 200%",
          scrub: 0.8,
        },
      });

      tl.to({}, { duration: 0.5 });

      // Each policy draws its line out from the ring, then its row lands at the end of it
      items.forEach((item, k) => {
        const at = 0.5 + k * (mobile ? 0.4 : 0.8);
        if (!mobile && wires[k]) tl.to(wires[k], { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, at);
        tl.fromTo(item, { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" }, at + (mobile ? 0 : 0.4));
      });

      tl.to({}, { duration: 0.6 });

      return () => spin.kill();
    },
    { scope: root, dependencies: [resizeKey], revertOnUpdate: true },
  );

  return (
    <section ref={root} id="governance" data-ord-orb="guard" className="relative pt-[7%]" style={{ height: pinnedHeight(300, 200) }}>
      <div data-ord-stage className="sticky top-0 h-screen overflow-hidden">
        <div
          data-ord-rings
          aria-hidden
          className="absolute left-[26vw] top-[54vh] h-[76vh] aspect-square -translate-x-1/2 -translate-y-1/2 max-md:left-[50vw] max-md:top-[36vh] max-md:h-[50vh]"
        >
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
            <g data-ord-spin>
              <circle cx="50" cy="50" r="30" fill="none" stroke={THEME.bone} strokeOpacity="0.14" strokeWidth="0.15" strokeDasharray="0.4 1.2" />
            </g>
            <g data-ord-spin>
              <circle cx="50" cy="50" r="38" fill="none" stroke={THEME.bone} strokeOpacity="0.1" strokeWidth="0.15" strokeDasharray="4 2" />
            </g>
            <circle cx="50" cy="50" r="46" fill="none" stroke={THEME.primary} strokeOpacity="0.5" strokeWidth="0.25" />
            {[0, 90, 180, 270].map((deg) => (
              <line
                key={deg}
                x1="50"
                y1="2"
                x2="50"
                y2="5"
                stroke={THEME.primaryLight}
                strokeOpacity="0.7"
                strokeWidth="0.2"
                transform={`rotate(${deg} 50 50)`}
              />
            ))}
          </svg>
        </div>
        <svg data-ord-guard-wires aria-hidden className="pointer-events-none absolute inset-0 h-full w-full max-md:hidden">
          {POLICIES.map((p) => (
            <path key={p.name} data-ord-guard-wire d="" fill="none" stroke={alpha(THEME.primary, 0.55)} strokeWidth="1" />
          ))}
        </svg>
        <div className="absolute right-[5vw] top-0 flex h-screen w-[34vw] flex-col justify-center gap-10 max-lg:right-[4vw] max-lg:w-[44vw] max-md:inset-x-[5vw] max-md:top-auto max-md:bottom-0 max-md:h-auto max-md:w-auto max-md:gap-5 max-md:py-[5vh]">
          <LineReveal>
            <h2>
              Agents improvise. <span className="text-ord-primary">Policies don&apos;t.</span>
            </h2>
          </LineReveal>
          <ul className="flex flex-col">
            {POLICIES.map((p, i) => (
              <li key={p.name} data-ord-policy className="relative flex gap-6 border-t border-(--ord-bone)/12 py-[1.8vh] max-md:gap-4 max-md:py-[1.2vh]">
                <span className="ord-label text-22 leading-[1.6] text-ord-primary-light">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-30">{p.name}</h3>
                  <p className="text-24 text-ord-stone max-md:hidden">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Guardrails;
