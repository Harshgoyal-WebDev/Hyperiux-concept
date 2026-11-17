// Live quality: on top of the device's tier (config.js TIERS, fixed at load),
// the frame-rate governor (scene/Governor.jsx) steps down through these
// levels whenever the scene can't hold its frame rate — an old laptop ends up
// smooth rather than lagging. Each step is cheap to apply as it runs: no
// scene is rebuilt, only resolution, passes and how much is drawn change.
//   dpr        – share of the device pixel ratio rendered (then scaled up)
//   post       – the bloom / edge blur / colour split passes
//   density    – share of the lawn's blades, the flowers and the blossoms
//   reflection – the pond's mirror (otherwise it reflects the sky alone)
//   clouds     – octaves of the sky's cloud noise
export const LEVELS = [
  { dpr: 1, post: true, density: 1, reflection: true, clouds: 5 },
  { dpr: 0.85, post: true, density: 1, reflection: true, clouds: 5 },
  { dpr: 0.85, post: false, density: 1, reflection: true, clouds: 5 },
  { dpr: 0.85, post: false, density: 0.6, reflection: false, clouds: 3 },
  { dpr: 0.7, post: false, density: 0.6, reflection: false, clouds: 3 },
  { dpr: 0.6, post: false, density: 0.35, reflection: false, clouds: 3 },
];

export const QUALITY_EVENT = "forging-concept:quality";

// the current level's settings (read every frame by the scene)
export const Q = { level: 0, ...LEVELS[0] };

export function setQualityLevel(level) {
  const l = Math.max(0, Math.min(level, LEVELS.length - 1));
  if (l === Q.level) return;
  Object.assign(Q, LEVELS[l], { level: l });
  window.dispatchEvent(new CustomEvent(QUALITY_EVENT, { detail: l }));
  // (?debug: say so, to see what a device settles on)
  if (new URLSearchParams(window.location.search).has("debug")) console.info(`[forging-concept] quality level ${l}`, LEVELS[l]);
}

// ?level=3 starts there (testing)
export function initialQualityLevel() {
  if (typeof window === "undefined") return 0;
  const l = parseInt(new URLSearchParams(window.location.search).get("level"), 10);
  if (Number.isFinite(l)) setQualityLevel(l);
  return Q.level;
}
