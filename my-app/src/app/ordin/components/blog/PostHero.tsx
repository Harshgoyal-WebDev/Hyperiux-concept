// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { onIntroDone } from "../Animations/intro";
import { prefersReducedMotion } from "../Animations/reducedMotion";
import MintArc from "../MintArc";
import { ROUTES } from "../nav";
import AuthorBadge from "./AuthorBadge";
import PostCover from "./PostCover";
import { formatDate, readingMinutes, type Post } from "./posts";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Article header on the dark page: back link, topic and date, the title in masked lines, then the
// cover, which eases out of a slight zoom as it scrolls up
export default function PostHero({ post }: { post: Post }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const title = SplitText.create("[data-post-title]", { type: "lines", mask: "lines", linesClass: "ord-line", aria: "none" });
      const tl = gsap.timeline({ paused: true });
      tl.from(title.lines, { yPercent: 105, duration: 1.4, stagger: 0.1, ease: "expo.out" }, 0)
        .from("[data-post-fade]", { opacity: 0, y: 16, duration: 1.1, stagger: 0.08, ease: "power3.out" }, 0.25)
        .from("[data-post-cover]", { opacity: 0, y: 40, duration: 1.6, ease: "expo.out" }, 0.35)
        .from("[data-post-backdrop]", { opacity: 0, duration: 2.4, ease: "expo.out" }, 0);
      const stop = onIntroDone(() => tl.play());

      gsap.fromTo(
        "[data-post-cover-art]",
        { scale: 1.12 },
        { scale: 1, ease: "none", scrollTrigger: { trigger: "[data-post-cover]", start: "top bottom", end: "bottom top", scrub: true } },
      );

      return () => {
        stop();
        title.revert();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} data-ord-orb="post-hero" data-ord-chapter="Article" className="relative overflow-hidden">
      <div
        data-post-backdrop
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[90vh] opacity-60 [mask-image:linear-gradient(to_bottom,#000_40%,transparent_92%)] max-md:opacity-40"
      >
        <MintArc flipY speed={0.6} flow={0.7} softness={1.4} intensity={0.9} />
      </div>
      <div className="relative z-1 flex flex-col gap-[6vh] ord-container pt-[22vh] max-lg:pt-[16vh] max-md:gap-[4vh] max-md:pt-[18vh]">
        <div className="flex w-[72%] flex-col gap-8 max-lg:w-[90%] max-md:w-full max-md:gap-6">
          <div data-post-fade className="flex flex-wrap items-center gap-4 ord-label text-14 text-ord-stone">
            <a href={ROUTES.blog} className="group/back flex items-center gap-2 transition-colors duration-500 hover:text-ord-bone">
              <svg aria-hidden viewBox="0 0 16 16" className="h-[1.2vh] aspect-square transition-transform duration-500 group-hover/back:-translate-x-1 max-lg:h-[1vh] max-md:h-[1.4vh]">
                <path d="M13 8H3M7 4 3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              All articles
            </a>
            <span className="h-px w-[2vw] bg-(--ord-bone)/20 max-md:w-[6vw]" />
            <span className="text-ord-primary-light">{post.category}</span>
          </div>
          <h1 data-post-title className="text-64 leading-[1.1]">
            {post.title}
          </h1>
          <p data-post-fade className="w-[80%] text-28 text-ord-ash max-md:w-full">
            {post.summary}
          </p>
          <div data-post-fade className="flex flex-wrap items-center gap-x-10 gap-y-4">
            <AuthorBadge author={post.author} tone="dark" />
            <span className="ord-label text-14 text-ord-stone">
              <time dateTime={post.date}>{formatDate(post.date)}</time> / {readingMinutes(post)} min read
            </span>
          </div>
        </div>
        <div data-post-cover className="overflow-hidden border border-(--ord-bone)/12">
          <div data-post-cover-art>
            <PostCover art={post.cover} className="aspect-[21/9] w-full max-md:aspect-[4/3]" />
          </div>
        </div>
      </div>
    </section>
  );
}
