import { KEYS } from "./layout";

// The camera's keys as channels, interpolated by monotone cubic (PCHIP):
// smooth through every key, and flat (no overshoot) wherever two keys hold
// the same value, so the mark's view is held exactly while it is held. The
// lens and the framing are interpolated in log space (a dolly zoom from 34°
// to 0.6° is even all the way).
const CH = ["tx", "ty", "tz", "yaw", "pitch", "size", "fov", "sx", "sy", "mx", "my"];
const T = KEYS.map((k) => k.t);
const V = KEYS.map((k) => [k.target[0], k.target[1], k.target[2], k.yaw, k.pitch, Math.log(k.size), Math.log(k.fov), k.sx ?? 0, k.sy ?? 0, k.mx ?? 0, k.my ?? 0]);

const slopes = CH.map((_, c) => {
  const n = T.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((V[i + 1][c] - V[i][c]) / (T[i + 1] - T[i]));
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const h0 = T[i] - T[i - 1];
      const h1 = T[i + 1] - T[i];
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  // the ends: no overshoot either
  if (d[0] === 0) m[0] = 0;
  if (d[n - 2] === 0) m[n - 1] = 0;
  return m;
});

const out = {};
export function cameraAt(t) {
  const n = T.length;
  let i = 0;
  if (t <= T[0]) i = 0;
  else if (t >= T[n - 1]) i = n - 2;
  else while (i < n - 2 && t > T[i + 1]) i++;
  const h = T[i + 1] - T[i];
  const u = Math.min(Math.max((t - T[i]) / h, 0), 1);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  CH.forEach((c, k) => {
    out[c] = h00 * V[i][k] + h10 * h * slopes[k][i] + h01 * V[i + 1][k] + h11 * h * slopes[k][i + 1];
  });
  out.size = Math.exp(out.size);
  out.fov = Math.exp(out.fov);
  return out;
}
