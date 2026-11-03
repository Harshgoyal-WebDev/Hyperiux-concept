import { reveal, seg, setO } from "../kit";

// 08 HANDOVER — the six screens fold back into the cube, the cube settles
// into the mark, and the camera comes round to the flat logo: the page ends
// where it began. Contact details sit in a drawing title block.
export const key = "handover";
export const name = "Handover";

export function bind(els, f) {
  els.loop.onclick = () => f.goT(0);
}

export function dom(t, f) {
  const { els } = f;
  const ct = seg(t, 0.46, 0.54); setO(els.cta, ct); reveal(els.cta, ct);
  setO(els.hi, seg(t, 0.6, 0.66));
  setO(els.tb, seg(t, 0.74, 0.8));
  const lp = seg(t, 0.9, 0.95); setO(els.loop, lp); els.loop.style.pointerEvents = lp > 0.5 ? "auto" : "none";
}

export function Overlay() {
  return (
    <>
      <div className="ac-handover-cta" data-k="cta">
        <p className="ac-eb ac-mono">Let’s build yours</p>
        <h2 className="ac-hl"><span className="ln"><span>Let’s bring your</span></span><span className="ln"><span><em>ideas to life.</em></span></span></h2>
        <p className="ac-handover-sub">Your brand is the cube. We build the experience around it.</p>
      </div>
      <div className="ac-handover-hi" data-k="hi">
        <span className="ac-handover-pill ac-mono">Say Hi ↗</span>
        <div><span>hi@hyperiux.com</span><span>+91 8178 026 136</span></div>
      </div>
      <footer className="ac-handover-tb ac-panel" data-k="tb">
        <div className="ac-handover-cells">
          {[["Project", "Your brand — next"], ["Studio", "Hyperiux Immersion Labs"], ["Address", "A-40, Sector 62, Noida 201309"], ["Sheet", "08 / 08"], ["Year", "© 2026"]].map(([a, b]) => <div key={a}><span className="ac-mono">{a}</span><b className="ac-mono">{b}</b></div>)}
        </div>
        <div className="ac-handover-nav ac-mono"><span>About · Work · Expertise · Career · Resources · Contact · The Vault · Labs</span>
          <button type="button" className="ac-mono ac-handover-loop" data-k="loop">Back to the first sheet ↑</button></div>
      </footer>
    </>
  );
}
