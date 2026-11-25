"use client";

// hyperiux-staging/src/components/Animations/HeadAnim.js — per-character
// masked rise (with a slight rotation) when the heading reaches 70% of the
// viewport. Same behaviour; guarded against unmounting before the fonts are
// ready, and its tweens / ScrollTriggers are killed on unmount.

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import ScrollTrigger from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(SplitText, ScrollTrigger);

export default function HeadAnim({ children, animateOnScroll = true, delay = 0 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Find elements to split (single node or wrapper's children)
    const elements = container.hasAttribute("data-copy-wrapper")
      ? Array.from(container.children)
      : [container];

    const splits = [];
    const chars = [];
    let ctx = null;
    let unmounted = false;

    document.fonts.ready.then(() => {
      if (unmounted) return;

      ctx = gsap.context(() => {
        elements.forEach((element) => {
          const split = SplitText.create(element, {
            type: "lines,chars",
            mask: "chars",
            charsClass: "char++",
            reduceWhiteSpace: false,
          });
          splits.push(split);
          chars.push(...split.chars);
        });

        // Set initial state: chars slide up into view
        gsap.set(chars, { yPercent: 100, willChange: "transform", rotate: 8 });

        const animationProps = {
          yPercent: 0,
          rotate: 0,
          duration: 0.5,
          stagger: 0.02,
          ease: "power3.out",
          delay,
        };

        if (animateOnScroll) {
          gsap.to(chars, {
            ...animationProps,
            scrollTrigger: {
              trigger: container,
              start: "top 70%",
              end: "bottom 50%",
            },
          });
        } else {
          gsap.to(chars, animationProps);
        }
      }, container);
    });

    return () => {
      unmounted = true;
      ctx?.revert();
      splits.forEach((split) => split && split.revert());
    };
  }, [animateOnScroll, delay]);

  const child = React.Children.count(children) === 1 ? React.Children.only(children) : null;

  if (child && React.isValidElement(child)) {
    return React.cloneElement(child, { ref: containerRef });
  }

  return (
    <div ref={containerRef} data-copy-wrapper="true">
      {children}
    </div>
  );
}
