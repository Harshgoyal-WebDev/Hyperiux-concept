import { eo, reveal, seg, setO } from "../kit";

// 05 ENGINEERING — dusk into night. The screens turn to the code under
// them; the mark goes to its edges and its verticals light up as risers,
// sending data out to every screen. What holds the experience up.
export const key = "engineering";
export const name = "Engineering";

const ITEMS = [
  ["01", "Motion & WebGL", "Scroll-driven 3D, shaders and GSAP that load fast and degrade gracefully.", 0.18],
  ["02", "Performance", "Core Web Vitals budgets on every build, set before design starts.", 0.32],
  ["03", "Headless CMS", "Sanity and Strapi structures your team can edit without breaking the build.", 0.46],
  ["04", "Organic growth", "Technical SEO, schema and content architecture built into the frame.", 0.6],
];
const HUD = [["LCP", "< 2.0 s", 0.78], ["INP", "< 200 ms", 0.66], ["CLS", "< 0.05", 0.9], ["Lighthouse", "≥ 95", 0.95]];

export function dom(t, f) {
  const { els } = f, lf = 1 - seg(t, 0.78, 0.82);
  ITEMS.forEach(([, , , s], i) => {
    const a = seg(t, s, s + 0.05), cur = t < s + 0.14 || i === 3;
    setO(els[`i${i}`], a * lf * (cur ? 1 : 0.4));
  });
  const hud = seg(t, 0.32, 0.38) * (1 - seg(t, 0.78, 0.82));
  setO(els.hud, hud);
  HUD.forEach(([, , v], i) => { els[`b${i}`].style.transform = `scaleX(${(v * eo(seg(t, 0.34, 0.44))).toFixed(3)})`; });
  const hp = seg(t, 0.8, 0.87); setO(els.hd, hp > 0 ? 1 - seg(t, 0.94, 0.98) : 0); reveal(els.hd, hp);
  setO(els.next, seg(t, 0.92, 0.96) * (1 - seg(t, 0.985, 1)));
}

export function Overlay() {
  return (
    <>
      <ol className="ac-engineering-list">
        {ITEMS.map(([n, h, d], i) => <li key={n} data-k={`i${i}`} style={{ "--i": i }}><span className="ac-mono ac-or">{n}</span><div><h3>{h}</h3><p>{d}</p></div></li>)}
      </ol>
      <div className="ac-engineering-hud ac-panel" data-k="hud">
        <span className="ac-mono ac-or">Performance budget</span>
        {HUD.map(([a, b], i) => <div key={a} className="ac-engineering-row"><span className="ac-mono">{a}</span><span className="ac-mono">{b}</span><i><b data-k={`b${i}`} /></i></div>)}
      </div>
      <div className="ac-engineering-hd" data-k="hd">
        <h2 className="ac-hl"><span className="ln"><span>What you don’t see</span></span><span className="ln"><span><em>holds everything up.</em></span></span></h2>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Engineering → Work ]</div>
    </>
  );
}
