// Built using Hyperiux Vault: https://vault.hyperiux.com
import { pageMetadata } from "../metadata";
import { ENQUIRE } from "../components/nav";
import PageReady from "../components/Animations/PageReady";
import { CtaOrb } from "../components/SignalOrb";
import PageHero from "../components/pages/PageHero";
import ArticleRail from "../components/blog/ArticleRail";
import Prose from "../components/blog/Prose";
import { formatDate, tocFor } from "../components/blog/posts";
import { PRIVACY, PRIVACY_UPDATED } from "../components/legal/privacy";
import Cta from "../components/Cta";

export const metadata = pageMetadata(
  "Privacy policy | Ordin",
  "What Ordin Labs collects, why, how long we keep it, and the choices you have.",
  "/privacy",
);

const page = () => {
  return (
    <main className="relative z-2 bg-ord-ink [clip-path:inset(0)]">
      <PageReady />
      <div aria-hidden className="ord-glow pointer-events-none fixed inset-0 z-0" />
      <CtaOrb />
      <PageHero
        orb="privacy-hero"
        chapter="Privacy"
        title={
          <>
            Privacy, <span className="text-ord-primary-light">in plain words.</span>
          </>
        }
        copy={`What we collect, why we collect it and what you can do about it. Last updated ${formatDate(PRIVACY_UPDATED)}.`}
        primary={{ label: "Read the policy", href: "#privacy-policy" }}
        secondary={{ label: "Ask a question", href: ENQUIRE.security }}
        arc={{ flipY: true, speed: 0.5, flow: 0.6, softness: 1.5 }}
      />
      <section id="privacy-policy" data-ord-orb="privacy-body" data-ord-chapter="Policy" data-ord-light className="relative bg-ord-bone text-ord-ink">
        <div className="flex justify-between gap-[4vw] ord-container ord-section max-lg:flex-col max-lg:gap-10">
          <div className="w-[26%] shrink-0 max-lg:w-full">
            <ArticleRail
              targetId="ord-privacy"
              toc={tocFor(PRIVACY)}
              meta={[
                { label: "Last updated", value: formatDate(PRIVACY_UPDATED) },
                { label: "Applies to", value: "Website and platform" },
              ]}
            />
          </div>
          <article id="ord-privacy" className="w-[62%] max-lg:w-full">
            <Prose blocks={PRIVACY} />
          </article>
        </div>
      </section>
      <Cta />
    </main>
  );
};

export default page;
