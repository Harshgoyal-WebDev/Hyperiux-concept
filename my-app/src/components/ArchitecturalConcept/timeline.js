import { clamp } from "./kit";

// One clock for the page: scroll position → T, 0 (start of Arrival) to 9
// (end of Handover), damped so the world eases after the scroll. Lenis (the
// app's root layout) already smooths the page; this adds the prototypes'
// weight. `#ch5` opens at a chapter, `#at-4.44` at an exact T, and
// `#pin-4.44` holds T there and ignores scroll (for headless screenshots).

export const CHAPTER_VH = 800; // scroll length of one chapter

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

export const timeline = {
  target: 0, cur: 0, mx: 0, my: 0, pinned: false,
  scroller: null, // set by the page: (y, opts) => lenis.scrollTo(y, opts)

  read() { if (this.pinned) return; this.target = clamp(window.scrollY / maxScroll()) * 9; },
  step(dt) {
    const k = reduced() ? 1 : 1 - Math.pow(1 - 0.08, dt * 60);
    this.cur += (this.target - this.cur) * k;
    if (Math.abs(this.target - this.cur) < 1e-5) this.cur = this.target;
    return this.cur;
  },
  goT(T, { immediate = false } = {}) {
    const y = (clamp(T, 0, 9) / 9) * maxScroll();
    const far = Math.abs(T - this.cur);
    if (this.scroller) this.scroller(y, { duration: Math.min(1.2 + far * 0.5, 3), immediate: immediate || reduced(), force: true });
    else window.scrollTo({ top: y, behavior: immediate || reduced() ? "auto" : "smooth" });
  },
  start() {
    const onScroll = () => this.read();
    const onMove = (e) => { this.mx = e.clientX / window.innerWidth - 0.5; this.my = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    const m = /^#(?:ch(\d)|at-([\d.]+)|pin-([\d.]+))$/.exec(window.location.hash);
    if (m && m[3]) { this.pinned = true; this.target = this.cur = clamp(+m[3], 0, 9); }
    else if (m) {
      const T = m[1] ? clamp(+m[1] - 1, 0, 8) : clamp(+m[2], 0, 9);
      requestAnimationFrame(() => { this.goT(T, { immediate: true }); this.target = this.cur = T; });
    } else this.read();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  },
};
