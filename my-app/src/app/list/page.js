import Link from "next/link";

export const metadata = {
  title: "All Routes · Hyperiux Concepts",
  description: "Every route and concept in this app, in one place.",
  robots: {
    index: false,
    follow: false,
  },
};

// Keep this in sync with src/app when a route is added or removed.
const CONCEPTS = [
  {
    href: "/",
    title: "Hyperiux Concept (home)",
    description: "Scroll-driven lake and cuboid hero with a portal snap, tunnel flythrough and warp effects. Same scene as /hyperiux-concept.",
  },
  {
    href: "/hyperiux-concept",
    title: "Hyperiux Concept",
    description: "The same Hero as the home route.",
  },
  {
    href: "/architectural-concept",
    title: "Your Brand Is the Cube",
    description: "A scroll journey in eight chapters: how Hyperiux turns a brand into a web experience, from research to launch.",
  },
  {
    href: "/architectural-storytelling",
    title: "The Connected Blueprint",
    description: "From insight to impact: a growth and experience partner where human behaviour, design, technology and marketing connect.",
  },
  {
    href: "/curiosity-to-impact",
    title: "From Curiosity to Impact",
    description: "Curiosity turned into digital experiences through creativity, design and engineering.",
  },
  {
    href: "/from-possibility",
    title: "From Possibility to Experience (Dark)",
    description: "The night version of the possibility journey.",
  },
  {
    href: "/from-possibility/light",
    title: "From Possibility to Experience (Light)",
    description: "The daylight version: warm limestone.",
  },
  {
    href: "/origin-forge",
    title: "The Origin Forge",
    description: "A creative technology studio building high-performance digital experiences for ambitious brands.",
  },
  {
    href: "/forging-concept",
    title: "Forging Concept",
    description: "The logo is forged, then the world switches to the garden, followed by the homepage sections.",
  },
  {
    href: "/sand-dune-concept",
    title: "Sand Dune Concept",
    description: "A trail across the dunes with four markers from the site's positioning statement.",
  },
  {
    href: "/forging-sand-dune-concept",
    title: "Forging Sand Dune Concept",
    description: "The forging and sand dune concepts combined.",
  },
  {
    href: "/forging-sand-dune-concept-v2",
    title: "Forging Sand Dune Concept V2",
    description: "Second iteration of the forging and sand dune concept.",
  },
  {
    href: "/forging-sand-dune-concept-v3",
    title: "Forging Sand Dune Concept V3",
    description: "Third iteration of the forging and sand dune concept.",
  },
  {
    href: "/about",
    title: "About Hyperiux",
    description: "The about page in the V3 concept's language: a 200vh 3D hero where the monolith opens onto the forge, then the team (after lusion.co/about).",
  },
  {
    href: "/forging-vid",
    title: "Forging Vid",
    description: "A separate copy of Forging Sand Dune Concept V3, with its own components, to change without touching V3.",
  },
  {
    href: "/ridge-plane",
    title: "Ridge Plane",
    description: "A plane with a single centre bulge running its full width, tapering flat at the edges.",
  },
];

const BLOG_SLUGS = [
  "agents-need-a-runtime-not-a-prompt",
  "policies-that-travel-with-the-action",
  "the-cost-of-a-finished-run",
  "shared-memory-without-shared-mess",
  "a-human-in-the-loop-that-scales",
  "field-notes-shipping-our-first-hundred-agents",
];

const ordinPages = (base) => [
  { href: base, title: "Home" },
  { href: `${base}/platform`, title: "Platform" },
  { href: `${base}/agents`, title: "Agents" },
  { href: `${base}/governance`, title: "Governance" },
  { href: `${base}/pricing`, title: "Pricing" },
  { href: `${base}/blog`, title: "Blog" },
  ...BLOG_SLUGS.map((slug) => ({ href: `${base}/blog/${slug}`, title: `Blog: ${slug}`, nested: true })),
  { href: `${base}/privacy`, title: "Privacy" },
];

const TEMPLATES = [
  {
    name: "Ordin",
    base: "/ordin",
    description: "AI agent platform SaaS template: one prompt travels the whole page, from tokens to an agent swarm, through guardrails and into a finished run.",
  },
  {
    name: "Ordin v2",
    base: "/ordin-v2",
    description: "A second version of the Ordin template, with the same pages.",
  },
];

const total = CONCEPTS.length + TEMPLATES.reduce((n, t) => n + ordinPages(t.base).length, 0);

function SectionHeading({ children, count }) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b border-white/15 pb-3">
      <h2 className="text-sm uppercase tracking-[0.2em] text-white/60">{children}</h2>
      <span className="font-mono text-xs text-white/40">{count}</span>
    </div>
  );
}

export default function ListPage() {
  return (
    <main className="min-h-screen w-full bg-[#0b0b0c] px-4 py-16 text-white sm:px-8 md:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-14">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-white/40">Hyperiux concepts</p>
          <h1 className="text-4xl font-light tracking-tight sm:text-5xl">All routes</h1>
          <p className="mt-4 max-w-xl text-white/60">
            {total} routes across {CONCEPTS.length} concepts and {TEMPLATES.length} templates.
          </p>
        </header>

        <section className="mb-16">
          <SectionHeading count={CONCEPTS.length}>Concepts</SectionHeading>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
            {CONCEPTS.map((c) => (
              <li key={c.href} className="bg-[#0b0b0c]">
                <Link href={c.href} className="group flex h-full flex-col gap-2 p-5 transition-colors hover:bg-white/4">
                  <span className="flex items-center justify-between gap-4">
                    <span className="text-lg font-normal">{c.title}</span>
                    <span aria-hidden className="text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white">→</span>
                  </span>
                  <span className="font-mono text-xs text-emerald-300/80">{c.href}</span>
                  <span className="text-sm leading-relaxed text-white/55">{c.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {TEMPLATES.map((t) => {
          const pages = ordinPages(t.base);
          return (
            <section key={t.base} className="mb-16">
              <SectionHeading count={pages.length}>Template · {t.name}</SectionHeading>
              <p className="mb-5 max-w-2xl text-sm text-white/55">{t.description}</p>
              <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                {pages.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      className={`group flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-white/4 ${p.nested ? "pl-10" : ""}`}
                    >
                      <span className={p.nested ? "text-sm text-white/70" : ""}>{p.title}</span>
                      <span className="truncate font-mono text-xs text-emerald-300/80">{p.href}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
