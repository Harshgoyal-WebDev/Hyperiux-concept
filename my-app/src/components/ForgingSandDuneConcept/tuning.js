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
  nightAmbient: 1.8, // ambient light at night, so the soil reads (fades in with the night)
  nightAmbientColor: "#8f8ea8",
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

  // Entering (after the loader)
  arriveDuration: 3.4, // seconds for the scene to come in from far off to the camera
  arriveDistance: 220, // how far back the camera starts (m, along its view)
  arriveLift: 46, // ...and how far up
  loaderReveal: 2.2, // seconds for the loader to open from the centre out to the edges
  revealWarp: 2.0, // the scene warped along the inside of the opening's edge
  revealBlur: 3.0, // ...smeared outwards (motion blur)
  revealChroma: 1.4, // ...and split into its colours

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
  crumbleSand: 1640, // grains of sand the broken rock turns into (capped by the quality tier)
  crumbleSize: 1.07,
  crumbleOpacity: 1.0,
  gravelCount: 1650, // gravel it turns into (capped by the quality tier)
  gravelSize: 1.79,
  gravelEmbers: 0.02, // share of the gravel that stays glowing embers
  gravelEmberGlow: 1.79, // ...how bright they glow
  sandBrightness: 0.19,

  // Past the mark: the oasis (scene/oasis)
  waterShallow: "#00535f", // the water over the sand
  waterDeep: "#000000", // ...where it is deep
  waterShore: "#102200", // wet sand under the very edge
  waterMirror: 1.2, // how much it mirrors (× fresnel)
  waterWaves: 0.41, // its small wind-driven waves
  waterRipple: 1.0, // the rings the cursor drops into it
  grassColor: "#336700", // the banks' grass, in the sand's shader
  soilColor: "#2a1305", // the darker soil where the oasis lives
  leafTint: "#5e8a4c", // the crown's leaves (× the atlas)
  leafGlow: 1.43, // leaves lit from behind by the low sun
  treeGlow: 1.0, // the tree's cracks, core and aura (× the timeline)
  treeAura: 0.0, // its amber aura and haze
  treeLight: 1.0, // the warm light it casts round it
  strandGain: 0.6, // the tree of light's filaments (additive: higher saturates the trunk)
  strandDim: 0.35, // ...where the light hasn't climbed to yet
  strandPulseSpeed: 0.25, // pace of the pulses running up them
  strandFill: -1, // where its light has climbed to (flow 0..1; -1 follows the scroll)
  embers: 1.0, // motes of light drifting up round the trunk
  oasisBeam: 1.0, // the beam past the mark (x trailIntensity)
  oasisBeamLead: 0.5, // how far ahead of the camera it runs (x 150 m)
  innerGlow: 1.8, // the forged logo's cube outline lit from within (the light in its openings)
  revealRing: 1.0, // the line of light the oasis rises behind
  cutGlass: 1.0, // the glass tiles of the cut from the logo: how much they bend the image
  cutChroma: 0.12, // ...and split its colours
  oasisStreamWidth: 1.6, // the oasis stream's width (x; the land is reshaped round it)
  eyePassage: 4.4, // the camera's height over the stream (m)
  eyeLake: 8.5, // ...and over the lake, coming in to the tree
  // the camera magnet, both scenes: the camera swings round a point ahead of it, towards the cursor
  magnet: 1.0, // overall amount (0 = off)
  magnetYaw: 8, // degrees left/right at the screen's edge
  magnetPitch: 4, // degrees up/down
  magnetBank: 1.6, // degrees of roll into the move
  magnetSwing: 2.4, // degrees of sway with the cursor's speed
  magnetEdge: 0.5, // 0 = even across the screen, 1 = mostly at the edges
  magnetDamping: 2.5, // how quickly it follows (lower = lazier, floatier)
  magnetReach: 55, // the point it swings round: metres ahead (at most)
  magnetDip: 1.2, // how far it may sink towards the water with the cursor low (m)
  foliage: 1.92, // the plants' brightness
  waterRippleRadius: 1.0, // the cursor's rings: size
  waterRippleDamping: 0.986, // ...how long they last
  waterRippleSpeed: 0.55, // ...how fast they spread

  // Post
  bloomIntensity: 1.07,
  bloomThreshold: 0.64,
  bloomRadius: 0.7,
  vignette: 0.8,

  // Sand interaction
  stirRadius: 3.0,
  stirStrength: 3.0,
  lineWidth: 1.08, // width of the line drawn in the sand (metres)
  lineDepth: 0.07, // how deep the line reads
  lineMerge: 1.5, // seconds each part of the line takes to merge back into the sand after it is drawn (the trail itself is as long as the hover)
  grainOpacity: 3.0,
  grainSize: 3.0,
  grainColorDay: "#482100", // sand kicked up by the pointer, by day
  grainColorNight: "#3f3f58", // ...and in moonlight

  // Air
  dust: 3.0,

  // The breakup on the scroll: vh of scrolling after the beam reaches the core
  // (the event is SCROLL_VH.event = 200 vh long: 200 = the forged logo).
  // These set the shares below every frame (timeline.js syncSequence).
  seqBreak: 20, // the rock breaks (the impact)
  seqImpactEnd: 41.6, // the impact's energy has dissipated
  seqBlastEnd: 38, // the blast has thrown the pieces out
  seqGatherStart: 48.8, // the pieces start to be drawn in towards the streams...
  seqGatherEnd: 155, // ...and are riding them
  seqSpinStart: 20, // the streams start to pick up speed...
  seqSpinEnd: 133.4, // ...and are up to full speed
  seqGrindStart: 20, // the pieces start to grind away into sand and gravel...
  seqGrindEnd: 108.2, // ...and are all sand: the auto-scroll hands back to the visitor here
  seqSandFlow: 108, // how long (vh) a grain takes to find its place in its stream
  seqBreakEnd: 200, // the breakup is over

  // The beam's run to the core
  beamAccel: 0.35, // how much it speeds up into the core (0 = an even pace all the way; 0.9 = it rushes the last stretch)
  cameraSettle: 0.12, // share of the run to the core the camera spends easing to a stop (lower = it keeps moving to the end)

  // Forging event: when the excess rock breaks away, as shares of the event
  // (0 = the beam reaches the core, 1 = the forged logo) — set from seqBreak
  // / seqBreakEnd above
  breakStart: 0.1,
  breakEnd: 1.0,
  // the pointer stirring the broken rock's sand and gravel
  breakStirForce: 4.0, // how far it pushes them
  breakStirRadius: 0.17, // how wide its reach is (share of the screen)
  breakStirLinger: 4.0, // seconds they take to ease back into their streams
  breakStirAlong: 0.69, // how much they are pushed along the pointer's motion...
  breakStirApart: 0, // ...and parted out from its line
  breakStirSmooth: 0.5, // seconds the pointer's motion is smoothed over (higher = softer, lazier)
  breakStirWake: 0.8, // how much the stir spreads out behind the pointer (a softer, wider wake)
  breakStirSpread: 0.46, // how unevenly the grains are pushed (0 = all alike: more fluid the higher)
  breakStirSand: 1.52, // how much the crumbled sand is stirred...
  breakStirGravel: 1.66, // ...and the gravel
  breakStirEase: 0.12, // how quickly the grains give way under the pointer (lower = they drift aside more gently)
  breakStirGlow: 0, // how much a stirred grain lights up (0 = not at all)
  breakImpact: 3.0, // how hard the blast hits: the shell of energy, the flare, the jolt
  breakSpread: 1.75, // how far the blast scatters the rock (× the streams' radius)
  breakSandShare: 0.55, // how much of each piece grinds into sand (1 = all of it; less leaves chunks riding round the mark)
  breakShrink: 0.43, // the pieces' size once broken off
  breakSpin: 0.26, // how fast the streams carry it round
  breakTumble: 0, // how fast the pieces tumble as they go
  // when each stage runs, as shares of the breakup (a piece's own progress)
  // — set from the seq values above
  breakBurstEnd: 0.12, // the impact's energy has dissipated
  breakBlastEnd: 0.1, // the blast has thrown the pieces out
  breakGatherStart: 0.16, // they start to be drawn in towards the streams...
  breakGatherEnd: 0.75, // ...and are riding them
  breakGather: 0.44, // how far the rocks themselves are drawn in (0 = they stay out where the blast threw them and grind away there; 1 = they ride the streams)
  breakSpinStart: 0, // the streams start to pick up speed...
  breakSpinEnd: 0.63, // ...and are up to full speed
  breakGrindStart: 0, // the pieces start to grind away into sand and gravel...
  breakGrindEnd: 0.49, // ...and are gone
  breakSandFlow: 0.6, // how long a grain takes to find its place in the stream
  // the streams of sand the broken rock is carried round the mark in
  streams: 2, // how many
  streamRadius: 32.3, // metres: how far round the mark they loop
  streamTilt: 51.5, // degrees their loops lean towards the camera (0 = level, seen edge-on; 90 = facing it)
  streamWobble: 0.0, // degrees their loops keep tilting and turning by as they go
  streamHeight: 0.0, // metres they rise and fall on the way round
  streamTail: 0.78, // how long each stream's tail is (share of a turn)
  streamWidth: 7.4, // metres: how wide a stream spreads (wider towards its tail)
  streamLoose: 0.06, // share of the grains drifting loose all round
  // ...and the seconds the page takes to auto-scroll through it forwards
  // (core → forged logo), and back
  forgeDuration: 8.0,
  forgeReverse: 5.0,
};

// Day / night switch shared by the header toggle and the panel: writes T
// and tells listeners (the panel keeps its checkbox in sync).
export const NIGHT_EVENT = "forging-sand-dune-concept:night";
export function setNight(on) {
  T.night = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: on }));
}
