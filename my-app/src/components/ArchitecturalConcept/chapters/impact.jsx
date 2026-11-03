import { clamp, eo, pad, reveal, seg, setO } from "../kit";
import { PROJECTS } from "../world/looks";

// 07 IMPACT — dawn. The sites rise into one wall, each tagged with its
// industry; traffic streams in from below; results (placeholder figures
// until real client metrics arrive) and the Patronum testimonial.
export const key = "impact";
export const name = "Impact";

const IND = [["Electronics", "Launches and configurators that make specs feel simple."], ["Fintech", "Experiences that simplify complexity, build trust and lift adoption."], ["Education", "Learning journeys that hold attention from first visit to enrolment."], ["Technology", "Clear stories for complex platforms, from SaaS to deep tech."], ["Banking", "Secure, accessible journeys from browsing to onboarding."]];

export function dom(t, f, w) {
  const { els } = f;
  const zi = clamp(Math.floor(seg(t, 0.12, 0.62) * 5), 0, 4), zo = seg(t, 0.1, 0.15) * (1 - seg(t, 0.6, 0.65));
  setO(els.panel, zo);
  els.num.textContent = pad(zi + 1); els.ind.textContent = IND[zi][0]; els.desc.textContent = IND[zi][1];
  [...els.list.children].forEach((li, j) => li.classList.toggle("on", j === zi));
  const to = seg(t, 0.1, 0.15) * (1 - seg(t, 0.9, 0.95));
  [...els.tags.children].forEach((e, j) => { f.place(e, w.panelPoint(j, -0.5, -0.5), to, "translate(0,-100%)"); e.classList.toggle("on", j === zi && zo > 0.5); });
  const gb = seg(t, 0.64, 0.69) * (1 - seg(t, 0.78, 0.82));
  setO(els.growth, gb);
  [0, 1, 2].forEach((i) => { els[`g${i}`].style.transform = `scaleY(${eo(seg(t, 0.65 + i * 0.02, 0.74 + i * 0.02)).toFixed(3)})`; });
  const qp = seg(t, 0.8, 0.86); setO(els.quote, qp > 0 ? 1 - seg(t, 0.94, 0.98) : 0); reveal(els.quote, qp);
  setO(els.next, seg(t, 0.92, 0.96) * (1 - seg(t, 0.985, 1)));
}

export function Overlay() {
  return (
    <>
      <div data-k="tags">{[...PROJECTS.map((p) => p[4]), "Your industry"].map((n) => <div key={n} className="ac-lbl ac-mono ac-impact-tag">{n}</div>)}</div>
      <aside className="ac-impact-panel ac-panel" data-k="panel">
        <span className="ac-mono ac-hi">Industries we work in</span>
        <div className="ac-impact-big"><b data-k="num">01</b> <span data-k="ind">Electronics</span></div>
        <p data-k="desc" />
        <ol data-k="list">{IND.map(([n], j) => <li key={n} className="ac-mono">{pad(j + 1)}  {n}</li>)}</ol>
      </aside>
      <aside className="ac-impact-growth ac-panel" data-k="growth">
        <span className="ac-mono ac-hi">Growth, measured</span>
        <div className="ac-impact-bars">{["Conversion", "Engagement", "Organic reach"].map((n, i) => <div key={n}><i data-k={`g${i}`} style={{ height: `${[56, 74, 100][i]}%` }} className={i === 2 ? "or" : ""} /><span className="ac-mono">{n} ↑</span></div>)}</div>
        <p className="ac-mono">Placeholder: live client metrics plug in here</p>
      </aside>
      <figure className="ac-impact-quote" data-k="quote">
        <span className="ac-impact-mark">“</span>
        <blockquote className="ac-hl"><span className="ln"><span>A website that not only</span></span><span className="ln"><span>captured our essence but</span></span><span className="ln"><span><em>transformed</em> our digital</span></span><span className="ln"><span>presence.</span></span></blockquote>
        <figcaption className="ac-mono">Paul Lees · CEO, Patronum</figcaption>
      </figure>
      <div className="ac-next ac-mono" data-k="next">[ Impact → Handover ]</div>
    </>
  );
}
