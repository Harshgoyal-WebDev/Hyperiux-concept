// The mark.
//
// The official mark (public/hyperiux-icon-white.svg, viewBox 500 × 501),
// path for path: two verticals, two bridges (the mark's own diagonals) and
// the outlined centre cube. Used exactly as supplied: it is only ever drawn,
// placed and filled, never re-shaped (world/space.js finds the real cube
// its centre is a view of).
export const LOGO = {
  viewBox: [500, 501],
  verticalTL: "M40 13H106.261V222.826H40V13Z",
  verticalBR: "M459.654 487.869H393.394V278.043H459.654V487.869Z",
  bridgeBL: "M40.1406 278.043V487.869H106.401V322.217L198.062 287.983V223.931L40.1406 278.043Z",
  bridgeTR: "M393.527 178.653V13.0007H460.892V222.826L291.927 290.889V222.826L393.527 178.653Z",
  // the centre cube: its outline, then the three inner edges (one stroked
  // path in the original, split so it can be drawn edge by edge)
  cubeOutline:
    "M246.651 306.756L295.242 285.774C295.242 263.779 295.242 249.995 295.242 228L257.334 210.358C254.732 209.147 251.761 208.996 249.051 209.938L201.373 226.5V285.774L246.651 306.756Z",
  cubeInner: ["M201.373 226.5L246.651 249.33", "M295.242 228L246.651 249.33", "M246.651 249.33V306.756"],
  cubeStroke: 7,
};
