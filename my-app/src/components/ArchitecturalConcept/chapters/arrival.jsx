import { reveal, seg, setO } from "../kit";

// 01 ARRIVAL — the loader counts up over the mark's cube, alone, seen flat.
// The mark's outline is drafted round it, the four pieces arrive, and as the
// camera eases off the flat view the logo turns out to be a 3D object. It
// turns orange, the headline lands, and the camera moves in on the cube.
export const key = "arrival";
export const name = "Arrival";

export function dom(t, f) {
  const { els } = f, ld = 1 - seg(t, 0.33, 0.4), n = Math.round(seg(t, 0, 0.333) * 100);
  els.count.textContent = n >= 100 ? "100" : String(n).padStart(2, "0");
  setO(els.count, ld);
  els.ltext.textContent = t < 0.2 ? "Loading the experience…" : "Good things worth the wait!!";
  setO(els.ltext, ld);
  const hp = seg(t, 0.7, 0.8), hf = 1 - seg(t, 0.86, 0.9);
  setO(els.hero, hp > 0 ? hf : 0); reveal(els.hero, hp);
  setO(els.sub, seg(t, 0.78, 0.84) * hf);
  setO(els.final, seg(t, 0.9, 0.94) * (1 - seg(t, 0.985, 1)));
  setO(els.hint, 1 - seg(t, 0, 0.04));
}

export function Overlay() {
  return (
    <>
      <div className="ac-arrival-count" data-k="count">00</div>
      <div className="ac-arrival-ltext ac-mono" data-k="ltext">Loading the experience…</div>
      <div className="ac-arrival-hero" data-k="hero">
        <p className="ac-eb ac-mono">Digital experience design agency</p>
        <h1 className="ac-hl"><span className="ln"><span>Your brand,</span></span><span className="ln"><span>built to be</span></span><span className="ln"><span><em>experienced.</em></span></span></h1>
      </div>
      <div className="ac-arrival-sub" data-k="sub"><p>Emotion, design, technology and neuromarketing, engineered into one experience.</p><span className="ac-mono ac-hi">[ Scroll into the cube ]</span></div>
      <div className="ac-arrival-final ac-hl" data-k="final">Your brand is the cube.</div>
      <div className="ac-arrival-hint ac-mono" data-k="hint">Scroll to build ↓</div>
    </>
  );
}
