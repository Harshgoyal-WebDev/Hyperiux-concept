// Built using Hyperiux Vault: https://vault.hyperiux.com
import { notFound } from "next/navigation";
import { pageMetadata } from "../../metadata";
import PageReady from "../../components/Animations/PageReady";
import { CtaOrb } from "../../components/SignalOrb";
import PostHero from "../../components/blog/PostHero";
import ArticleRail from "../../components/blog/ArticleRail";
import Prose from "../../components/blog/Prose";
import RelatedPosts from "../../components/blog/RelatedPosts";
import Cta from "../../components/Cta";
import { POSTS, formatDate, getPost, readingMinutes, relatedTo, tocFor } from "../../components/blog/posts";

type PageProps = { params: Promise<{ slug: string }> };

// Every post is prerendered at build time
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));
export const dynamicParams = false;

export const generateMetadata = async ({ params }: PageProps) => {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return pageMetadata(`${post.title} | Ordin`, post.summary, `/blog/${slug}`);
};

const page = async ({ params }: PageProps) => {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <main className="relative z-2 bg-ord-ink [clip-path:inset(0)]">
      <PageReady />
      <div aria-hidden className="ord-glow pointer-events-none fixed inset-0 z-0" />
      <CtaOrb />
      <PostHero post={post} />

      {/* The article sits on the light sheet: sticky rail on the left, prose on the right */}
      <section data-ord-orb="post-body" data-ord-chapter="Article" data-ord-light className="relative mt-[8vw] bg-ord-bone text-ord-ink max-lg:mt-[10vw]">
        <div className="flex justify-between gap-[4vw] ord-container ord-section max-lg:flex-col max-lg:gap-10">
          <div className="w-[26%] shrink-0 max-lg:w-full">
            <ArticleRail
              targetId="ord-article"
              toc={tocFor(post.body)}
              author={post.author}
              shareTitle={post.title}
              meta={[
                { label: "Published", value: formatDate(post.date) },
                { label: "Reading time", value: `${readingMinutes(post)} min` },
                { label: "Topic", value: post.category },
              ]}
            />
          </div>
          <article id="ord-article" className="flex w-[62%] flex-col gap-[4vw] max-lg:w-full max-md:gap-[10vw]">
            <Prose blocks={post.body} />
            <ul aria-label="Tags" className="flex flex-wrap gap-2 border-t border-(--ord-ink)/12 pt-[3vh]">
              {post.tags.map((t) => (
                <li key={t} className="border border-(--ord-ink)/15 px-[0.8vw] py-[0.6vh] ord-label text-14 text-(--ord-text-muted) max-lg:px-[2vw] max-md:px-[3vw]">
                  {t}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <RelatedPosts posts={relatedTo(post)} />
      <Cta />
    </main>
  );
};

export default page;
