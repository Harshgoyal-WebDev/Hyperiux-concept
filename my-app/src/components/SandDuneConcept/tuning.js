// Live-tunable look of the journey. The Leva panel (TuningPanel.jsx) writes
// straight into this object; the scene reads it every frame, so dragging a
// control never re-renders React. Defaults are the shipped look (art
// directed in the panel).
export const T = {
  // Hero camera (state 01 pose; blends into the authored path as you scroll)
  heroCamPosition: { x: 0, y: 7, z: 155 },
  heroCamRotation: { x: 0, y: 0, z: 0 }, // degrees: pitch, yaw, roll
  heroFov: 45.9,

  // Audio (generated live; switched on from the header's Sound toggle)
  masterVolume: 0.8,
  musicVolume: 0.8, // the abyss: drone, pad, wind, bells
  musicTempo: 84, // BPM of the slow pulse
  pulseDepth: 0.35, // how much the pad breathes on each beat
  arpVolume: 0.6, // the quiet arpeggio
  bassVolume: 0.7, // soft bass on beats 1 and 3
  chordBars: 2, // bars per chord
  sandVolume: 0.6, // wind of sand while hovering the dunes
  beamVolume: 0.5, // the line being drawn
  crackVolume: 0.7, // glow filling the cracks
  warpVolume: 0.8, // warp field + boom as the cube breaks
  vanishVolume: 0.6, // the world blowing away at the end
  vanishStart: 0.775, // journey progress where the music starts to vanish
  vanishEnd: 0.975, // ...and is gone

  // Night mode: the sunset turns into a moonlit night (blends smoothly)
  night: false,
  moonIntensity: 1.6,
  moonColor: "#a9bcff",
  stars: 1.0,

  // Lighting & atmosphere
  exposure: 1.08,
  sunIntensity: 7.55,
  sunColor: "#ffb076",
  hemiIntensity: 0,
  hemiSky: "#8d99ad",
  hemiGround: "#6e3a1a",
  fillIntensity: 0,
  fillColor: "#ff5e00",
  envIntensity: 0.51,
  fogDensity: 0.0014,

  // Monolith
  stoneColor: "#3a332e",
  stoneRoughness: 0.6,
  crackScale: 3.0,
  crackDepth: 3.0,
  fissureGlow: 4.0,
  crackSpread: 1.0,
  crackStart: 0.04, // journey progress where the glow starts filling the cracks
  crackEnd: 0.25, // ...and has filled them
  glbEmissive: 0,
  crackColor: "#ff5f00", // glow inside the monolith's cracks

  // Monolith halves stay joined: gap between them in metres. Negative
  // overlaps them so their rough seam walls hide the joint.
  monolithGap: -0.6,

  // Sand
  sandColor: "#2c1000",
  rippleStrength: 1.5,

  // Cube
  cubeGlow: 3.0,
  glassOpacity: 2.0,
  edgeGlow: 4.0,
  coreGlow: 4.0,
  coreLight: 4.0,
  cubeSize: 1.19, // capped to what fits the joined opening
  cubeGrow: 1.15, // extra scale as the camera approaches
  cubeColor: "#ff5f00", // body glow of the cube, its beams and embers
  cubeHotColor: "#ffc890", // hottest highlights: edges, core, beam centres // × the authored cube edge

  // Energy release
  beamIntensity: 4.0,
  beamWidth: 0.2,
  glare: 4.0,
  waveIntensity: 3.0,
  fieldIntensity: 3.0,
  beamCount: 17,
  emberCount: 3660,

  // Break FX (edge stretch, motion blur, chromatic split)
  blurStrength: 0.7,
  chromatic: 1.39,
  sparkCount: 2850,
  shardCount: 307,
  streakCount: 0, // extra glowing particles hanging around the camera
  streakIntensity: 0.97,
  blurAtRest: 0, // share of the break blur kept when not scrolling
  breakStretch: 0, // cube pulled out towards the screen edges as it breaks
  edgeStretch: 0.81, // the frame's edges stretched outwards during the break
  // Flying through the core: its glare, beams and sparks fade out between
  // these distances (metres from the camera), so it never flashes white
  coreFadeNear: 3.1,
  coreFadeFar: 17.4,

  // Tunnel: particles along the camera's path from the break to the white-out
  tunnelCount: 900,
  tunnelRadiusMin: 4, // metres from the camera's path (keeps the lens clear)
  tunnelRadiusMax: 18, // how widely they spread out
  tunnelSize: 1.0,
  tunnelIntensity: 3.0,
  streakLength: 0.9, // how far particles stretch while scrolling

  // Scroll response (shared by tunnel streaks and motion blur). Speeds are
  // journey progress per second: ~0.01 is a slow scroll, ~0.05 a brisk one.
  scrollIntensityMin: 0.006, // below this nothing stretches
  scrollIntensityFull: 0.035, // full stretch / blur from here
  scrollAttack: 0.08, // seconds to build up when you start scrolling
  scrollRelease: 0.315, // seconds to settle back to points when you stop (ease-out)

  // Post
  bloomIntensity: 1.07,
  bloomThreshold: 0.64,
  bloomRadius: 0.7,
  vignette: 0.8,

  // Mouse parallax
  parallax: 1.0,
  parallaxDamping: 3.5,

  // Sand interaction
  stirRadius: 3.0,
  stirStrength: 3.0,
  lineWidth: 0.7, // width of the line drawn in the sand (metres)
  lineDepth: 1.0, // how deep the line reads
  lineMerge: 6, // seconds for the line to merge back into the sand
  grainOpacity: 3.0,
  grainSize: 0.45,
  grainColorDay: "#4e2400", // sand kicked up by the pointer, by day
  grainColorNight: "#25262e", // ...and in moonlight

  // Trail
  trailIntensity: 1.73,
  trailHalo: 0.13,
  trailLead: 0.59,

  // Air & ash
  dust: 3.0,
  ashSize: 0.64,
  ashWind: 3.0,

  // White state
  contourStrength: 0.95,
  contourSpacing: 1.26,
};

// Day / night switch shared by the header toggle and the panel: writes T
// and tells listeners (the panel keeps its checkbox in sync).
export const NIGHT_EVENT = "sand-dune-concept:night";
export function setNight(on) {
  T.night = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: on }));
}
