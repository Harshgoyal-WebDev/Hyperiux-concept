// How much the 3D scene does, by device: particle counts, pixel ratio and
// post-processing. Picked once on load (the hands are built for it).
export const TIERS = {
  high: { name: "high", particles: 46000, dpr: [1, 1.75], bloom: 1.1, chroma: true, dof: 1, handGain: 1.0, dust: 1100 },
  medium: { name: "medium", particles: 30000, dpr: [1, 1.5], bloom: 1.0, chroma: false, dof: 0.85, handGain: 1.1, dust: 700 },
  low: { name: "low", particles: 18000, dpr: [1, 1.5], bloom: 0.9, chroma: false, dof: 0.6, handGain: 1.25, dust: 380 },
};

export function pickTier() {
  const w = Math.min(window.innerWidth, window.screen?.width || window.innerWidth);
  const cores = navigator.hardwareConcurrency || 4;
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced && TIERS[forced]) return TIERS[forced];
  if (w >= 1100 && cores >= 6) return TIERS.high;
  if (w >= 700) return TIERS.medium;
  return TIERS.low;
}

export function hasWebGL2() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}
