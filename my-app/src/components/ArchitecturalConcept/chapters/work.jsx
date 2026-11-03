import { clamp, pad, reveal, seg, setO } from "../kit";
import { PROJECTS } from "../world/looks";
import { WORK_STOPS } from "../world/world";

// 06 WORK — night. The code becomes the sites it runs: five projects (and
// a sixth screen for the next brand) set out along the beam's rise. The
// camera stops at each one; visitors arrive; click a screen to go to it.
export const key = "work";
export const name = "Work";

export function bind(els, f, w, st) {
  let down = null;
  f.canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  f.canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || Math.floor(w.T) !== 5) return;
    const j = w.pick(e, f); if (j >= 0) f.goT(5 + WORK_STOPS[j]);
  });
  els.prev.onclick = () => f.goT(5 + WORK_STOPS[((st.j ?? 0) + 5) % 6]);
  els.nxt.onclick = () => f.goT(5 + WORK_STOPS[((st.j ?? 0) + 1) % 6]);
}

export function dom(t, f, w, st) {
  const { els } = f;
  let co = 0, cj = 0;
  WORK_STOPS.forEach((s, j) => { const o = clamp((0.07 - Math.abs(t - s)) / 0.03); if (o > co) { co = o; cj = j; } });
  st.j = cj;
  if (st.shown !== cj) {
    st.shown = cj;
    const p = PROJECTS[cj];
    els.no.textContent = `[${pad(cj + 1)}/06]`;
    els.yr.textContent = p ? p[1] : "Next";
    els.name.textContent = p ? p[0] : "Your brand";
    els.tags.textContent = p ? p[2] : "Strategy · Design · Engineering";
    els.body.textContent = p ? "One-of-a-kind experiences that captivate and engage your customers. Screen shows a mock-up." : "Six faces of your brand, built into one experience. This screen is yours.";
    els.go.firstChild.textContent = p ? "View project " : "Start a project ";
  }
  setO(els.card, co); els.card.style.pointerEvents = co > 0.5 ? "auto" : "none";
  els.card.style.transform = `translateY(${((1 - co) * 20).toFixed(1)}px)`;
  const lb = (1 - seg(t, 0.12, 0.16)) * seg(t, 0.02, 0.06) + seg(t, 0.9, 0.94);
  [...els.labels.children].forEach((e, j) => f.place(e, w.panelPoint(j, 0, 0.5), Math.min(1, lb), "translate(-50%,-130%)"));
  setO(els.intro, seg(t, 0.02, 0.06) * (1 - seg(t, 0.13, 0.17)));
  const hp = seg(t, 0.9, 0.95); setO(els.hd, hp > 0 ? 1 - seg(t, 0.985, 1) : 0); reveal(els.hd, hp);
}

export function Overlay() {
  return (
    <>
      <div data-k="labels">{[...PROJECTS.map((p) => p[0]), "Your brand"].map((n, j) => <div key={n} className="ac-lbl ac-mono ac-work-lbl"><span>{pad(j + 1)} {n}</span><i /></div>)}</div>
      <div className="ac-work-intro" data-k="intro"><p className="ac-eb ac-mono">Selected work</p><h2 className="ac-hl"><span>Five live sites.</span><br /><span>One way of working.</span></h2><p>Scroll to visit each one, or click a screen.</p></div>
      <aside className="ac-work-card" data-k="card" aria-live="polite">
        <div className="ac-work-r1"><span className="ac-mono ac-work-no" data-k="no">[01/06]</span><span className="ac-mono" data-k="yr">2023</span></div>
        <h3 data-k="name">Montra</h3>
        <div className="ac-mono ac-work-tags" data-k="tags" />
        <p data-k="body" />
        <div className="ac-work-r2"><span className="ac-mono ac-work-go" data-k="go">View project <b>↗</b></span><span />
          <button type="button" data-k="prev" aria-label="Previous project">←</button><button type="button" data-k="nxt" aria-label="Next project">→</button></div>
      </aside>
      <div className="ac-work-hd" data-k="hd"><p className="ac-eb ac-mono">Selected work (05)</p><h2 className="ac-hl"><span className="ln"><span>View all</span></span><span className="ln"><span>projects <em>↗</em></span></span></h2></div>
    </>
  );
}
