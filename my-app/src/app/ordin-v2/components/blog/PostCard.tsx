// Built using Hyperiux Vault: https://vault.hyperiux.com

import Spotlight from "../Animations/Spotlight";
import { ROUTES } from "../nav";
import PostCover from "./PostCover";
import { formatDate, readingMinutes, type Post } from "./posts";

// One article in a grid, for light sections: the cover zooms, a mint line fills along the bottom
// and the arrow slides on hover. The whole card is the link.
export default function PostCard({ post }: { post: Post }) {
  return (
    <Spotlight
      as="a"
      tone="light"
      href={`${ROUTES.blog}/${post.slug}`}
      className="group/post relative flex h-full flex-col border border-(--ord-ink)/12 bg-white/40 transition-colors duration-500 hover:bg-white/70"
    >
      <PostCover art={post.cover} className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col gap-6 px-[1.6vw] py-[1.8vw] max-lg:gap-5 max-lg:px-[3vw] max-lg:py-[3.4vw] max-md:px-[5vw] max-md:py-[6vw]">
        <div className="flex items-center justify-between gap-4 ord-label text-14 uppercase text-(--ord-text-muted)">
          <span className="text-ord-primary-deep">{post.category}</span>
          <span>
            <time dateTime={post.date}>{formatDate(post.date)}</time> / {readingMinutes(post)} min
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-30 leading-[1.2]">{post.title}</h3>
          <p className="text-22 text-(--ord-text-muted) line-clamp-3">{post.summary}</p>
        </div>
        <span className="mt-auto flex items-center justify-between border-t border-(--ord-ink)/10 pt-[1.6vh] text-22">
          Read article
          <span className="relative block h-[1.4vh] aspect-square overflow-hidden max-lg:h-[1.1vh] max-md:h-[1.5vh]">
            {[0, 1].map((k) => (
              <svg
                key={k}
                aria-hidden
                viewBox="0 0 16 16"
                className={`absolute inset-0 h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] ${
                  k ? "[transform:translate(-120%,120%)] group-hover/post:[transform:translate(0,0)]" : "group-hover/post:[transform:translate(120%,-120%)]"
                }`}
              >
                <path d="M3 13 13 3M5 3h8v8" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            ))}
          </span>
        </span>
      </div>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 block h-0.5 origin-left bg-(--ord-primary) [transform:scaleX(0)] transition-transform duration-700 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover/post:[transform:scaleX(1)]"
      />
    </Spotlight>
  );
}
