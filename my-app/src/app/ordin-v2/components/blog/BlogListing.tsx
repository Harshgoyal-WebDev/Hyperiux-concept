// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import LineReveal from "../Animations/LineReveal";
import Roll from "../Animations/Roll";
import PostCard from "./PostCard";
import { CATEGORIES, type Post } from "./posts";

const PAGE_SIZE = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

// Light section under the featured post: category filters with a sliding pill, then the grid.
// A filter change fades the old grid out and staggers the new one in (no layout morphing, so cards
// never stretch); "Load more" appears once there are more than PAGE_SIZE posts.
export default function BlogListing({ posts }: { posts: Post[] }) {
  const [category, setCategory] = useState("All");
  const [shown, setShown] = useState(PAGE_SIZE);
  const filtered = category === "All" ? posts : posts.filter((p) => p.category === category);
  const visible = filtered.slice(0, shown);

  const choose = (c: string) => {
    setCategory(c);
    setShown(PAGE_SIZE);
  };

  return (
    <section data-ord-orb="blog-list" data-ord-chapter="Articles" data-ord-light className="relative bg-ord-bone text-ord-ink">
      <div className="flex flex-col gap-14 ord-container ord-section max-md:gap-8">
        <div className="flex items-end justify-between gap-10 max-lg:flex-col max-lg:items-start max-lg:gap-6">
          <LineReveal className="w-[46%] max-lg:w-full">
            <h2>
              Every article, <span className="text-(--ord-text-muted)">filed by topic.</span>
            </h2>
          </LineReveal>
          <div className="flex flex-col items-end gap-4 max-lg:items-start">
            <span className="ord-label text-14 uppercase text-(--ord-text-muted)">
              <Roll value={String(filtered.length).padStart(2, "0")} /> articles
            </span>
            <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-1 border border-(--ord-ink)/12 p-1">
              {CATEGORIES.map((c) => {
                const active = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose(c)}
                    className={`relative cursor-pointer rounded-xs px-[1vw] py-[0.9vh] text-22 transition-colors duration-500 max-lg:px-[2.4vw] max-md:px-[3.6vw] ${
                      active ? "text-(--ord-on-primary)" : "text-(--ord-text-muted) hover:text-(--ord-ink)"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="ord-blog-filter"
                        transition={{ type: "spring", visualDuration: 0.45, bounce: 0.12 }}
                        className="absolute inset-0 rounded-xs bg-(--ord-primary)"
                      />
                    )}
                    <span className="relative">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {visible.length ? (
          <AnimatePresence mode="wait">
            <motion.ul
              key={category}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              exit={{ opacity: 0, y: 12, transition: { duration: 0.25, ease: "easeIn" } }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
              className="grid grid-cols-3 gap-[1.2vw] max-lg:grid-cols-2 max-lg:gap-[2.4vw] max-md:grid-cols-1 max-md:gap-[5vw]"
            >
              {visible.map((post) => (
                <motion.li
                  key={post.slug}
                  variants={{
                    hidden: { opacity: 0, y: 32 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
                  }}
                >
                  <PostCard post={post} />
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        ) : (
          <p className="border border-dashed border-(--ord-ink)/20 px-[2vw] py-[6vh] text-center text-24 text-(--ord-text-muted)">
            Nothing in {category} yet. New articles land every other week.
          </p>
        )}

        {filtered.length > shown && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="cursor-pointer rounded-xs border border-(--ord-ink)/25 px-[1.4vw] py-[1.4vh] text-22 transition-colors duration-500 hover:border-(--ord-primary-deep) hover:text-ord-primary-deep max-lg:px-[3vw] max-md:px-[6vw]"
            >
              Load more articles
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
