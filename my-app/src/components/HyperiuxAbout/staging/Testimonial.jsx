"use client";

// hyperiux-staging/src/components/About/Testimonial.jsx — a 220vh section
// with a sticky screen: the heading's characters rise with the scroll, then
// the cube field fills in over it and the carousel fades in.

import React, { useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import TestimonialSectionInterActive from "./TestimonialSectionInterActive";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const Testimonial = () => {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const heading = headingRef.current;

      if (!section || !heading) return;

      const split = new SplitText(heading, {
        type: "chars,words",
        charsClass: "testimonial-heading-char",
        wordsClass: "testimonial-heading-word",
        mask: "words",
      });

      gsap.set(split.chars, {
        yPercent: 110,
        opacity: 1,
        willChange: "transform",
      });

      gsap.to(split.chars, {
        yPercent: 0,
        duration: 0.28,
        stagger: {
          each: 0.02,
          from: "start",
        },
        scrollTrigger: {
          trigger: section,
          start: "top 60%",
          end: "30% 60%",
          scrub: true,
        },
        ease: "power3.out",
      });

      return () => {
        split.revert();
      };
    },
    {
      scope: sectionRef,
    },
  );

  return (
    <section
      ref={sectionRef}
      className="w-full h-[220vh] relative z-30 bg-white"
      id="testimonial"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden mt-[-7%]">
        <div className="absolute inset-0 z-40 h-full w-full">
          <TestimonialSectionInterActive triggerRef={sectionRef} />
        </div>

        <div className="absolute inset-0 z-20 h-full w-full px-[5vw] flex items-center pointer-events-none">
          <h2
            ref={headingRef}
            className="w-[75%] max-sm:w-full leading-[1.2] text-[#111111] relative z-30 text-[7.4vw] max-sm:text-[12vw] max-sm:mt-[-10vh] break-keep wrap-normal"
          >
            Stories That Stick, Results That Show.
          </h2>
        </div>
      </div>
    </section>
  );
};

export default Testimonial;
