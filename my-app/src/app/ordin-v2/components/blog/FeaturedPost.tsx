// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useRef } from "react";
import { useReveal } from "../Animations/useReveal";
import Spotlight from "../Animations/Spotlight";
import { ROUTES } from "../nav";
import AuthorBadge from "./AuthorBadge";
import PostCover from "./PostCover";
import { formatDate, readingMinutes, type Post } from "./posts";

// The pinned article at the top of the blog: a wide cover beside the headline, on the dark page
export default function FeaturedPost({ post }: { post: Post }) {
  const root = useRef<HTMLElement>(null);
  useReveal(root);

  return (
    <section ref={root} data-ord-orb="blog-featured" data-ord-chapter="Featured" className="relative ord-container pb-[7vw] max-lg:pb-[10vw]">
      <Spotlight
        as="a"
        href={`${ROUTES.blog}/${post.slug}`}
        data-ord-reveal
        className="group/post relative grid grid-cols-[1.35fr_1fr] border border-(--ord-bone)/12 bg-(--ord-ink)/40 transition-colors duration-500 hover:border-(--ord-primary)/50 max-lg:grid-cols-1"
      >
        <PostCover art={post.cover} label="Featured" className="aspect-[16/10] w-full max-lg:aspect-[16/9]" />
        <div className="flex flex-col justify-between gap-10 px-[2.4vw] py-[2.4vw] max-lg:gap-8 max-lg:px-[4vw] max-lg:py-[4vw] max-md:px-[5vw] max-md:py-[7vw]">
          <div className="flex flex-col gap-6">
            <span className="flex items-center gap-4 ord-label text-14 uppercase text-ord-stone">
              <span className="text-ord-primary-light">{post.category}</span>
              <span className="h-px w-[2vw] bg-(--ord-bone)/20" />
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </span>
            <h2 className="text-64 leading-[1.1]">{post.title}</h2>
            <p className="text-24 text-ord-ash">{post.summary}</p>
          </div>
          <div className="flex items-end justify-between gap-6 border-t border-(--ord-bone)/12 pt-[2.4vh]">
            <AuthorBadge author={post.author} tone="dark" />
            <span className="ord-label text-14 uppercase text-ord-stone">{readingMinutes(post)} min read</span>
          </div>
        </div>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 block h-0.5 origin-left bg-(--ord-primary-light) [transform:scaleX(0)] transition-transform duration-700 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover/post:[transform:scaleX(1)]"
        />
      </Spotlight>
    </section>
  );
}
