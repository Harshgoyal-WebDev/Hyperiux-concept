"use client";

// hyperiux-staging's About "Why partner with us?" (src/components/About/
// Values.jsx), ported as it is there: the heading revealed by a wipe as the
// cards slide across, on a long sticky scroll. Its selectors are scoped to
// this section; the Arrow is staging's (components/Buttons).

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

function Arrow() {
  return (
    <div className="relative ml-[-0.04vw] mt-[-0.04vw] flex h-full w-full flex-col flex-nowrap overflow-hidden">
      <svg width="13" height="13" className="absolute h-full w-full scale-[1] transition-all duration-300 group-hover:translate-x-[100%] group-hover:translate-y-[-100%] group-hover:scale-[0.5]" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.8825 11.312H10.8825V4.12354L2.32388 12.6821L0.909821 11.2681L9.46841 2.70947H2.27994V0.709473H11.8825C12.4346 0.709627 12.8825 1.15728 12.8825 1.70947V11.312Z" fill="#1A1A1A" className="fill-current duration-300" />
      </svg>
      <svg width="13" height="13" className="absolute h-full w-full translate-x-[-100%] translate-y-[100%] scale-[0.5] transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:scale-[1]" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.8825 11.312H10.8825V4.12354L2.32388 12.6821L0.909821 11.2681L9.46841 2.70947H2.27994V0.709473H11.8825C12.4346 0.709627 12.8825 1.15728 12.8825 1.70947V11.312Z" fill="#1A1A1A" className="fill-current duration-300" />
      </svg>
    </div>
  );
}

