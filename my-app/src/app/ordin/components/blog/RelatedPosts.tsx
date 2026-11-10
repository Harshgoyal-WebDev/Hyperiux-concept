// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useRef } from "react";
import { useReveal } from "../Animations/useReveal";
import LineReveal from "../Animations/LineReveal";
import { OrdButton } from "../Buttons";
import { ROUTES } from "../nav";
import PostCard from "./PostCard";
import type { Post } from "./posts";

// Three more articles under a post, on the alternate light sheet
export default function RelatedPosts({ posts }: { posts: Post[] }) {
  const root = useRef<HTMLElement>(null);
  useReveal(root);
  if (!posts.length) return null;

  return (
    <section ref={root} data-ord-orb="post-related" data-ord-chapter="Read next" data-ord-light className="relative bg-(--ord-paper) text-ord-ink">
      <div className="flex flex-col gap-14 ord-container ord-section max-md:gap-8">
        <div className="flex items-end justify-between gap-10 max-md:flex-col max-md:items-start max-md:gap-6">
          <LineReveal>
            <h2>
              Keep <span className="text-(--ord-text-muted)">reading.</span>
            </h2>
          </LineReveal>
          <OrdButton href={ROUTES.blog} variant="inkLine">
            All articles
          </OrdButton>
        </div>
        <ul className="grid grid-cols-3 gap-[1.2vw] max-lg:grid-cols-2 max-lg:gap-[2.4vw] max-md:grid-cols-1 max-md:gap-[5vw]">
          {posts.map((p) => (
            <li key={p.slug} data-ord-reveal>
              <PostCard post={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
