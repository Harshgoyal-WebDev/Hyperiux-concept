import { DUNES, OPENING_NOMINAL as O, P } from "../config";
import { RUN_ARRIVAL, brokenAt } from "../timeline";

// The flight on over the dunes, from the moment the camera is inside the
// mark (P.through) to the end of the journey: a pure function of the scroll,
// so every p maps to exactly one shot. It picks up exactly where the
// timeline's run at the opening leaves off — same position, aim, lens and
// speed (that run sets off from the still shot once the rock has ground to
// sand, and reaches the opening at RUN_ARRIVAL × its mean speed) — and
// carries straight on: out of the
// slab, down to cruising height, swaying gently from side to side over the
// crests towards the low sun, slowing once the land turns white; at the end
// it lifts and looks up into the white as the light opens onto the site.
// The beam (DuneBeam) and the pillars are laid out along the same line.
export const START_Z = 0.3;
const START_LOOK = 40.3; // the run's aim, at z -40
const START_DROP = 0.6;
const START_FOV = 44;
// metres travelled per unit of p, at cruising pace (the breakup's timing is
// live-tunable, and with it when the run sets off)
const speed = () => (RUN_ARRIVAL * (DUNES.runFrom - START_Z)) / (P.through - Math.min(brokenAt(), P.forged));

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// Distance flown past the opening at p (m). Full pace up to the whiteout, then
// the pace falls off linearly to DUNES.slowTo at the end.
export function flightDistance(p) {
  const s = Math.max(p - P.through, 0);
  const late = Math.max(p - P.pillars, 0);
  const slow = (1 - DUNES.slowTo) * (late * late) / (2 * (1 - P.pillars));
  return (s - slow) * speed();
}

// The flight line's sideways sway at a distance d along it. `sway` (0..1)
// is how far the weave has set in (it starts once clear of the slab); the
// beam and the pillars use the full weave, which the camera only reaches
// out over the open dunes.
export function weaveAt(d, sway = 1) {
  return O.x + DUNES.weave * sway * Math.sin((d / DUNES.weaveLength) * Math.PI * 2);
}
// world z of a distance along the line
export const lineZ = (d) => START_Z - d;
// how far the weave has set in at distance d (as the camera has it)
export const swayAtDistance = (d) => smooth(flightDistance(P.out), flightDistance(P.dunes), d);

export function duneCamera(p, pos, tgt) {
  const d = flightDistance(p);
  const clear = smooth(P.through, P.out, p); // out of the mark
  const settle = smooth(P.through, P.out + (P.dunes - P.out) * 0.5, p); // down to cruising height
  const sway = swayAtDistance(d);
  const lift = smooth(P.dissolve, 1, p); // up into the white at the end

  const y = lerp(O.y, DUNES.height + 2 * Math.sin(d / 190), settle) + 16 * lift;
  pos.set(weaveAt(d, sway), y, lineZ(d));

  const look = lerp(START_LOOK, DUNES.look, clear);
  const drop = lerp(lerp(START_DROP, DUNES.drop, clear), -6, lift);
  tgt.set(O.x + (weaveAt(d + look * 0.6, sway) - O.x) * 0.7, y - drop, lineZ(d) - look);

  return lerp(lerp(START_FOV, DUNES.fov, clear), DUNES.fov + 4, lift);
}

// Where the white spreads out from (world x, z): on the line, just ahead of
// the camera as the whiteout starts.
const WHITE_D = flightDistance(P.pillars) + DUNES.whiteAhead;
export const WHITE_POS = [weaveAt(WHITE_D), lineZ(WHITE_D)];
