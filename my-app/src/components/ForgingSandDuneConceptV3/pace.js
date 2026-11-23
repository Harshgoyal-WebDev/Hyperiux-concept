import { T } from "./tuning";

// The scroll's pace along the whole way, evened out: how much moves on
// screen per unit of scroll (p) at each point, measured — the camera's own
// motion across the frame (60%) and the picture's change, the effects and
// the transitions (40%) — once over the journey, smoothed, relative to the
// hero (1). Quiet stretches (the rock settled, the run-up to the opening)
// are a fraction of it; the valley 3–5×, the flight round the tree ~10×.
// The scroll moves at T.scrollPace ÷ this^T.paceEven, so the picture
// changes at one rate from start to end (paceEven 1) — or partly evened
// (0 = the same scroll speed everywhere). Sampled every 0.005 of p.
//
// (Measured with the ?debug page's __seek / __cam: screenshots and the
// camera at every 0.0025 / 0.001 of p. If the choreography changes a lot,
// measure it again.)
const DENSITY = [0.542,0.693,0.884,1.066,1.199,1.279,1.322,1.337,1.325,1.283,1.218,1.149,1.096,1.066,1.051,1.043,1.038,1.033,1.03,1.028,1.026,1.024,1.023,1.024,1.027,1.029,1.022,0.993,0.93,0.854,0.863,1.12,1.735,2.627,3.434,3.632,2.986,1.911,1.032,0.576,0.406,0.36,0.351,0.35,0.351,0.353,0.359,0.369,0.384,0.401,0.418,0.435,0.454,0.474,0.495,0.522,0.554,0.591,0.629,0.667,0.702,0.732,0.756,0.783,0.819,0.862,0.912,0.963,1.017,1.078,1.144,1.211,1.272,1.321,1.356,1.378,1.393,1.403,1.411,1.419,1.427,1.436,1.445,1.451,1.457,1.463,1.469,1.477,1.483,1.488,1.491,1.488,1.478,1.456,1.412,1.329,1.202,1.075,1.029,1.139,1.411,1.768,2.09,2.343,2.561,2.787,3.026,3.258,3.453,3.598,3.711,3.856,4.096,4.409,4.642,4.683,4.544,4.314,4.075,3.868,3.703,3.57,3.45,3.312,3.137,2.945,2.805,2.813,3.02,3.355,3.608,3.562,3.186,2.761,2.783,3.135,3.353,3.508,3.672,3.846,4.034,4.23,4.426,4.623,4.827,5.031,5.242,5.453,5.663,5.973,6.441,6.86,7.234,7.521,7.765,7.932,8.083,8.177,8.267,8.33,8.391,8.444,8.497,8.55,8.604,8.693,8.81,8.934,9.054,9.161,9.252,9.329,9.404,9.484,9.567,9.646,9.706,9.743,9.768,9.788,9.81,9.834,9.855,9.865,9.856,9.827,9.791,9.762,9.752,9.765,9.783,9.784,9.77,9.76,9.767,9.781,9.772,9.716,9.609,9.472,9.345];

export function densityAt(p) {
  const x = Math.min(Math.max(p, 0), 1) * (DENSITY.length - 1);
  const i = Math.min(Math.floor(x), DENSITY.length - 2);
  return DENSITY[i] + (DENSITY[i + 1] - DENSITY[i]) * (x - i);
}

// the scroll's speed here, × T.scrollPace
export const paceAt = (p) => Math.pow(densityAt(p), -T.paceEven);
