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
  lightVolume: 0.6, // the cube's inner light, and passing through it
  gardenVolume: 0.6, // water, leaves and birds
  gardenMusicVolume: 0.8, // the garden's own score (hopeful, unhurried, D major)
  gardenTempo: 70, // its BPM
  pondVolume: 0.7, // the water stirred by the pointer (subtle)
  swooshVolume: 0.8, // the rush of air as the pointer stirs the particle body
  logoVolume: 0.7, // the particle logo gathering and settling
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

  // The sand and gravel the broken rock turns into (counts are capped by the
  // quality tier).
  swirlSpeed: 0.99, // pace of the swirl's sound
  crumbleSand: 6000, // grains of sand the broken rock turns into (capped by the quality tier)
  crumbleSize: 0.83,
  crumbleOpacity: 1.0,
  gravelCount: 4000, // gravel it turns into (capped by the quality tier)
  gravelSize: 1.47,
  sandBrightness: 0.19,

  // The garden
  innerGlow: 1.81, // the cube outline's inner light the camera flies into
  gardenSun: 2.76,
  // the garden camera's lens, relative to its composed shots (degrees)
  gardenFovOffset: 0,
  gardenOrbitRadius: 1.0, // the revolution round the pond: its radius (× the composed one)
  gardenOrbitHeight: 0, // ...and the camera's height on it (m, added)
  // the lawn
  grassDensity: 1.0, // share of the blades drawn
  grassHeight: 2.19,
  grassWidth: 3.0,
  grassRoot: "#1f3a12",
  grassMid: "#3f6b22",
  grassTip: "#7fae3c",
  grassDry: "#b5a35a",
  grassTranslucency: 1.0, // the sun glowing through the blades when looking towards it
  // flowers through the lawn: tulips, daisies, spires
  flowerDensity: 1.0, // share of them drawn
  flowerHeight: 2.0, // stem length (scaled with the grass's height too)
  flowerSize: 1.6, // bloom size
  tulipRed: "#d8242f",
  tulipPink: "#f06aa0",
  tulipYellow: "#f5cf3a",
  tulipOrange: "#f2782a",
  tulipWhite: "#f4efe6",
  tulipPurple: "#7d3fa8",
  daisyColor: "#f7f3ec",
  spireLavender: "#8f6fd6",
  spireRose: "#e06aa8",
  // blossom on the trees (and its petals on the air)
  treeBlossomShare: 0.8, // share of the trees in flower
  treeBlossomDensity: 1.0, // share of each tree's blossoms drawn
  treeBlossomSize: 1.0,
  treeBlossomPink: "#f5a9c4",
  treeBlossomWhite: "#f6ecec",
  treeBlossomRose: "#e2638f",
  treeBlossomLilac: "#b596e2",
  // the landscape: the pond's size (× the GLB's) and the ridges beyond the
  // clearing (their crests' height, m) are built into the garden, so the
  // garden is rebuilt when they change; the small mountains ringing it
  // (their height)
  pondSize: 1.9,
  gardenRidges: 5,
  gardenMountains: 1.0,
  // the pointer in the garden: grass and leaves part along its path,
  // bushes, plants and flowers glow where it passes
  gardenHoverRadius: 2.2, // metres: how wide a puff of the pointer's wind is
  gardenHoverStrength: 1.0, // how hard the pointer's wind blows (and a click's ripple)
  gardenHoverLinger: 0.9, // seconds its path takes to close up / fade
  gardenWind: 1.0, // sway of grass, leaves and flowers
  gardenGlow: 1.0,
  gardenGlowRadius: 1.6,
  gardenGlowColor: "#ffb45c",
  // the pond
  pondReflect: 1.0, // how much of it is mirror
  pondDistortion: 0.04, // how much the surface breaks up the reflection
  pondCurrentSpeed: 1.0,
  pondCurrentScale: 1.2, // size of the current's ripples (higher = finer)
  pondRippleStrength: 1.0, // how strongly the pointer's rings show
  pondRippleForce: 1.0, // how big a ring the pointer drops
  pondRippleRadius: 0.8, // metres
  pondRippleDamping: 0.985, // how long they run (closer to 1 = longer)
  pondDeep: "#0b2a2c",
  pondShallow: "#3a5a3f",
  pondClarity: 0.45, // opacity over the shallows
  // the bubble logo
  logoParticleSize: 0.23, // bubble size
  logoParticleGlow: 1.66, // how bright they are
  logoSpecular: 2.91, // their glossy highlight
  logoRim: 0.65, // warm light round their edges
  logoColorA: "#ff5f00",
  logoColorB: "#ff8a1f",
  logoColorC: "#ffb347",
  logoColorD: "#d9400a",
  logoMorphSpeed: 3.2, // forms per second once a section sets off a morph (higher = faster)
  logoMorphStagger: 0.2, // how spread out the bubbles' starts are (0 = all at once)
  logoMorphPull: 5, // how hard a bubble far from its place is pulled there (higher = lands sooner)
  logoSpring: 9.5, // how firmly they hold their place (elasticity)
  logoDamping: 0.85, // how quickly their wobble dies (lower = more fluid drag)
  logoFlow: 0.67, // how much the flow churns them
  logoSwirlSpeed: 0.03, // the vortex's pace
  logoHoverRadius: 0.1, // share of the screen's height round the pointer that it stirs
  logoHoverForce: 1.0, // ...how hard it parts them
  logoDrag: 0.9, // ...and how much they are carried along with its movement
  logoYaw: 0, // degrees the mark is turned (0 = square to the camera in its section)
  logoViscosity: 0.25, // how much each bubble takes on its neighbours' motion (fluid feel)
  logoRepulsion: 0.02, // how much they keep their distance
  logoScatterTime: 1.6, // seconds a stirred bubble drifts loose before finding its way home
  logoCoreGlow: 0.6, // the warm glow at the body's centre
  logoWhiteout: 0.85, // how white-hot stirred and fast bubbles burn
  // the air: drifting leaves and warm motes
  gardenAir: 1.0,
  gardenLeafSize: 1.0,
  gardenMoteSize: 1.0,
  gardenEnvIntensity: 0.33, // sky light on the garden

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
  breakEnd: 1.0,
  breakImpact: 3.0, // how hard the blast hits: the shell of energy, the flare, the jolt
  breakSpread: 1.75, // how far the blast scatters the rock (× the streams' radius)
  breakShrink: 0.43, // the pieces' size once broken off
  breakSpin: 0.6, // how fast the streams carry it round
  breakTumble: 0, // how fast the pieces tumble as they go
  // when each stage runs, as shares of the breakup (a piece's own progress)
  breakBurstEnd: 0.12, // the impact's energy has dissipated
  breakBlastEnd: 0.1, // the blast has thrown the pieces out
  breakGatherStart: 0.2, // they start to be drawn in towards the streams...
  breakGatherEnd: 0.62, // ...and are riding them
  breakGather: 0.44, // how far the rocks themselves are drawn in (0 = they stay out where the blast threw them and grind away there; 1 = they ride the streams)
  breakSpinStart: 0, // the streams start to pick up speed...
  breakSpinEnd: 0.63, // ...and are up to full speed
  breakGrindStart: 0, // the pieces start to grind away into sand and gravel...
  breakGrindEnd: 0.49, // ...and are gone
  breakSandFlow: 0.6, // how long a grain takes to find its place in the stream
  // the streams of sand the broken rock is carried round the mark in
  streams: 2, // how many
  streamRadius: 41.4, // metres: how far round the mark they loop
  streamTilt: 35, // degrees their loops lean towards the camera (0 = level, seen edge-on; 90 = facing it)
  streamWobble: 11.5, // degrees their loops keep tilting and turning by as they go
  streamHeight: 4.8, // metres they rise and fall on the way round
  streamTail: 0.67, // how long each stream's tail is (share of a turn)
  streamWidth: 8.9, // metres: how wide a stream spreads (wider towards its tail)
  streamLoose: 0.16, // share of the grains drifting loose all round
  // ...and the seconds the page takes to auto-scroll through it forwards
  // (core → forged logo), and back
  forgeDuration: 7.0,
  forgeReverse: 4.5,
};

// Day / night switch shared by the header toggle and the panel: writes T
// and tells listeners (the panel keeps its checkbox in sync).
export const NIGHT_EVENT = "forging-concept:night";
export function setNight(on) {
  T.night = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: on }));
}
