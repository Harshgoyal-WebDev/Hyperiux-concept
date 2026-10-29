// Live-tunable look of the journey. The Leva panel (TuningPanel.jsx) writes
// straight into this object; the scene reads it every frame, so dragging a
// control never re-renders React. Defaults are the shipped look (art
// directed in the panel).
export const T = {
  // Audio (generated live; switched on from the header's Sound toggle)
  masterVolume: 0.8,
  musicVolume: 0.8, // the abyss: drone, pad, wind, bells
  musicTempo: 84, // BPM of the slow pulse
  pulseDepth: 0.35, // how much the pad breathes on each beat
  arpVolume: 0.6, // the quiet arpeggio
  bassVolume: 0.7, // soft bass on beats 1 and 3
  chordBars: 2, // bars per chord
  sandVolume: 0.6, // wind of sand while hovering the dunes
  beamVolume: 0.5, // the beam being drawn
  crackVolume: 0.7, // energy running through the cracks
  warpVolume: 0.8, // swell + boom as the excess rock breaks away
  impactVolume: 0.9, // the beam merging into the core + the shockwave
  breakVolume: 0.8, // the rock wearing away into sand and gravel
  swirlVolume: 0.6, // the sand and gravel sweeping round the mark
  lightVolume: 0.6, // the airy swell (a close-up opening, the light onto the site)
  vanishVolume: 0.6, // the score washing out at the end of the hero
  vanishStart: 0.97, // story time where the music starts to vanish
  vanishEnd: 1.0, // ...and is gone

  // Night mode: the sunset turns into a moonlit night (blends smoothly)
  night: false,
  moonIntensity: 1.6,
  moonColor: "#a9bcff",
  stars: 1.0,

  // Lighting & atmosphere (the sand-dune concept's sunset)
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

  // Slab & logo core (the GLB's baked basalt)
  fissureGlow: 1.4, // glow of the cracks and break lines
  crackSpread: 1.0, // how far it reaches (1 = every edge)
  engrave: 0.5, // darkness of the engraved outline of the mark
  crackGlow: 1.0, // lit crack strips
  crackColor: "#ff5f00", // all the forge's energy: beam, cracks, sphere
  sphereGlow: 1.0, // the core's point of light
  pocketHeat: 1.0, // orange light inside the rhombus around the sphere
  coreLight: 1.0, // the sphere's and the cracks' light on the stone and sand

  // Scattered rocks (procedural basalt)
  stoneColor: "#3a332e",
  stoneRoughness: 0.6,
  crackScale: 0.1,
  crackDepth: 0.30,

  // Impact as the beam merges into the core
  shockStrength: 1.0, // ridge and light wave running out across the dunes
  shockShake: 0.9, // metres of camera jolt
  edgeBlur: 0.8, // motion blur at the frame's edges through the forging event
  edgeChroma: 0.6, // ...and how far its colours split (chromatic aberration)

  // Sand
  sandColor: "#2c1000",
  rippleStrength: 1.5,

  // Beam
  trailIntensity: 2.98,
  beamFlow: 0.91, // pace of the dashes streaming along the strands
  beamStart: 0.68, // how far along its path the beam is already drawn at the hero (0..1)
  beamSpread: 0.54, // how wide the strand bundle opens (the gaps between strands)
  beamDashSpacing: 48.6, // metres between the bright dashes on a strand
  beamDashLength: 0.18, // share of that spacing each dash fills
  beamBase: 0.54, // glow of the strands between dashes

  // The swirl the broken rock turns into. Grain / dust counts are capped by
  // the quality tier.
  swirlSpeed: 0.99, // overall pace of the swirl
  crumbleSand: 6000, // grains of sand the broken rock turns into (capped by the quality tier)
  crumbleSize: 0.85,
  crumbleOpacity: 1.0,
  gravelCount: 4000, // gravel it turns into (capped by the quality tier)
  gravelSize: 0.98,
  sandCount: 1200, // fine soil shed into the swirl (capped by the quality tier)
  sandSize: 0.75,
  sandSpeed: 0.94,
  sandBrightness: 0.19,
  // the orbits it all revolves on (see world/swirl.js)
  orbitCount: 3, // how many orbits (1..8)
  orbitRadius: 36, // metres: the innermost orbit (below ~28 it can pass through the mark)
  orbitGap: 0, // metres between neighbouring orbits
  orbitThickness: 5.3, // metres: diameter of each orbit's tube (thin wire → thick band)
  orbitSpread: 0.23, // how far the particles fill in from the orbits towards the mark (0..1)
  orbitTilt: 1, // degrees added to every orbit's lean towards / away from the camera
  orbitRoll: 2, // ...its sideways roll
  orbitTurn: 16, // ...and its turn about the vertical
  // each orbit's own: lean, roll, turn (degrees), height (m), speed (rad/s,
  // negative = the other way round), squash (depth / width)
  orbit1Tilt: 12,
  orbit1Roll: 0,
  orbit1Turn: 0,
  orbit1Height: 2,
  orbit1Speed: 0.22,
  orbit1Squash: 0.55,
  orbit2Tilt: -10,
  orbit2Roll: 32,
  orbit2Turn: 6,
  orbit2Height: -2,
  orbit2Speed: -0.17,
  orbit2Squash: 0.55,
  orbit3Tilt: 18,
  orbit3Roll: -36,
  orbit3Turn: -6,
  orbit3Height: 4,
  orbit3Speed: 0.2,
  orbit3Squash: 0.62,
  orbit4Tilt: -6,
  orbit4Roll: 12,
  orbit4Turn: 4,
  orbit4Height: 9,
  orbit4Speed: 0.14,
  orbit4Squash: 0.45,
  orbit5Tilt: 20,
  orbit5Roll: -18,
  orbit5Turn: -4,
  orbit5Height: -9,
  orbit5Speed: -0.19,
  orbit5Squash: 0.58,
  orbit6Tilt: 4,
  orbit6Roll: 48,
  orbit6Turn: 10,
  orbit6Height: 0,
  orbit6Speed: 0.16,
  orbit6Squash: 0.5,
  orbit7Tilt: -16,
  orbit7Roll: -52,
  orbit7Turn: -10,
  orbit7Height: 6,
  orbit7Speed: -0.15,
  orbit7Squash: 0.52,
  orbit8Tilt: 8,
  orbit8Roll: 20,
  orbit8Turn: 0,
  orbit8Height: -5,
  orbit8Speed: 0.12,
  orbit8Squash: 0.48,

  // Past the mark, over the dunes
  beamLeadScale: 1.0, // how far ahead of the camera the beam runs (× DUNES.beamLead)
  pillarGlow: 1.0, // the rocks' glowing cracks (× the slab's)
  rockCrackSize: 22, // metres of rock the slab's crack pattern covers (top to bottom; the slab's scale)
  contourStrength: 0.95, // the dunes' contour lines on the white (1 = black)
  contourSpacing: 1.8, // metres of height between them
  ashSize: 1.0, // the sand the rocks turn into
  ashWind: 1.0, // ...how far the wind carries it

  // Post
  bloomIntensity: 1.07,
  bloomThreshold: 0.64,
  bloomRadius: 0.7,
  vignette: 0.8,

  // Mouse parallax
  parallax: 0.5, // how much the camera moves with the cursor
  parallaxDamping: 3.5,

  // Sand interaction
  stirRadius: 3.0,
  stirStrength: 3.0,
  lineWidth: 1.08, // width of the line drawn in the sand (metres)
  lineDepth: 0.07, // how deep the line reads
  lineMerge: 1.5, // seconds each part of the line takes to merge back into the sand after it is drawn (the trail itself is as long as the hover)
  grainOpacity: 3.0,
  grainSize: 3.0,
  grainColorDay: "#482100", // sand kicked up by the pointer, by day
  grainColorNight: "#25262e", // ...and in moonlight

  // Air
  dust: 3.0,

  // Forging event: when the excess rock breaks away, as shares of the event
  // (0 = the beam reaches the core, 1 = the forged logo); the crack glow
  // fills in over roughly the first 0.15
  breakStart: 0.1,
  breakEnd: 0.9,
  // ...and the seconds the page takes to auto-scroll through it forwards
  // (core → forged logo), and back
  forgeDuration: 4.5,
  forgeReverse: 3.0,
};

// Day / night switch shared by the header toggle and the panel: writes T
// and tells listeners (the panel keeps its checkbox in sync).
export const NIGHT_EVENT = "forging-sand-dune-concept:night";
export function setNight(on) {
  T.night = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: on }));
}
