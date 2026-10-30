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
  gardenTempo: 84, // its BPM
  gardenBeatVolume: 0.7, // its gentle beat (kick, clap, shaker)
  dimensionWarp: 1.0, // the music stretched through a vacuum as the worlds change
  pondVolume: 0.7, // the water stirred by the pointer (subtle)
  swooshVolume: 0.8, // the rush of air as the pointer stirs the particle body
  logoVolume: 0.7, // the particle logo gathering and settling
  siteDuck: 0.75, // how far all the sound drops going from the garden into the site's sections (0.75 = 75% quieter)
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
  crumbleSand: 6000, // grains of sand the broken rock turns into (capped by the quality tier)
  crumbleSize: 0.83,
  crumbleOpacity: 1.0,
  gravelCount: 4000, // gravel it turns into (capped by the quality tier)
  gravelSize: 1.47,
  gravelEmbers: 0.02, // share of the gravel that stays glowing embers
  gravelEmberGlow: 2.0, // ...how bright they glow
  sandBrightness: 0.19,

  // The garden
  innerGlow: 1.81, // the cube outline's inner light the camera flies into
  // the sky: clouds drifting across it
  skyCloudCover: 0.4, // how much of the sky they cover
  skyCloudSpeed: 0.4, // how fast they drift
  gardenSun: 5.0,
  gardenMoon: 1.9, // the moon's light on the garden at night
  gardenNightAmbient: 0.95, // ...and the cool sky light that keeps it readable
  // the garden camera's lens, relative to its composed shots (degrees)
  gardenFovOffset: 6.5,
  gardenOrbitRadius: 1.15, // the revolution round the pond: its radius (× the composed one)
  gardenOrbitHeight: 1.35, // ...and the camera's height on it (m, added)
  // the lawn: fine grass over the whole garden
  grassDensity: 1.0, // share of its blades drawn
  grassHeight: 0.62, // metres
  grassWidth: 0.01, // metres, at the root
  grassWind: 0.43, // how far the wind's waves bend it
  grassWindSpeed: 0.83, // ...and how fast they run
  grassWake: 0.94, // how hard the pointer pushes it over
  grassBrightness: 0.96,
  grassShadow: "#1f3814", // in the hollows and at the roots
  grassColor: "#446f22",
  grassHighlight: "#b4ec5a", // the slopes towards the light, the gusts' sheen
  grassGround: "#3f6a22", // the ground between the blades
  // flowers through the lawn: tulips, daisies, spires
  flowerDensity: 0.5, // share of them drawn (all three kinds)
  tulipDensity: 1.0, // ...and of each kind
  daisyDensity: 0.7,
  spireDensity: 0.44,
  flowerHeight: 0.75, // stem length (scaled with the grass's height too)
  flowerSize: 3.42, // bloom size
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
  treeBlossomShare: 1.0, // share of the trees in flower
  treeBlossomDensity: 1.0, // share of each tree's blossoms drawn
  treeBlossomSize: 2.0,
  treeBlossomPink: "#f5a9c4",
  treeBlossomWhite: "#f6ecec",
  treeBlossomRose: "#e2638f",
  treeBlossomLilac: "#b596e2",
  // the landscape: the pond's size (× the GLB's) and the ridges beyond the
  // clearing (their crests' height, m) are built into the garden, so the
  // garden is rebuilt when they change; the small mountains ringing it
  // (their height)
  pondSize: 2.22,
  gardenRidges: 9.6,
  gardenHummocks: 1.1, // metres: the soft mounds the ground rolls in
  gardenMountains: 1.21,
  // the pointer in the garden: grass and leaves part along its path,
  // bushes, plants and flowers glow where it passes
  gardenHoverRadius: 2.2, // metres: how wide a puff of the pointer's wind is
  gardenHoverStrength: 1.0, // how hard the pointer's wind blows (and a click's ripple)
  gardenHoverLinger: 0.9, // seconds its path takes to close up / fade
  gardenHoverSmooth: 0.08, // seconds the pointer's motion is smoothed over (higher = softer, lazier)
  gardenHoverWake: 0.3, // how much its wind spreads out behind it, frame to frame (a softer, wider wake)
  gardenWind: 1.0, // sway of grass, leaves and flowers
  gardenGlow: 1.0,
  gardenGlowRadius: 1.6,
  gardenGlowColor: "#ffb45c",
  // the pond
  pondReflect: 1.0, // how much of it is mirror
  pondDistortion: 0.2, // how much the surface breaks up the reflection
  pondCurrentSpeed: 2.24,
  pondCurrentScale: 4.0, // size of the current's ripples (higher = finer)
  pondRippleStrength: 2.02, // how strongly the pointer's rings show
  pondRippleForce: 1.36, // how big a ring the pointer drops
  pondRippleRadius: 0.8, // metres
  pondRippleDamping: 0.98, // how long they run (closer to 1 = longer)
  pondDeep: "#000000",
  pondShallow: "#01520d",
  pondClarity: 0, // opacity over the shallows
  // the bubble logo
  logoScale: 1.25, // the particle mark's size (1 = as modelled)
  logoParticleSize: 0.46, // bubble size
  logoParticleGlow: 1.12, // how bright they are
  logoSpecular: 0.61, // their glossy highlight
  logoRim: 0, // warm light round their edges
  logoColorA: "#ff5f00",
  logoColorB: "#ffac1f",
  logoColorC: "#ff7547",
  logoColorD: "#ff4300",
  logoMorphSpeed: 3.29, // forms per second once a section sets off a morph (higher = faster)
  logoMorphStagger: 0, // how spread out the bubbles' starts are (0 = all at once)
  logoGatherSpeed: 0.9, // how quickly the scattered bubbles are swept up into the mark (higher = quicker)
  logoGatherStagger: 0.4, // how spread out their lift-off is (a gust sweeping through rather than all at once)
  logoGatherWhirl: 5, // how many radians the whirlwind winds them round as it lifts them
  logoMorphPull: 15, // how hard a bubble far from its place is pulled there (higher = lands sooner)
  logoSpring: 60, // how firmly they hold their place (elasticity)
  logoDamping: 0.85, // how quickly their wobble dies (lower = more fluid drag)
  logoFlow: 0.67, // how much the flow churns them
  logoSwirlSpeed: 0.03, // the vortex's pace
  logoInfinitySpeed: 0.06, // loops a second its particles flow round the infinity
  logoInfinitySize: 6.8, // metres: the infinity's half-width
  logoInfinityTube: 1.4, // metres: its tube's radius
  logoHoverRadius: 0.1, // share of the screen's height round the pointer that it stirs
  logoHoverForce: 4.0, // ...how hard it parts them
  logoDrag: 2.84, // ...and how much they are carried along with its movement
  logoYaw: 0, // degrees the mark is turned (0 = square to the camera in its section)
  logoViscosity: 0.25, // how much each bubble takes on its neighbours' motion (fluid feel)
  logoRepulsion: 0.02, // how much they keep their distance
  logoScatterTime: 5.0, // seconds a stirred bubble drifts loose before finding its way home
  logoCoreGlow: 0, // the warm glow at the body's centre
  logoWhiteout: 0.71, // how white-hot stirred and fast bubbles burn
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
  breakSpin: 0.6, // how fast the streams carry it round
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
  streamRadius: 41.4, // metres: how far round the mark they loop
  streamTilt: 35, // degrees their loops lean towards the camera (0 = level, seen edge-on; 90 = facing it)
  streamWobble: 11.5, // degrees their loops keep tilting and turning by as they go
  streamHeight: 4.8, // metres they rise and fall on the way round
  streamTail: 0.67, // how long each stream's tail is (share of a turn)
  streamWidth: 8.9, // metres: how wide a stream spreads (wider towards its tail)
  streamLoose: 0.16, // share of the grains drifting loose all round
  // ...and the seconds the page takes to auto-scroll through it forwards
  // (core → forged logo), and back
  forgeDuration: 8.0,
  forgeReverse: 5.0,
  // through the cube outline's opening into the garden: from this far
  // along the run at the opening (share of it) the page carries the camera
  // through into daylight by itself (or back out), in this many seconds
  gapStart: 0.72,
  gapDuration: 1.5,
};

// Day / night switch shared by the header toggle and the panel: writes T
// and tells listeners (the panel keeps its checkbox in sync).
export const NIGHT_EVENT = "forging-concept:night";
export function setNight(on) {
  T.night = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: on }));
}
