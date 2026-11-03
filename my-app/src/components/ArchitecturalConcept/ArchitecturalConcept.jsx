"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useLenis } from "lenis/react";
import { CHAPTERS } from "./chapters";
import { logoSVG, pad } from "./kit";
import { CHAPTER_VH, timeline } from "./timeline";

// WebGL, in the browser only
const Stage = dynamic(() => import("./Stage"), { ssr: false });

// HYPERIUX — Your brand is the cube. We build the world around it.
// Nine chapters on one scroll (see HANDOFF.md in the repo root): Arrival,
// Survey, Blueprint, Structure, Material, Systems, District, Occupancy,
// Handover — one camera through one day, day → dusk → night → dawn → day.
// The page is a tall spacer under fixed layers: a CSS sky, the WebGL stage,
// each chapter's DOM overlay (copy, cards, projected labels), a wash that
// covers the change of scene between chapters, and the site chrome.
export default function ArchitecturalConcept() {
  const rootRef = useRef(null);
  const lenis = useLenis();

  useEffect(() => {
    timeline.scroller = lenis ? (y, o) => lenis.scrollTo(y, o) : null;
  }, [lenis]);

  return (
    <div ref={rootRef} className="ac-root">
      <div className="ac-sky" data-sky="" />
      <Stage rootRef={rootRef} />
      <div className="ac-vig" />
      <div className="ac-grain" />

      {CHAPTERS.map(({ key, Overlay }, i) => (
        <section key={key} className={`ac-ch ac-${key}`} data-ch={i} data-on="false" aria-label={CHAPTERS[i].name}>
          <Overlay />
        </section>
      ))}

      <div className="ac-wash" data-wash="" />

      <header className="ac-top">
        <svg viewBox="0 0 240 240" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logoSVG("transparent") }} />
        <span className="ac-mono ac-b">Hyperiux</span>
        <span className="ac-mono ac-c" data-chap="">01 / Arrival</span>
        <span className="ac-sp" />
        <span className="ac-mono ac-hide-s">Menu</span>
        <span className="ac-mono ac-pill">Start a project</span>
      </header>

      <nav className="ac-strip" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <button key={c.key} type="button" data-go={i} onClick={() => timeline.goT(i + 0.02)} aria-label={`Chapter ${i + 1}: ${c.name}`}>
            <span className="ac-bar"><i data-bar="" /></span>
            <span className="ac-lab">{pad(i + 1)}<span className="ac-t"> {c.name}</span></span>
          </button>
        ))}
        <span className="ac-pct" data-pct="">0%</span>
      </nav>

      <div aria-hidden="true" style={{ height: `${9 * CHAPTER_VH}vh` }} />
    </div>
  );
}
