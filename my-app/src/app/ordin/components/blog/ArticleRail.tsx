// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import AuthorBadge from "./AuthorBadge";
import type { Author } from "./posts";

type RailProps = {
  // The element whose scroll position drives the progress line and the active contents entry
  targetId: string;
  toc: { id: string; text: string }[];
  meta?: { label: string; value: string }[];
  author?: Author;
  // Shows copy-link and share buttons for this title
  shareTitle?: string;
};

// Sticky left column beside an article: author, details, share buttons and a table of contents
// that highlights the section being read, with a line that fills as you go.
export default function ArticleRail({ targetId, toc, meta = [], author, shareTitle }: RailProps) {
  const lenis = useLenis();
  const fillRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(toc[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const headings = toc.map((t) => document.getElementById(t.id)).filter((h): h is HTMLElement => !!h);
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      const r = target.getBoundingClientRect();
      const progress = Math.min(Math.max((line - r.top) / r.height, 0), 1);
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${progress})`;
      // The last heading above the reading line is the section being read
      const current = headings.filter((h) => h.getBoundingClientRect().top < line).pop();
      setActive(current?.id ?? headings[0]?.id ?? "");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetId, toc]);

  // Jumps with Lenis so the smooth scroll stays in step; falls back to the browser's scroll
  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -window.innerHeight * 0.14, duration: 1.2 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the share links still work
    }
  };

  const shareUrl = (base: string) =>
    typeof window === "undefined" ? base : `${base}${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareTitle ?? "")}`;

  return (
    <aside className="sticky top-[16vh] flex flex-col gap-[3.2vh] max-lg:static max-lg:gap-6">
      {author && <AuthorBadge author={author} />}

      {meta.length > 0 && (
        <dl className="flex flex-col border-t border-(--ord-ink)/12">
          {meta.map((m) => (
            <div key={m.label} className="flex justify-between gap-4 border-b border-(--ord-ink)/12 py-[1.2vh] ord-label text-14">
              <dt className="text-(--ord-text-muted)">{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {shareTitle !== undefined && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 ord-label text-14 text-(--ord-text-muted)">Share</span>
          <button
            type="button"
            onClick={copy}
            className="cursor-pointer rounded-xs border border-(--ord-ink)/20 px-[0.8vw] py-[0.7vh] ord-label text-14 transition-colors duration-500 hover:border-(--ord-primary-deep) hover:text-ord-primary-deep max-lg:px-[2vw] max-md:px-[3vw]"
          >
            <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
          </button>
          {[
            { label: "X", href: "https://x.com/intent/post?url=" },
            { label: "LinkedIn", href: "https://www.linkedin.com/sharing/share-offsite/?url=" },
          ].map((s) => (
            <a
              key={s.label}
              href={s.href}
              onClick={(e) => {
                e.preventDefault();
                window.open(shareUrl(s.href), "_blank", "noopener,noreferrer");
              }}
              data-transition-ignore
              className="rounded-xs border border-(--ord-ink)/20 px-[0.8vw] py-[0.7vh] ord-label text-14 transition-colors duration-500 hover:border-(--ord-primary-deep) hover:text-ord-primary-deep max-lg:px-[2vw] max-md:px-[3vw]"
            >
              {s.label}
            </a>
          ))}
        </div>
      )}

      {toc.length > 0 && (
        <nav aria-label="On this page" className="flex gap-5 pt-[2vh] max-lg:hidden">
          {/* The progress line: fills top to bottom as the article is read */}
          <span aria-hidden className="relative block w-px shrink-0 bg-(--ord-ink)/12">
            <span ref={fillRef} className="absolute inset-0 block origin-top bg-(--ord-primary-deep) [transform:scaleY(0)]" />
          </span>
          <ol className="flex flex-col gap-1">
            <li className="pb-2 ord-label text-14 text-(--ord-text-muted)">On this page</li>
            {toc.map((t, i) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  onClick={(e) => jump(e, t.id)}
                  data-transition-ignore
                  aria-current={active === t.id ? "location" : undefined}
                  className={`flex gap-3 py-[0.6vh] text-22 transition-colors duration-500 ${
                    active === t.id ? "text-(--ord-ink)" : "text-(--ord-text-muted) hover:text-(--ord-ink)"
                  }`}
                >
                  <span className={`ord-label text-14 pt-[0.2em] transition-colors duration-500 ${active === t.id ? "text-ord-primary-deep" : ""}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </aside>
  );
}
