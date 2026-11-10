// Built using Hyperiux Vault: https://vault.hyperiux.com
import { pageMetadata } from "../metadata";
import { ENQUIRE } from "../components/nav";
import PageReady from "../components/Animations/PageReady";
import { CtaOrb } from "../components/SignalOrb";
import PageHero from "../components/pages/PageHero";
import FeaturedPost from "../components/blog/FeaturedPost";
import BlogListing from "../components/blog/BlogListing";
import Cta from "../components/Cta";
import { POSTS } from "../components/blog/posts";

export const metadata = pageMetadata(
  "Blog | Ordin",
  "Notes from the team building Ordin: running agents in production, governance, memory, pricing and field notes from real rollouts.",
  "/blog",
);

const page = () => {
  // The featured post sits above the grid, so the grid leaves it out
  const featured = POSTS.find((p) => p.featured) ?? POSTS[0];
  const rest = POSTS.filter((p) => p.slug !== featured.slug);

  return (
    <main className="relative z-2 bg-ord-ink [clip-path:inset(0)]">
      <PageReady />
      <div aria-hidden className="ord-glow pointer-events-none fixed inset-0 z-0" />
      <CtaOrb />
      <PageHero
        orb="blog-hero"
        chapter="Blog"
        title={
          <>
            Notes from <span className="text-ord-primary-light">the runtime.</span>
          </>
        }
        copy="How we build, govern and price agents that run in production, plus what we learn shipping them with customers."
        primary={{ label: "Read the Latest", href: "#blog-featured" }}
        secondary={{ label: "Talk to the Team", href: ENQUIRE.demo }}
        arc={{ flipX: true, flipY: true, speed: 0.6, flow: 0.8, softness: 1.3 }}
      />
      <div id="blog-featured" className="relative">
        <FeaturedPost post={featured} />
      </div>
      <BlogListing posts={rest} />
      <Cta />
    </main>
  );
};

export default page;
