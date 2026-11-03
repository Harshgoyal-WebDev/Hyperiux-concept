import { clamp, pad, reveal, seg, setO } from "../kit";
import { SERVICES } from "../world/looks";
import { CONVERSION } from "../world/world";

// 03 STRATEGY — the six facets stand up as the six strategy services, laid
// along the mark's own beam: a user flow that climbs from the first insight
// to conversion. The spec card walks the services as you scroll; any
// marker opens its own.
export const key = "strategy";
export const name = "Strategy";

export function bind(els, f, w, st) {
  st.user = null;
  els.markers.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) st.user = +b.dataset.i; });
  els.prev.onclick = () => { st.user = ((st.user ?? st.auto ?? 0) + 5) % 6; };
  els.next2.onclick = () => { st.user = ((st.user ?? st.auto ?? 0) + 1) % 6; };
}

export function dom(t, f, w, st) {
  const { els } = f;
  const mo = seg(t, 0.28, 0.34) * (1 - seg(t, 0.88, 0.94));
  [...els.markers.children].forEach((b, i) => { f.place(b, w.panelPoint(i, -0.5, 0.5), mo, "translate(-50%,-50%)"); b.style.pointerEvents = mo > 0.5 ? "auto" : "none"; });
  f.place(els.uf, w.panelPoint(0, -0.5, -0.5), seg(t, 0.2, 0.26) * (1 - seg(t, 0.88, 0.94)), "translate(0,8px)");
  f.place(els.conv, CONVERSION, seg(t, 0.38, 0.42) * (1 - seg(t, 0.88, 0.94)), "translate(-50%,-140%)");
  if (t < 0.3 || t > 0.95) st.user = null;
  st.auto = clamp(Math.floor(seg(t, 0.42, 0.84) * 6), 0, 5);
  const sel = st.user ?? st.auto, co = seg(t, 0.4, 0.46) * (1 - seg(t, 0.86, 0.9));
  if (st.shown !== sel) {
    st.shown = sel; const s = SERVICES[sel];
    els.no.textContent = `${pad(sel + 1)} / 06`; els.title.textContent = s[0]; els.body.textContent = s[1];
    els.list.innerHTML = s[2].map((x) => `<li>${x}</li>`).join("");
  }
  [...els.markers.children].forEach((b, i) => b.classList.toggle("on", i === sel && co > 0.5));
  setO(els.card, co); els.card.style.pointerEvents = co > 0.5 ? "auto" : "none";
  const hp = seg(t, 0.56, 0.64); setO(els.hd, hp > 0 ? 1 - seg(t, 0.9, 0.95) : 0); reveal(els.hd, hp);
  setO(els.next, seg(t, 0.9, 0.95) * (1 - seg(t, 0.985, 1)));
}

export function Overlay() {
  return (
    <>
      <div data-k="markers">{SERVICES.map((s, i) => <button key={s[0]} type="button" data-i={i} className="ac-lbl ac-strategy-mk" aria-label={`Service ${i + 1}: ${s[0]}`}>{pad(i + 1)}</button>)}</div>
      <div className="ac-lbl ac-mono ac-strategy-tag" data-k="uf">User flow →</div>
      <div className="ac-lbl ac-mono ac-strategy-tag" data-k="conv">Conversion ●</div>
      <aside className="ac-strategy-card ac-panel" data-k="card" aria-live="polite">
        <div className="ac-strategy-cardhd"><span className="ac-mono" data-k="no">01 / 06</span><span />
          <button type="button" data-k="prev" aria-label="Previous service">←</button><button type="button" data-k="next2" aria-label="Next service">→</button></div>
        <div className="ac-strategy-cardbd"><h3 data-k="title">UI Design Strategy</h3><p data-k="body" /><ul data-k="list" /><span className="ac-strategy-go ac-mono">View service →</span></div>
      </aside>
      <div className="ac-strategy-hd" data-k="hd">
        <p className="ac-eb ac-mono">From concept to conversion</p>
        <h2 className="ac-hl"><span className="ln"><span>Strategy is</span></span><span className="ln"><span>the <em>blueprint.</em></span></span></h2>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Strategy → Design ]</div>
    </>
  );
}
