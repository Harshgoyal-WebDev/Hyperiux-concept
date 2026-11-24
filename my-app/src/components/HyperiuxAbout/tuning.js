// Every look value of the /about experience (defaults: the client's tuning
// from the panel, 24 Nov 2026), live-tunable from the Leva
// panels (TuningPanel.jsx, shown with ?leva in the address). The scene reads
// these each frame; the few marked REBUILD rebuild their geometry when
// changed (an event, AboutScene listens).
export const A = {
  // ---- falling streaks (V3's streak shader)
  streakColor: "#ff711d",
  streakHot: "#ffd8c7",
  streakIntensity: 0.28,
  streakWidth: 0.45,
  streakFlow: 0.32,
  streakDashSpacing: 123,
  streakDashLength: 0.02,
  streakBase: 1.09,
  streakCount: 74, // REBUILD (desktop; phones take ~half)
  streakFallEnd: 0.73, // share of the fall over which they start coming down
  streakFootGlow: 0,

  // ---- centre beam: a bundle of fibres in along the ground, up into one column
  beamFibers: 105, // REBUILD
  beamReach: 45, // REBUILD how far out over the land the fibres reach, on average (m)
  beamColumn: 5.9, // REBUILD the column's radius (m)
  beamBend: 10.5, // REBUILD radius of the turn from the ground up into the column (m)
  beamHeight: 600, // REBUILD
  beamFiberWidth: 0.07, // REBUILD
  beamIntensity: 5.0,
  beamFlow: 0.24,
  beamStreakGlow: 0.22, // each fibre's own soft glow (the look it has up close, from far off too)
  beamStreakGlowPx: 4, // its width either side, in screen pixels
  beamPool: 1.1, // the light pooled on the land at its foot
  beamPoolRadius: 60, // REBUILD (m)

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
  parallaxX: 1.1,
  parallaxY: 0.15,
  parallaxEase: 3,
  heroParallaxX: 8, // the hero camera moved by the pointer (m)
  heroParallaxY: 2,

  // ---- team backdrop (no land: lines of light at every depth behind the person)
  teamLines: 130, // REBUILD (desktop)
  teamLineIntensity: 0.8,
  teamLineGlow: 0.3, // each line's soft glow
  teamLineGlowPx: 5, // its width either side, in screen pixels
  teamLineBehind: 0.7, // how much they dim behind the person (the face stays clear)
  teamLineColor: "#ff6a10",
  teamBackGlow: 1, // the warm haze behind the person (matched to the portraits' own)
  teamWaves: 0.5, // the faint waves of light low in the frame (0: none)
  teamMotes: 900, // REBUILD (desktop)
  teamMotesIntensity: 1,

  // ---- team portrait image (the source shown as it is, the strands over it)
  portraitImage: 1, // its opacity
  portraitFeather: 0.2, // how softly its sides blend into the backdrop
  portraitStrandRest: 0.3, // the strands' strength over it at rest (full while forming / changing)
  portraitFlowLight: 1, // light streaming down its lines
  portraitLightPass: 0.6, // a light passing across it now and then
  teamBloomIntensity: 0.55,
  teamBloomThreshold: 1.6,

  // ---- post
  bloomIntensity: 0.9,
  bloomThreshold: 1.05,
  vignette: 0.62,
};

export const REBUILD = new Set(["streakCount", "beamFibers", "beamReach", "beamColumn", "beamBend", "beamHeight", "beamFiberWidth", "beamPoolRadius", "motesCount", "portraitColumns", "teamLines", "teamMotes"]);
export const REBUILD_EVENT = "hyperiux-about:rebuild";
