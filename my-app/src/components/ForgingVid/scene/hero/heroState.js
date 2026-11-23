import { CUT_TO, P, eventAt } from "../../config";
import { T } from "../../tuning";

// The hero's dressing (the orbital ring, the floating fragments, the dunes'
// energy veins, the slab's ember glow) belongs to the opening shot and the
// beam's run to the core. As the beam merges into the core, the blast
// carries it all off: `heroBlast` runs 0 → 1 from P.core to a little way into
// the event, `heroOn` is what is left of it (1 → 0).
export function heroBlast(p) {
  const a = P.core;
  const b = eventAt(0.09);
  const x = Math.min(Math.max((p - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
}
export const heroOn = (p) => 1 - heroBlast(p);

// The light on the desert itself (the crests' rim light, the ground haze,
// the ruins' contact shadows on the sand) stays through the logo shots and
// fades as the camera runs at the mark's opening: the oasis beyond the cut
// (the same sand) keeps its own look.
export function desertOn(p) {
  const x = Math.min(Math.max((p - P.held) / (P.pass - P.held), 0), 1);
  return 1 - x * x * (3 - 2 * x);
}

// The valley's sunset scenes (scene/valley): from the cut into the valley
// (the canyon, then the open desert and the orb) until the oasis starts to
// come to life (T.tlRevealStart): its dressing and its light on the sand.
export function valleyOn(p) {
  const s = (x) => x * x * (3 - 2 * x);
  const a = s(Math.min(Math.max((p - CUT_TO()) / 0.02, 0), 1));
  const b = s(Math.min(Math.max((p - (T.tlRevealStart - 0.04)) / 0.04, 0), 1));
  return a * (1 - b);
}

// Visitors who ask for less motion get the dressing held still.
let reduced = null;
export function reducedMotion() {
  if (reduced === null) reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced;
}
