// Device capabilities, read once on the client.
//
// Two tiers. Mobile keeps the whole narrative but draws less: fewer
// particles, no post-processing, no shadows, a lower pixel ratio and a
// shorter scroll. ?t=55 pins the timeline at t=55 (for review and
// screenshots); ?tier=mobile forces the light tier. The Leva tuning panel
// shows in development, or anywhere with ?tune.

export const TONE_EVENT = "origin-forge:tone";

const TIERS = {
  desktop: { name: "desktop", dpr: 1.75, particles: 5200, particleSize: 1, post: true, shadows: true, reflections: true, textureSize: 256, vhPerUnit: 30 },
  mobile: { name: "mobile", dpr: 1.5, particles: 2000, particleSize: 1.25, post: false, shadows: false, reflections: false, textureSize: 256, vhPerUnit: 24 },
};

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch {
    return false;
  }
}

let cached = null;
export function readEnv() {
  if (cached) return cached;
  const q = new URLSearchParams(window.location.search);
  const small = window.matchMedia("(max-width: 820px)").matches || window.matchMedia("(pointer: coarse)").matches;
  const forced = q.get("tier");
  const t = parseFloat(q.get("t"));
  cached = {
    webgl: hasWebGL() && !q.has("static"),
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches && !q.has("motion"),
    tier: TIERS[forced] || (small ? TIERS.mobile : TIERS.desktop),
    debugT: Number.isFinite(t) ? Math.min(100, Math.max(0, t)) : null,
    tune: (process.env.NODE_ENV !== "production" || q.has("tune")) && !q.has("notune"),
  };
  return cached;
}
