// Built using Hyperiux Vault: https://vault.hyperiux.com

import type { Author } from "./posts";

// Initials in a square plus name and role. Swap the square for an <Image> to use real portraits.
export default function AuthorBadge({ author, tone = "light" }: { author: Author; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className={`flex h-[4.4vh] aspect-square shrink-0 items-center justify-center ord-label text-14 max-lg:h-[3.6vh] max-md:h-[4.8vh] ${
          dark ? "bg-(--ord-primary) text-(--ord-on-primary)" : "bg-(--ord-ink) text-(--ord-bone)"
        }`}
      >
        {author.initials}
      </span>
      <span className="flex flex-col">
        <span className="text-22">{author.name}</span>
        <span className={`ord-label text-14 uppercase ${dark ? "text-ord-stone" : "text-(--ord-text-muted)"}`}>{author.role}</span>
      </span>
    </span>
  );
}
