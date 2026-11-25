"use client";

// hyperiux-staging/src/components/Animations/Copy.js — line-by-line masked
// reveal on scroll. Same behaviour; the tweens / ScrollTriggers are now kept
// in a gsap.context so they are all killed on unmount.

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import ScrollTrigger from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(SplitText, ScrollTrigger);

export default function Copy({ children, animateOnScroll = true, delay = 0 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const elements = el.hasAttribute("data-copy-wrapper") ? Array.from(el.children) : [el];

    const splits = [];
    const lines = [];
    let ctx = null;
    let unmounted = false;

    const waitForFonts = async () => {
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // (fonts failed: split with what is there)
        }
      }
    };

    (async () => {
      await waitForFonts();
      if (unmounted) return;

      ctx = gsap.context(() => {
        elements.forEach((element) => {
          const split = SplitText.create(element, {
            type: "lines",
            mask: "lines",
            linesClass: "line++",
            lineThreshold: 0.1,
          });
          splits.push(split);

          const textIndent = getComputedStyle(element).textIndent;
          if (textIndent && textIndent !== "0px" && split.lines.length > 0) {
            split.lines[0].style.paddingLeft = textIndent;
            element.style.textIndent = "0";
          }

          lines.push(...split.lines);
        });

        if (prefersReduced) {
          gsap.set(lines, { y: "0%" });
          return;
        }

        gsap.set(lines, { y: "100%" });

        const animationProps = {
          y: "0%",
          duration: 1.4,
          stagger: 0.15,
          ease: "power4.out",
          delay,
          onComplete: () => gsap.set(lines, { clearProps: "transform" }),
        };

        if (animateOnScroll) {
          gsap.to(lines, {
            ...animationProps,
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              once: true,
            },
          });
        } else {
          gsap.to(lines, animationProps);
        }
      }, el);
    })();

    return () => {
      unmounted = true;
      ctx?.revert();
      splits.forEach((split) => split && split.revert());
    };
  }, [animateOnScroll, delay]);

  if (React.Children.count(children) === 1 && React.isValidElement(children)) {
    return React.cloneElement(children, { ref: containerRef });
  }

  return (
    <div ref={containerRef} data-copy-wrapper="true">
      {children}
    </div>
  );
}
