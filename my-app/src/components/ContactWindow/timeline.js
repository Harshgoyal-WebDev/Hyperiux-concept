import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// The Window's six stages, as shares of the pinned scroll (they must add up
// to 1). Retime the whole experience here: everything else reads the stage
// progresses (0 → 1 each) the master timeline drives.
//   01 distance      – the two hands far apart, alive
//   02 approach      – both moving in towards the middle, the index reaching
//   03 anticipation  – the fingertips a breath apart, the light gathering
//   04 touch         – the last of the reach: the fingertips meet as it ends
//   05 portal        – from the moment they collide, all from the one point:
//                      a flash, a shockwave running
//                      back through both hands, and the portal opening out
//                      from the touch — discs of glass spreading across the
//                      frame, the contact page beneath showing through
//   06 contact       – the page fully open, held a moment before it scrolls
export const STAGES = [
  { key: "distance", label: "Distance", share: 0.04 },
  { key: "approach", label: "Approach", share: 0.21 },
  { key: "anticipation", label: "Anticipation", share: 0.15 },
  { key: "touch", label: "Touch", share: 0.14 },
  { key: "portal", label: "Portal", share: 0.4 },
  { key: "contact", label: "Contact", share: 0.06 },
];

// The pinned scroll's length (in viewport heights), and the page's whole
// track: the pinned scroll plus the stage's own screen.
export const PIN_VH = 800;
export const TRACK_VH = PIN_VH + 100;

export function createStageState() {
  const s = { p: 0 };
  for (const st of STAGES) s[st.key] = 0;
  return s;
}

// The master timeline: one tween per stage, back to back, each labelled; the
// scroll scrubs it (reversible). `onUpdate` runs with each change.
export function buildMasterTimeline({ trigger, end = "bottom bottom", state, onUpdate, reduced = false }) {
  gsap.registerPlugin(ScrollTrigger);
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger,
      start: "top top",
      end,
      scrub: reduced ? true : 1.2,
      invalidateOnRefresh: true,
    },
    onUpdate: () => {
      state.p = tl.progress();
      onUpdate?.(state);
    },
  });
  let at = 0;
  for (const st of STAGES) {
    tl.addLabel(st.key, at);
    tl.to(state, { [st.key]: 1, duration: st.share }, at);
    at += st.share;
  }
  return tl;
}

export const stageAt = (p) => {
  let at = 0;
  for (let i = 0; i < STAGES.length; i++) {
    at += STAGES[i].share;
    if (p < at - 1e-6) return i;
  }
  return STAGES.length - 1;
};