// delay: vh of scroll its animations start later by (the section grows by
// as much, so they all still play out while it's pinned)
export default function Values({ delay = 0 }) {
  const root = useRef(null);
  useGSAP(
    () => {
      if (globalThis.innerWidth <= 1024) return;
      const el = root.current;
      const d = () => (delay * window.innerHeight) / 100;
      const split = new SplitText(el.querySelectorAll(".culture-head-1"), { type: "words,lines,chars", mask: "lines" });
      const split2 = new SplitText(el.querySelectorAll(".culture-head-2"), { type: "words,lines,chars" });
      const hl = gsap.timeline({
        // (staging's "top 70%" → "85% 70%" of its 550vh, each delay later)
        scrollTrigger: { trigger: el, start: () => `top+=${d()} 70%`, end: () => `top+=${d() + window.innerHeight * 5.5 * 0.6} 70%`, scrub: true  },
      });
      hl.from(split.chars, { yPercent: 100, stagger: 0.015, rotate: 5, duration: 0.15 });
      hl.from(split2.chars, { yPercent: 100, stagger: 0.015, rotate: 5, duration: 0.15 }, "<");
      hl.to(split.chars, { yPercent: -150, delay: 1.5, rotate: -5, ease: "power1.in", stagger: { from: "start", amount: 0.2 } });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: () => `top+=${d()} 30%`, end: "bottom bottom", scrub: true },
      });
      tl.from(".culture-cover", { clipPath: "inset(0% 0% 0% 100%)", duration: 0.8 })
        .to(".culture-card-container", { translateX: "-80%", delay: -0.8, duration: 2 })
        .to(".culture-cover", { clipPath: "inset(0% 100% 0% 0%)", duration: 0.8, delay: -1.4 });
      return () => {
        split.revert();
        split2.revert();
      };
    },
    { scope: root, dependencies: [delay], revertOnUpdate: true }
  );

  // each card's video only playing while it's turned over (hover): never all
  // five decoding at once, off screen
  useEffect(() => {
    const cards = [...root.current.querySelectorAll(".group")];
    const offs = cards.map((card) => {
      const video = card.querySelector("video");
      if (!video) return () => {};
      const on = () => video.play().catch(() => {});
      const off = () => video.pause();
      card.addEventListener("pointerenter", on);
      card.addEventListener("pointerleave", off);
      return () => {
        card.removeEventListener("pointerenter", on);
        card.removeEventListener("pointerleave", off);
      };
    });
    return () => offs.forEach((f) => f());
  }, []);

  return (
    <section
      ref={root}
      style={{ "--values-delay": `${delay}vh` }}
      className="w-screen h-[calc(400vh+var(--values-delay))] relative z-[2] bg-[#FEFEFE] max-sm:h-fit max-sm:py-[15%]"
      id="culture"
    >
      <div className="w-screen h-screen mt-[-20vh] flex items-center justify-center sticky top-0 overflow-hidden max-sm:static max-sm:h-fit max-sm:px-[7vw] max-sm:flex-col max-sm:items-start max-sm:gap-[10vw]">
        <h2 className="text-[10vw] w-[60%] leadng-[1.2] font-aeonik text-black/20 culture-head-1 cover-culture text-center  max-sm:text-[#111111] max-sm:text-[11vw] max-sm:text-start">
          Why partner with us?
        </h2>
        <div
          className="w-screen h-screen absolute flex items-center justify-center top-0 left-0 culture-cover max-sm:hidden"
          style={{ clipPath: "inset(0% 0% 0% 0%)" }}
        >
          <h2 className="text-[10vw] w-[60%] leadng-[1.2] font-aeonik text-black culture-head-2 text-center ">
            Why partner with us?
          </h2>
        </div>

        <div className="w-[200vw] h-screen flex absolute top-0 translate-x-[100%] culture-card-container max-sm:translate-x-0 max-sm:w-full max-sm:h-fit max-sm:flex-col max-sm:static max-sm:gap-[7vw]">
          <div className="group w-[27vw] h-[24vw] min-w-[300px] min-h-[260px] [perspective:1000px] text-[#fefefe] mt-[5%] max-sm:m-0 max-sm:w-full max-sm:h-[40vh] ">
            <div className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              <div className="absolute w-full h-full rounded-[1.5vw] bg-[#734EFF] p-[2vw] flex flex-col gap-[3vw] justify-end [backface-visibility:hidden] shadow-lg max-sm:rounded-[4.5vw] max-sm:p-[7vw] max-sm:justify-between">
                <h3 className="w-[40%] font-aeonik text-[2.5vw] max-sm:text-[7.5vw]">Culture</h3>
                <p>
                  We don&apos;t work for clients. We work for our brand partners. And
                  as partners, we make sure to craft disruptive digital
                  solutions using purposeful strategy, beautiful designs &
                  user-centric technology that makes you a part of the very best
                  on the web.
                </p>
                <div className="w-[3vw] h-[3vw] rounded-full bg-[#111111] text-white right-5 top-5 absolute flex justify-center items-center p-[1vw] max-sm:h-[10vw] max-sm:w-[10vw] max-sm:p-[3vw] max-sm:hidden ">
                  <Arrow />
                </div>
              </div>

              <div className="absolute w-full h-full rounded-[1.5vw] flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden] bg-gray-900 shadow-lg overflow-hidden">
                <video
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover rounded-[1.5vw]"
                  style={{ filter: "brightness(0.8)" }}
                >
                  <source
                    src="/assets/images/aboutpage/gifs/culture.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>
          </div>

          <div className="group w-[27vw] h-[24vw] min-w-[300px] min-h-[260px] [perspective:1000px] mt-[12%] ml-[5%] max-sm:m-0 max-sm:w-full max-sm:h-[40vh]">
            <div className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              <div className="absolute w-full h-full rounded-[1.5vw] bg-[#FFEF5E] p-[2vw] text-[#111111] flex flex-col gap-[3vw] justify-end [backface-visibility:hidden] shadow-lg max-sm:rounded-[4.5vw] max-sm:p-[7vw] max-sm:justify-between">
                <h3 className="w-[40%] font-aeonik text-[2.5vw] max-sm:text-[7.5vw]">Attitude</h3>
                <p>
                  You might have intricate requirements but we&apos;ve got ambition,
                  imagination, skills and the tools to match them. That&apos;s 4-to-1
                  to us. It just can&apos;t go wrong. Can it?
                </p>
                <div className="w-[3vw] h-[3vw] rounded-full bg-[#111111] text-white right-5 top-5 absolute flex justify-center items-center p-[1vw] max-sm:h-[10vw] max-sm:w-[10vw] max-sm:p-[3vw] max-sm:hidden max-sm:hidden">
                  <Arrow />
                </div>
              </div>

              <div className="absolute w-full h-full rounded-[1.5vw] flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden] bg-gray-900 shadow-lg overflow-hidden">
                <video
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover rounded-[1.5vw]"
                  style={{ filter: "brightness(0.8)" }}
                >
                  <source
                    src="/assets/images/aboutpage/gifs/attitude.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>
          </div>

          <div className="group w-[27vw] h-[24vw] min-w-[300px] min-h-[260px] [perspective:1000px] mt-[5%] ml-[7%] max-sm:m-0 max-sm:w-full max-sm:h-[40vh]">
            <div className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              <div className="absolute w-full h-full rounded-[1.5vw] bg-[#3355FF] p-[2vw] text-[#fefefe] flex flex-col gap-[3vw] justify-end [backface-visibility:hidden] shadow-lg max-sm:rounded-[4.5vw] max-sm:p-[7vw] max-sm:justify-between">
                <h3 className="w-[40%] font-aeonik text-[2.5vw] max-sm:text-[7.5vw]">
                  Innovative Culture
                </h3>
                <p>
                  Enigma thrives on innovation, fostering a workspace where
                  risk-taking and originality are part of your everyday. You&apos;ll
                  join a team eager to push boundaries and champion your
                  groundbreaking ideas.
                </p>
                <div className="w-[3vw] h-[3vw] rounded-full bg-[#111111] text-white right-5 top-5 absolute flex justify-center items-center p-[1vw] max-sm:h-[10vw] max-sm:w-[10vw] max-sm:p-[3vw] max-sm:hidden">
                  <Arrow />
                </div>
              </div>

              <div className="absolute w-full h-full rounded-[1.5vw] flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden] bg-gray-900 shadow-lg overflow-hidden">
                <video
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover rounded-[1.5vw]"
                  style={{ filter: "brightness(0.8)" }}
                >
                  <source
                    src="/assets/images/aboutpage/gifs/ethos.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>
          </div>

          <div className="group w-[27vw] h-[24vw] min-w-[300px] min-h-[260px] [perspective:1000px] mt-[12%] ml-[8%] max-sm:m-0 max-sm:w-full max-sm:h-[40vh]">
            <div className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              <div className="absolute w-full h-full rounded-[1.5vw] bg-[#FF6B00] p-[2vw] text-[#fefefe] flex flex-col gap-[3vw] justify-end [backface-visibility:hidden] shadow-lg max-sm:rounded-[4.5vw] max-sm:p-[7vw] max-sm:justify-between">
                <h3 className="w-[40%] font-aeonik text-[2.5vw] max-sm:text-[7.5vw]">
                  Professional Growth
                </h3>
                <p>
                  At Enigma, your career is a dynamic journey of learning and
                  advancement. We offer diverse opportunities to grow with
                  industry experts, ensuring every project polishes your
                  professional prowess.
                </p>
                <div className="w-[3vw] h-[3vw] rounded-full bg-[#111111] text-white right-5 top-5 absolute flex justify-center items-center p-[1vw] max-sm:h-[10vw] max-sm:w-[10vw] max-sm:p-[3vw] max-sm:hidden">
                  <Arrow />
                </div>
              </div>

              <div className="absolute w-full h-full rounded-[1.5vw] flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden] bg-gray-900 shadow-lg overflow-hidden">
                <video
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover rounded-[1.5vw]"
                  style={{ filter: "brightness(0.8)" }}
                >
                  <source
                    src="/assets/images/aboutpage/gifs/experience.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>
          </div>

          <div className="group w-[27vw] h-[24vw] min-w-[300px] min-h-[260px] [perspective:1000px] mt-[5%] ml-[8%] max-sm:m-0 max-sm:w-full max-sm:h-[40vh]">
            <div className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              <div className="absolute w-full h-full rounded-[1.5vw] bg-[#9FF86F] p-[2vw] text-[#111111] flex flex-col gap-[3vw] justify-end [backface-visibility:hidden] shadow-lg max-sm:rounded-[4.5vw] max-sm:p-[7vw] max-sm:justify-between">
                <h3 className="w-[40%] font-aeonik text-[2.5vw] max-sm:text-[7.5vw]">
                  Professional Growth
                </h3>
                <p>
                  At Enigma, your career is a dynamic journey of learning and
                  advancement. We offer diverse opportunities to grow with
                  industry experts, ensuring every project polishes your
                  professional prowess.
                </p>
                <div className="w-[3vw] h-[3vw] rounded-full bg-[#111111] text-white right-5 top-5 absolute flex justify-center items-center p-[1vw] max-sm:h-[10vw] max-sm:w-[10vw] max-sm:p-[3vw] max-sm:hidden">
                  <Arrow />
                </div>
              </div>

              <div className="absolute w-full h-full rounded-[1.5vw] flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden] bg-gray-900 shadow-lg overflow-hidden">
                <video
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover rounded-[1.5vw]"
                  style={{ filter: "brightness(0.8)" }}
                >
                  <source
                    src="/assets/images/aboutpage/gifs/magic.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
