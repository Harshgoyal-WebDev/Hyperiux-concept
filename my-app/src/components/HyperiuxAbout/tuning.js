// Every look value of the /about experience (defaults: the client's tuning
// from the panel, 24–25 Nov 2026), live-tunable from the Leva
// panels (TuningPanel.jsx, shown with ?leva in the address). The scene reads
// these each frame; the few marked REBUILD rebuild their geometry when
// changed (an event, AboutScene listens).
export const A = {
  // ---- the team's light colours (as its renders have them): its lines,
  // waves and dust read their colour off these by how bright they are
  lineGlow: "#371103", // its faint glow (measured off the renders' streaks)
  lineBody: "#7d2100", // its long tails
  lineBright: "#cd3802", // its bright run
  lineHot: "#ffb609", // its hot flare
  lineRampGain: 1.4, // how quickly a strand climbs the ramp with its brightness

  // ---- falling streaks (V3's streak shader) — and the centre beam's colours
  streakColor: "#ff711d",
  streakHot: "#ffd8c7",
  streakIntensity: 0.8,
  streakWidth: 0.45,
  streakFlow: 0.32,
  streakDashSpacing: 123,
  streakDashLength: 0.02,
  streakBase: 0.61,
  streakCount: 74, // REBUILD (desktop; phones take ~half)
  streakFallEnd: 0.8, // share of the fall over which they start coming down
  streakFootGlow: 0.69,

  // ---- centre beam: a bundle of fibres in along the ground, up into one column
  beamFibers: 105, // REBUILD
  beamReach: 53, // REBUILD how far out over the land the fibres reach, on average (m)
  beamColumn: 8, // REBUILD the column's radius (m)
  beamBend: 7, // REBUILD radius of the turn from the ground up into the column (m)
  beamHeight: 600, // REBUILD
  beamFiberWidth: 0.05, // REBUILD
  beamIntensity: 5,
  beamFlow: 0.3,
  beamStreakGlow: 0.84, // each fibre's own soft glow (the look it has up close, from far off too)
  beamStreakGlowPx: 3.5, // its width either side, in screen pixels
  beamPool: 4, // the light pooled on the land at its foot
  beamPoolRadius: 69, // REBUILD (m)

  // ---- terrain (the land of light)
  convertStart: 0.2,
  convertSpan: 0.59,
  terrainGlow: 1.63,
  terrainWisps: 2.01,
  terrainCrest: 0.48,
  terrainBase: "#0b0503",
  terrainColor: "#ff7c00",
  motesCount: 200000, // REBUILD (desktop)
  motesSize: 0.15,
  motesIntensity: 3.74,
  motesLift: 0.34,
  motesTwinkle: 0.69,

  // ---- blowing dust, once the land is light
  dustColor: "#ff5f00",
  dustLitBright: 1.6,
  dustLitGain: 1.3,

  // ---- rocks, by night and once the land is light
  rockNight: "#5a6684",
  rockNightBright: 0.35,
  rockLit: 0.12,

  // ---- ridge lines (from depth)
  ridgeIntensity: 0.49,
  ridgeCore: 0,
  ridgeHalo: 1.4,
  ridgeThreshold: 0.17,

  // ---- atmosphere
  skyDark: 0.97,
  horizonGlow: 0.55,
  hazeDensity: 0.0013,
  hazeColor: "#4e1a06",

  // ---- team portrait (V3 streaks in 3D)
  portraitColumns: 700, // REBUILD (desktop)
  portraitDepth: 0,
  portraitRelief: 0,
  portraitThickness: 0.18,
  portraitStrandWidth: 0.52,
  portraitIntensity: 1.44,
  portraitColor: "#ff5f00",
  portraitHot: "#ffe1d2",
  portraitDashSpacing: 1.5,
  portraitDashLength: 1.0,
  portraitFlow: 0.38,
  portraitBase: 0.37,
  parallaxX: 1.1, // the team camera moved round the portrait by the pointer (m)
  parallaxY: 0.15,
  // the team's scene coming in through the transition: where it starts, as
  // seen — to the right (m), lower (m, negative), turned (degrees) — settling
  // square as the transition completes
  teamEnterX: 0,
  teamEnterY: 0,
  teamEnterRoll: 0, // leaning (+: its right side lower)
  teamEnterPitch: 0, // its top towards the viewer
  teamEnterYaw: 0, // turned a little, its right side away
  teamEnterOpen: 0, // the portrait swinging back into place: it starts tipped out towards the viewer from its foot (degrees)
  parallaxEase: 3,
  teamPush: 0, // how far the team camera drifts in over the team's scroll (m) — none: the person never scales up
  teamBgTurn: 12, // how far the backdrop turns, horizontally, over the team's hold and the line clip (degrees; − the other way)
  teamAutoplay: 4, // seconds on each member before it moves on to the next (0: off)
  heroParallaxX: 8, // the hero camera moved by the pointer (m)
  heroParallaxY: 2,

  // ---- team backdrop (no land: lines of light at every depth behind the person)
  teamLines: 319, // REBUILD (desktop)
  teamLineIntensity: 1.05,
  teamLineGlow: 0.35, // each line's narrow glow (as the renders' streaks)
  teamLineGlowPx: 4, // how far it reaches either side, in screen pixels
  teamLineBehind: 0.3, // how much they dim behind the person (the face stays clear)
  teamBackGlow: 1, // the warm haze behind the person (matched to the portraits' own)
  teamBgDark: "#16100f", // the team's background, at its edges (the renders' own)
  teamBgWarm: "#3a241e", // ...and behind the person
  teamLineHeat: 1.14,
  teamVignette: 0.62, // the vignette in the team's section (the renders' own edges are barely darker) // how far the team's lines climb towards gold (× the ramp gain)
  teamWaves: 0.5, // the faint waves of light low in the frame (0: none)
  teamMotes: 900, // REBUILD (desktop)
  teamMotesIntensity: 1,
  teamMotesColor: "#ff6a10",

  // ---- team portrait image (the source shown as it is, the strands over it)
  portraitImage: 1, // its opacity
  portraitExposure: 1, // its brightness (1: as the render)
  portraitMotes: 1, // the fine motes drifting off the person
  portraitFeather: 0.2, // how softly its sides blend into the backdrop
  portraitStrandRest: 0.3, // the strands' strength over it at rest (full while forming / changing)
  portraitStreaksAround: 1, // the render's own streaks kept in a soft zone round the person (0: none)
  portraitFlowLight: 1, // light streaming down its lines
  portraitLightPass: 0.6, // a light passing across it now and then
  // ---- the person forming as the team's section opens: particles
  revealDelay: 0, // how far into the transition they start forming the person (share of it)
  teamCopyAt: 0.8, // how far into the transition the name, role and bio start coming in (share of it)
  teamCopyLength: 0.15, // ...and over how much of it
  revealFly: 0.35, // how long each particle is in flight (share of the forming)
  revealScatter: 0.26, // how far out round the person they come from
  revealLand: 0.95, // when the particles all land (share of the forming)
  revealBlend: 0.42, // how long they hand over to the lit image round the landing (share of the forming)

  // ---- the scroll flow, top to bottom (each in vh of real scroll; FLOW:
  // changing one rebuilds the timeline, and everything after it moves with it)
  flowHero: 199, // FLOW scene 1: the streaks falling, the land turning to light
  flowTransition: 126, // FLOW the transition into the team — the person forming out of particles with it
  flowTeamHold: 32, // FLOW with the team member, before the line clip starts
  flowClip: 140, // FLOW the line clip: the scene cut away line by line
  flowValuesLead: 62, // FLOW "Why partner with us?" — its top this far past the clip's start (smaller: pulled up further behind the scene)
  flowValuesDelay: 84, // FLOW ...and its own animations (heading, cards) starting this much later

  // ---- the point portrait (lit, after lusion.co/about's team)
  dotSize: 1, // the dots' size
  dotGain: 1.8, // their brightness
  dotAmbient: 0.07, // the light everywhere (the dark side never quite black)
  dotDiffuse: 1.7, // the key light
  dotRim: 0.6, // the light on the edges, where the surface turns away
  dotLightFollow: 0.8, // how far the key light follows the pointer
  dotColor: "#ff7a2a", // the dots' colour
  dotHot: "#ffe2c8", // ...where they're brightest
  dotBody: 0.92, // the person's dark body behind the dots (they stand in front of what's behind them)
  dotMorphSwirl: 0.6, // how far they arc out between one face and the next (m)

  // ---- changing member: the ripple
  swapDuration: 1.2, // the whole change (s)
  swapRing: 0.9, // how long the ring takes to run from the centre to the edges (share of the change)
  swapGap: 0.13, // how long each spot is particles before the next face is there (share)
  swapLiftZ: 0.8, // how far they lift towards the viewer (m)
  swapLiftOut: 0.48, // how far they open out from the centre (m)
  swapCalm: 0, // how still the centre stays (the eyes, the mouth), × the edges' lift
  portraitParticles: 70000, // REBUILD changing member: the particles it comes apart into (desktop)
  portraitParticleSize: 1,
  portraitShimmer: 0.3, // the particles' faint shimmer at rest
  portraitParticleDepth: 1.2, // how far the face stands out in depth (m): its depth map, or a rounded one from its outline
  portraitDepthInvert: false, // the depth map is black-near (Marigold) rather than white-near (Depth Anything)
  portraitParticleGlow: 0.6, // their glow in flight
  portraitParticleSpread: 1, // how far out they swirl
  teamBloomIntensity: 0.55,
  teamBloomThreshold: 1.6,

  // ---- into the light: the space brightening to white
  lightCream: "#e2b088", // the colour it brightens to before the white (a warm peach: the lines still show on it)

  // ---- the transition into the team (V3's bunq discs)
  transDir: 2, // which way the discs run: 0 up from the bottom, 1 down from the top, 2 out from the centre, 3 diagonally (bottom left → top right), 4 from the left, 5 from the right, 6 in from the edges, 7 at random
  transCellPx: 11, // the discs' spacing (px)
  transSpread: 3.2, // how long the band of growing discs is (higher: a softer, taller front)
  transJitter: 0.05, // how ragged the front is
  transOvershoot: 0.38, // how far past touching the discs grow (so they run together)
  transRefract: 4, // how strongly each glass disc bends the next shot
  transWobble: 0.1, // the fluid wobble of the picture round the discs' rims
  transBulge: 0.115, // how much the front rises in the middle (a dome)

  // ---- post
  bloomIntensity: 0.9,
  bloomThreshold: 1.05,
  vignette: 0.62,
};

export const REBUILD = new Set(["streakCount", "beamFibers", "beamReach", "beamColumn", "beamBend", "beamHeight", "beamFiberWidth", "beamPoolRadius", "motesCount", "portraitColumns", "teamLines", "teamMotes", "portraitParticles"]);
export const REBUILD_EVENT = "hyperiux-about:rebuild";
export const FLOW = new Set(["flowHero", "flowTransition", "flowTeamHold", "flowClip", "flowValuesLead", "flowValuesDelay"]);
export const FLOW_EVENT = "hyperiux-about:flow";
