// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(SplitText, ScrollTrigger);

type OverflowTextRevealDirection = 'top' | 'bottom' | 'left' | 'right';

// "bottom" is the original default behavior (yPercent: 100, rotate: 8)
const DIRECTION_INITIAL: Record<OverflowTextRevealDirection, { yPercent: number, xPercent: number, rotate: number }> = {
  top: { yPercent: -100, xPercent: 0, rotate: -8 },
  bottom: { yPercent: 100, xPercent: 0, rotate: 8 },
  left: { yPercent: 0, xPercent: -100, rotate: -8 },
  right: { yPercent: 0, xPercent: 100, rotate: 8 },
};

const REDUCED_MOTION_FADE_DURATION = 0.8;
const REDUCED_MOTION_Y_OFFSET = 24;
const DEFAULT_TEXT = <p>Characters rise from below.</p>;

interface OverflowTextRevealProps {
  children?: ReactNode;
  animateOnScroll?: boolean;
  delay?: number;
  className?: string;
  scrub?: boolean;
  direction?: OverflowTextRevealDirection;
  /** Animate per character, per word, or per line - each is masked. */
  splitBy?: "chars" | "words" | "lines";
  /** Opacity each piece starts from (0-1). */
  startOpacity?: number;
  /** Starting tilt in degrees; its sign follows the direction. */
  startRotation?: number;
  duration?: number;
  stagger?: number;
  /** GSAP ease for the reveal. */
  ease?: string;
}

export default function OverflowTextReveal({
  children = DEFAULT_TEXT,
  animateOnScroll = true,
  delay = 0,
  className = "",
  scrub = false,
  direction = "bottom",
  splitBy = "words",
  startOpacity = 0,
  startRotation = 8,
  duration = 0.5,
  stagger = 0.03,
  ease = "power3.out",
}: OverflowTextRevealProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const splitRefs = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    splitRefs.current = [];

    const elements = containerRef.current.hasAttribute("data-copy-wrapper")
      ? Array.from(containerRef.current.children)
      : [containerRef.current];

    const prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let ctx: ReturnType<typeof gsap.context> | undefined;

    const init = async () => {
      await document.fonts.ready;

      ctx = gsap.context(() => {
        const initialProps = DIRECTION_INITIAL[direction] ?? DIRECTION_INITIAL.bottom;

        elements.forEach((element) => {
          // autoSplit re-splits when the element's width changes, so lines never keep stale breaks
          const split = SplitText.create(element, {
            type:
              splitBy === "lines" ? "lines" : splitBy === "words" ? "lines,words" : "lines,chars",
            mask: splitBy,
            charsClass: "char++",
            reduceWhiteSpace: false,
            autoSplit: true,
            onSplit: (self) => {
              self.masks?.forEach((mask) => {
                const maskEl = mask as HTMLElement;
                maskEl.style.paddingInline = "0.04em";
                maskEl.style.marginInline = "-0.04em";
                maskEl.style.boxSizing = "content-box";
              });

              const pieces = (self[splitBy] ?? self.chars) as HTMLElement[];
              if (prefersReduced) {
                gsap.set(pieces, { yPercent: 0, xPercent: 0, rotate: 0, opacity: 1 });
                return;
              }

              const fromProps = {
                ...initialProps,
                rotate: Math.sign(initialProps.rotate) * startRotation,
                opacity: Math.min(1, Math.max(0, startOpacity)),
                willChange: "transform",
              };
              const toProps = { yPercent: 0, xPercent: 0, rotate: 0, opacity: 1, duration, stagger, ease, delay };

              // Returned so SplitText kills and rebuilds it on every re-split
              return animateOnScroll
                ? gsap.fromTo(pieces, fromProps, {
                    ...toProps,
                    scrollTrigger: { trigger: containerRef.current, start: "top 80%", end: "bottom 68%", scrub },
                  })
                : gsap.fromTo(pieces, fromProps, toProps);
            },
          });

          splitRefs.current.push(split);
        });

        if (prefersReduced) {
          gsap.set(containerRef.current, { opacity: 0, y: REDUCED_MOTION_Y_OFFSET });

          const fadeUpProps = {
            opacity: 1,
            y: 0,
            duration: REDUCED_MOTION_FADE_DURATION,
            ease: "power2.out",
            delay,
          };

          if (animateOnScroll) {
            gsap.to(containerRef.current, {
              ...fadeUpProps,
              scrollTrigger: {
                trigger: containerRef.current,
                start: "top 80%",
                once: true,
              },
            });
          } else {
            gsap.to(containerRef.current, fadeUpProps);
          }

          return;
        }

        // Reveal the container immediately - opacity-0 was only to prevent FOUC
        // GSAP will handle per-char opacity from here
        gsap.set(containerRef.current, { opacity: 1 });
      }, containerRef);
    };

    init();

    return () => {
      if (ctx) ctx.revert();
      splitRefs.current.forEach((split) => split?.revert());
    };
  }, [animateOnScroll, delay, scrub, direction, splitBy, startOpacity, startRotation, duration, stagger, ease]);

  return (
    <div ref={containerRef} data-copy-wrapper="true" className={`opacity-0 ${className}`}>
      {children}
    </div>
  );
}
