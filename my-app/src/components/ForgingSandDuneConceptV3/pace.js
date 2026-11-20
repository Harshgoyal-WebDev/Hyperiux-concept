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
const DENSITY = [0.542,0.667,0.831,1.003,1.144,1.239,1.298,1.33,1.344,1.338,1.309,1.256,1.19,1.129,1.087,1.064,1.052,1.045,1.039,1.035,1.032,1.03,1.028,1.026,1.024,1.022,1.023,1.025,1.028,1.03,1.027,1.009,0.965,0.887,0.807,0.823,1.069,1.633,2.459,3.316,3.799,3.569,2.716,1.716,0.972,0.574,0.414,0.364,0.352,0.35,0.35,0.35,0.352,0.356,0.364,0.376,0.39,0.405,0.42,0.435,0.451,0.468,0.485,0.505,0.529,0.559,0.591,0.625,0.66,0.691,0.718,0.741,0.761,0.785,0.815,0.853,0.896,0.939,0.983,1.031,1.085,1.144,1.203,1.259,1.305,1.341,1.366,1.382,1.394,1.403,1.41,1.416,1.423,1.43,1.439,1.446,1.451,1.456,1.461,1.466,1.473,1.479,1.485,1.489,1.491,1.491,1.486,1.474,1.451,1.412,1.338,1.219,1.085,1.003,1.033,1.205,1.491,1.813,2.092,2.311,2.497,2.685,2.889,3.101,3.301,3.469,3.593,3.681,3.775,3.936,4.197,4.497,4.704,4.733,4.606,4.398,4.176,3.975,3.809,3.676,3.568,3.47,3.36,3.22,3.051,2.879,2.761,2.766,2.949,3.28,3.613,3.749,3.556,3.085,2.606,2.541,3.197,4.477,5.909,7.033,7.712,8.069,8.269,8.405,8.521,8.639,8.767,8.906,9.045,9.169,9.266,9.348,9.432,9.526,9.621,9.698,9.744,9.769,9.79,9.815,9.844,9.868,9.869,9.839,9.793,9.758,9.746,9.758,9.781,9.793,9.783,9.763,9.754,9.763,9.782,9.788,9.758,9.685,9.576,9.454,9.345];

export function densityAt(p) {
  const x = Math.min(Math.max(p, 0), 1) * (DENSITY.length - 1);
  const i = Math.min(Math.floor(x), DENSITY.length - 2);
  return DENSITY[i] + (DENSITY[i + 1] - DENSITY[i]) * (x - i);
}

// the scroll's speed here, × T.scrollPace
export const paceAt = (p) => Math.pow(densityAt(p), -T.paceEven);
