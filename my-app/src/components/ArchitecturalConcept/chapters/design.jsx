import { reveal, seg, setO } from "../kit";
import { LAYERS } from "../world/looks";

// 04 DESIGN — the services become the design system: four layers of one
// page pulled apart (tokens, components, patterns, pages), then pressed
// back into the finished page, with the same system on tablet and mobile.
export const key = "design";
export const name = "Design";

export function dom(t, f, w) {
  const { els } = f;
  const lo = seg(t, 0.26, 0.32) * (1 - seg(t, 0.66, 0.72));
  LAYERS.forEach((_, k) => f.place(els[`l${k}`], w.panelPoint(k, 0.5, 0.42 - k * 0.04), lo, "translate(10px,-50%)"));
  const dv = seg(t, 0.76, 0.82) * (1 - seg(t, 0.95, 1));
  f.place(els.d0, w.panelPoint(3, -0.5, 0.5), dv, "translate(0,-130%)");
  f.place(els.d1, w.panelPoint(4, -0.5, 0.5), dv, "translate(0,-130%)");
  f.place(els.d2, w.panelPoint(5, -0.5, 0.5), dv, "translate(0,-130%)");
  const hp = seg(t, 0.5, 0.58); setO(els.hd, hp > 0 ? 1 - seg(t, 0.9, 0.95) : 0); reveal(els.hd, hp);
  setO(els.next, seg(t, 0.9, 0.95) * (1 - seg(t, 0.985, 1)));
}

export function Overlay() {
  return (
    <>
      {LAYERS.map((l, k) => <div key={l} className="ac-lbl ac-mono ac-design-layer" data-k={`l${k}`}><i />L{k + 1} · {l}</div>)}
      {["Desktop", "Tablet", "Mobile"].map((d, k) => <div key={d} className="ac-lbl ac-mono ac-design-dev" data-k={`d${k}`}>{d}</div>)}
      <div className="ac-design-hd" data-k="hd">
        <p className="ac-eb ac-mono">UI/UX design · Design systems</p>
        <h2 className="ac-hl"><span className="ln"><span>Design systems</span></span><span className="ln"><span>are <em>load-bearing.</em></span></span></h2>
        <p className="ac-design-sub ac-lede">One system of tokens, components and patterns, so every page and every screen size holds together.</p>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Design → Engineering ]</div>
    </>
  );
}
