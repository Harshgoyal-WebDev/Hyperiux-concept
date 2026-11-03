import { reveal, seg, setO } from "../kit";

// 02 RESEARCH — the cube comes down out of the mark and opens into its six
// facets: purpose, voice, audience, behaviour, visuals, market. Audience
// data lands round it and settles into the four Hyperiux lenses; insights
// pin to the facets they came from.
export const key = "research";
export const name = "Research";

const LENS = ["Emotion", "Design", "Technology", "Neuromarketing"];
const CALL = [[2, "HX-01.1 · Audience", "Who decides, and what they feel first"], [3, "HX-02.4 · Behaviour", "Where attention drops, and why"], [5, "HX-03.2 · Market", "What competitors already own"]];

export function dom(t, f, w) {
  const { els } = f;
  const lo = seg(t, 0.5, 0.56) * (1 - seg(t, 0.84, 0.9));
  w.lenses.forEach((p, k) => f.place(els[`lens${k}`], p, lo, "translate(-50%,-50%)"));
  const co = seg(t, 0.58, 0.64) * (1 - seg(t, 0.78, 0.84));
  setO(els.calls, co);
  if (co > 0) CALL.forEach(([fi], k) => {
    const [x, y] = f.project(w.panelPoint(fi, 0, 0)), card = els[`call${k}`].getBoundingClientRect();
    els[`lead${k}`].setAttribute("d", `M${x.toFixed(1)} ${y.toFixed(1)}L${(card.left - 26).toFixed(1)} ${(card.top + 34).toFixed(1)}L${card.left.toFixed(1)} ${(card.top + 34).toFixed(1)}`);
    els[`dot${k}`].setAttribute("cx", x.toFixed(1)); els[`dot${k}`].setAttribute("cy", y.toFixed(1));
  });
  const hp = seg(t, 0.64, 0.72); setO(els.hd, hp > 0 ? 1 - seg(t, 0.84, 0.88) : 0); reveal(els.hd, hp);
  setO(els.bio, seg(t, 0.78, 0.84) * (1 - seg(t, 0.94, 0.99)));
  setO(els.next, seg(t, 0.9, 0.95) * (1 - seg(t, 0.985, 1)));
}

const bionic = (s) => s.split(" ").map((wd, i) => { const k = Math.ceil(wd.length / 2); return <span key={i}><b>{wd.slice(0, k)}</b>{wd.slice(k)} </span>; });

export function Overlay() {
  return (
    <>
      {LENS.map((l, k) => <div key={l} className="ac-lbl ac-research-lens ac-mono" data-k={`lens${k}`}><i />{l}</div>)}
      <div className="ac-research-calls" data-k="calls">
        <svg className="ac-research-leads" aria-hidden="true">{CALL.map((_, k) => <g key={k}><path data-k={`lead${k}`} /><circle data-k={`dot${k}`} r="5" /></g>)}</svg>
        {CALL.map(([, h, d], k) => <div key={h} className="ac-research-call ac-panel" data-k={`call${k}`}><span className="ac-mono">{h}</span><p>{d}</p></div>)}
      </div>
      <div className="ac-research-hd" data-k="hd">
        <h2 className="ac-hl"><span className="ln"><span>Before we design a pixel,</span></span><span className="ln"><span>we <em>study the brand.</em></span></span></h2>
      </div>
      <div className="ac-research-bio" data-k="bio">
        <p>{bionic("We unravel complex design challenges through meticulous user research, expert analysis, prototyping and collaborative design.")}</p>
        <span className="ac-mono ac-hi">Bionic reading: the eye anchors on the first half of each word.</span>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Research → Strategy ]</div>
    </>
  );
}
