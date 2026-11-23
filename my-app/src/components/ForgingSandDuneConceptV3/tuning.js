// Live-tunable look of the journey. The Leva panel (TuningPanel.jsx) writes
// straight into this object; the scene reads it every frame, so dragging a
// control never re-renders React. Defaults are the shipped look (art
// directed in the panel).
export const T = {
  // Audio (generated live; switched on from the header's Sound toggle)
  masterVolume: 0.8,
  musicVolume: 0.8, // the abyss: drone, pad, wind, bells
  natureVolume: 0.9, // the light nature score the music turns into as the tree grows
  natureTempo: 66, // ...its pace (BPM of its quarter notes)
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
  vanishStart: 0.9741, // story time where the music starts to vanish
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
  rockTint: "#b3a89c", // the Blender rocks (public/models/rocks.glb): a tint over their baked colour (white = as baked)
  stoneColor: "#5e5044", // the rocks (after the reference: warm grey-brown, matte, faceted)
  stoneRoughness: 0.95, // (matte: high)
  stoneMoss: "#5f6232", // the olive moss / lichen on their tops...
  stoneMossAmount: 0.5, // ...and how much of it
  crackScale: 0.1,
  crackDepth: 0.30,

  // Impact as the beam merges into the core
  shockStrength: 1.0, // ridge and light wave running out across the dunes
  shockShake: 0.9, // metres of camera jolt
  shockReach: 2200, // metres it runs out to (past the far dunes on the horizon)
  shockTime: 4, // s the shockwave takes to run out across the dunes, on the breakup's own clock (breakAuto)
  shockSpan: 0.5, // share of the forging the shockwave takes to run out across the dunes (it starts with the blast)
  edgeBlur: 0.8, // motion blur at the frame's edges through the forging event
  edgeChroma: 0.6, // ...and how far its colours split (chromatic aberration)

  // Sand
  sandColor: "#2c1000",
  sandRippleSize: 4, // the photoscanned sand ripples: metres one tile of them covers (smaller = finer ripples)
  sandRippleDepth: 0.5, // ...how deep they read (their light and shade)
  rippleStrength: 1.5,

  // Entering (after the loader)
  arriveDuration: 3.4, // seconds for the scene to come in from far off to the camera
  arriveDistance: 220, // how far back the camera starts (m, along its view)
  arriveLift: 46, // ...and how far up
  loaderReveal: 2.2, // seconds for the loader to open from the centre out to the edges
  revealWarp: 2.0, // the scene warped along the inside of the opening's edge
  revealBlur: 3.0, // ...smeared outwards (motion blur)
  revealChroma: 1.4, // ...and split into its colours

  // The scroll's pace (wheel): one fixed feel, whoever is scrolling
  // ----- feedback round 2 (its own Leva panel: "Feedback")
  parallaxMode: "shift", // the cursor's parallax: "shift" slides the camera (the classic parallax) · "swing" swings it round what it looks at
  parallaxShiftX: 6.6, // ...how far it slides sideways (m)
  parallaxShiftY: 1.55, // ...and up and down (m)
  parallaxLook: 0, // ...how much the aim slides with it (0 = it keeps looking at the same point, 1 = a flat pan)
  beamBlastFade: 0.006, // the hero beam is gone this fast as the slab blasts apart (share of the forging; the flash covers it)
  heroBeamBehind: -8, // where the hero beam's head starts, metres behind the camera (negative: ahead of it — just under the bottom of the frame, so it comes into view with the first scroll)
  sandInteract: false, // the sand's trail under the cursor (the water's ripples stay)
  beamUpFace: true, // the beam goes on up the slab's face from its foot to the core (no crack growing)
  beamFaceSpread: 0.3, // the beam climbing the slab: its thickness × its thickness on the sand (1 = as thick, 0.5 = half, 0 = one line)
  beamFaceWidth: 2.0, // the beam up the slab's face: × its width on the sand (so it reads as thick there)
  beamFaceGap: 0.32, // ...how far off the face it runs (m)
  spineCrack: false, // the Spine crack lighting up from the foot to the core
  breakShatterSpin: 2.4, // turns each rock spins through on its own, from the blast until it has worn away (eased: quick, then slowing — not a burst)
  edgeFxOffAt: 0.1, // the impact's motion blur at the frame's edges has settled by this share of the forging (the break is at 0.1)
  fillDepth: 12.0, // ...and how deep into the openings it fills (m; the slab is 12 m thick: right through)
  fillSolid: 1.0, // the light filling the cube outline's openings: 1 = solid, 0 = a see-through haze
  fillDensity: 0.25, // ...how quickly the light in the openings thickens with depth (per m: the view through the whole depth is always full; lower = the space inside glows more evenly)
  fillWallGlow: 1.2, // ...and how brightly the openings' walls glow with it
  fillFront: -0.1, // the light in the cube's openings: on the front face, this far in front of it (m)
  cutStyle: "bunq", // the logo → valley change: "bunq" (small glass hexagons growing up from the bottom) · "glass" (the earlier one)
  outroStyle: "bunq", // the scene → white site change: the same choice
  // (bunqlabs.com's own transition settings)
  transCellPx: 11, // the discs' spacing (px)
  transSpread: 3.2, // how long the band of growing discs is (higher = a softer, taller front)
  transJitter: 0.05, // how ragged the front is
  transOvershoot: 0.38, // how far past touching the discs grow (so they run together)
  transRefract: 4.0, // how strongly each glass disc bends the next shot (in discs)
  transWobble: 0.1, // the fluid wobble of the picture round the discs' rims
  transBulge: 0.115, // how much the front rises in the middle (a dome)
  paceEven: 0.6, // how fully the scroll's pace is evened out over the whole way (pace.js: 0 = the same scroll speed everywhere, 1 = the picture changes at one rate everywhere)
  paceApproach: 1.5, // a hand trim: the pace × this from the blast's end until the cut lands (the approach and the cut)
  camFromBlast: true, // the camera sets off for the logo as soon as the blast is over (else: once the broken rock has settled)
  paceValley: 1, // ...and × this from the cut until the beam runs on into the core (the valley)
  valleyBeamFrom: 0.5, // the valley's beam is drawn out from this share of the cut (it shows through the hexagons)...
  valleyBeamBehind: 4, // ...starting this far behind the camera (m)...
  valleyBeamCatchUp: 0.0087, // ...and reaching its lead this much scroll (p) past the cut's end
  scrollFixedPace: false, // the page's own set scroll pace (the wheel / trackpad only says which way; pace.js evens it out) — off: the site's Lenis as it is (from the next load)
  scrollPace: 130, // ...that speed in the hero; elsewhere evened out to its picture (pace.js) (screen heights per second × 100: vh/s)
  scrollHold: 0.14, // ...seconds it keeps going after the last wheel input (wheel notches come this far apart)
  scrollRampIn: 0.16, // ...seconds it takes to get up to speed
  scrollRampOut: 0.3, // ...and to ease to a stop
  scrollDuration: 1.1, // (fixed pace off) seconds each wheel step eases in over
  scrollStep: 110, // the most one wheel step moves (px)
  scrollLead: 0.9, // the most it can run ahead of where it is (× the window's height)
  scrollBoost: 1.3, // how much quicker it goes from the rock breaking off the logo until the cut lands in the valley

  // Beam
  trailIntensity: 2.98,
  beamFootAt: 0.55, // in the hero: when the beam reaches the slab's foot, as a share of the way from its start to the climb (lower = it runs on further ahead of the camera)
  beamStart: 0.6, // how far along its path the beam is already drawn at the hero (0..1)
  // Timeline points (scroll position p, 0 = top of the page, 1 = the end;
  // the dev HUD and the panel's scrubber show p): when things start and end
  cutSamples: 0, // the next shot seen through the cut's hexagons: multisampling (0 = none: lighter; 2 = as the frame)
  tlCutStart: 0.3583, // the glass-hexagon cut from the logo to the valley: starts
  tlCutEnd: 0.5046, // ...ends (the valley camera takes over)
  tlOrbShow: 0.5554, // the core (the orb with our cube in it) is there at the lake's heart, as the camera turns to it
  tlBeamToTreeStart: 0.639, // the beam runs on in to the core, the camera following it; the orb gathers itself
  tlBeamToTreeEnd: 0.6735, // ...the beam touches the core: the orb bursts (over orbBurstSpan)
  syncFallReveal: false, // the reveal and the tree start the moment the orb's poured threads land (overrides tlRevealStart / tlTreeGrowStart and their ends)
  revealSpan: 0.1523, // ...the reveal's length then (share of the scroll)
  treeGrowSpan: 0.1735, // ...the tree's growth's length then
  tlRevealStart: 0.685, // (= the orb's poured threads landing: tlBeamToTreeEnd + orbBurstSpan × ~0.08: as the orb's first sparks reach the ground — nothing runs out over the ground before the orb's own particles have spread) the oasis's reveal (threads of light running out, V2) sets off from under the core
  tlRevealEnd: 1.0, // ...has spread over all of it
  tlTreeGrowStart: 0.7032, // the Yggdrasil starts growing, from the bottom up, strand by strand
  tlTreeGrowEnd: 0.9358, // ...fully grown, to the top of its crown
  tlTreeLightEnd: 0.9546, // the tree's light has climbed to the top of its crown
  growSky: 1.0, // as the tree grows the sky deepens to a clear blue, with clouds (0 = stays as the reveal left it)
  growSkySpan: 0.6, // ...over this share of the tree's growth
  growClouds: 0.65, // ...how many clouds
  tlOrbitStart: 0.6735, // the camera starts round the tree (at one steady pace, on to the end of the page)
  tlOrbitEnd: 0.941, // ...has drawn back to its farthest (orbitSweep degrees round by then)
  tlOutroStart: 0.941, // the glass-hexagon change from the scene to the white site: starts
  tlOutroEnd: 0.9954, // ...all white
  treeLeafGlow: 1.0, // the Yggdrasil's (cosmic) leaves: their brightness before the tree's light reaches them
  treeLeafLit: 2.0, // ...and the extra glow once it has climbed to them
  treeLeafColor: "#ffffff", // ...a tint over their own colours (white: as made)
  treeGrowJitter: 0.25, // how far apart the strands grow (0 = all together, one front)

  // the beam: one solid beam of light, a lightsaber's blade (scene/saber.js)
  beamIntensity: 1.68, // overall
  beamWidth: 0.9, // its glow's width along the sand and up the slab (m)
  oasisBeamWidth: 1.54, // ...and through the valley (m)
  beamCoreRatio: 0.29, // the white-hot core's width, as a share of the glow's
  beamCoreBright: 3.69, // the core's brightness
  beamGlowBright: 0, // the glow's brightness
  beamFlicker: 0, // the faint hum in its brightness (0 = steady)
  beamCoreColor: "#ff5f00",
  beamGlowColor: "#ff6a1a",

  // The sand and gravel the broken rock turns into (counts are capped by the
  // quality tier).
  swirlSpeed: 0.99, // pace of the swirl's sound
  crumbleSand: 0, // grains of sand the broken rock turns into (capped by the quality tier)
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
  strandPush: 0.6, // the tree's strands moving aside from the cursor (m; 0 = none)
  strandPushRadius: 7, // ...how far round the cursor (m)
  embers: 1.0, // motes of light drifting up round the trunk
  oasisBeam: 1.0, // the beam past the mark (x trailIntensity)
  beamStreaks: true, // the beam, all the way: off = one beam of light (the lightsaber); on = a bundle of streaks (as at first)
  streakIntensity: 1.62, // the streaks: overall
  streakWidth: 0.88, // ...each strand's width (x)
  streakFlow: 0.69, // ...pace of the dashes streaming along them
  streakSpread: 0.22, // ...how wide the bundle opens (the gaps between strands)
  streakDashSpacing: 54.0, // ...metres between the bright dashes on a strand
  streakDashLength: 0.57, // ...share of that spacing each dash fills
  streakBase: 1.09, // ...glow of the strands between dashes
  streakColor: "#ff5f00", // ...their colour
  streakHotColor: "#ffd3a6", // ...where brightest
  oasisBeamLead: 0.22, // how far ahead of the camera it runs (x 150 m)
  innerGlow: 1.8, // the forged logo's cube outline lit from within (the light in its openings)
  innerGlowColor: "#ff7a2a", // ...its colour (orange)
  logoParallax: 2.5, // the forged logo turning towards the cursor (0 = still)
  logoYaw: 10, // ...degrees left/right at the screen's edge
  logoPitch: 6, // ...degrees up/down
  // the core at the lake's heart: the orb (after hyperiux-concepts V6) with our cube in it
  orbRadius: 6, // the orb's radius (m)
  orbHeight: 9, // its centre's height over the water (m)
  orbGlow: 1.0, // its threads' brightness
  orbHalo: 0.5, // the glow round it and in its heart
  orbColor: "#ff2a00", // its threads' colour where thin
  orbHotColor: "#ff8a30", // ...and where bright
  orbBurstSpan: 0.1483, // how long its burst lasts, from the beam's touch (share of the scroll; its threads land on the ground at ~40% of it)
  orbRingSize: 1.0, // how far its thrown threads go out (x)
  orbPourSpread: 1.0, // how long the poured threads trail behind the rivulets' fronts, and their splash (x)
  orbPourReach: 220, // m along its rivulet the poured light runs before the rivulet's own threads carry on
  orbFlash: 0, // the flash as it bursts (0 = none)
  orbWave: 0, // the wave of light out across the horizon as it bursts (0 = none)
  cubeSize: 4, // our cube in it: its edge (m)
  cubeGlow: 1.6, // ...how brightly it glows
  cubeColor: "#ff7a2a",
  cubeTilt: 24, // ...how far it is turned (degrees)
  cubeFadeFrom: 0.0, // ...it melts into the tree from this share of the tree's growth (0 = as the tree starts growing)
  cubeFadeTo: 0.14, // ...all melted by this share (its last threads still on their way up)
  cubeMelt: true, // melt into threads that spiral up onto the tree's strands (off: it just fades)
  cubeMeltTravel: 0.26, // share of the growth each thread takes to get from the cube to its strand
  cubeMeltGlow: 3.76, // ...their brightness
  // the camera: following the beam in to the core, then round the tree as it grows
  lushAmount: 1, // as the oasis is revealed: how far the dunes turn dark green-grey and the dusk sky light blue (0 = stays dusk)
  lushSpan: 0.5, // ...over this share of the reveal
  oasisMountains: 1.0, // the mountains round the oasis: peaks and saddles of every height (0 = an even ring of dunes)
  camBeamPace: true, // past the cut the camera and the beam move on one pace: the camera evenly along the beam, the beam's head a lead ahead reaching the cube just at the touch
  camTouchDist: 60, // ...how far behind the beam's head the camera is as it touches the cube (m)
  camFollowBeam: 0, // past the cut: how much the camera looks along with the beam's head as it runs on to the core (0 = straight down the way)
  camOverBeam: 0, // past the cut: how fully the camera sits over the beam (1 = right over it; 0 = on the way's centreline)
  camOverLook: 46, // ...looking this many metres on along the beam
  camSphereDist: 28, // ...never nearer the sphere than this along the beam (m): it holds back there as the beam runs in
  camApproachCloser: 0, // ...drawn in this much closer to the sphere on the way in (share of the way left to go)
  camOverHeight: 3.6, // ...this high over the beam (m), all the way in (it never lifts off it)
  camHoldAfterTouch: 0, // ...staying on the beam this much scroll after it touches the sphere, through the burst...
  camRide: false, // ride the beam's head right in to the sphere (a close-up)
  camRideBehind: 26, // as the beam runs on in to the core the camera rides it: this many metres behind its head...
  camRideLift: 5, // ...this high over it (m)...
  camRideLead: 0.027, // ...settling onto it over this much scroll before the beam heads in (p)...
  camRideRelease: 0.09, // ...and handed over to the turn round the tree over this much after it touches (p)
  camTurnSmooth: 70, // past the cut: how evenly the camera turns to the right along the way (m it is smoothed over; 0 = it follows each bend)
  camCoreDist: 56, // how far from the core it comes to as the beam touches it (m)
  camCoreLift: 4, // ...its height above the core's centre (m)
  orbitSweep: 270, // degrees it goes round between tlOrbitStart and tlOrbitEnd (and on at that pace; - turns the other way)
  orbitRadius: 138, // its farthest from the trunk, once the tree is complete (m; the lake is 150)
  orbitRise: 44, // ...its height over the water then (m)
  orbitFov: 64, // ...its lens then, wide enough for the whole tree (degrees)
  orbitLookTop: 50, // the height it looks up to as the tree tops out (m over the water)
  // the reveal: threads of light running and swirling out from under the core (V2)
  revealRing: 1.0, // their brightness (0 = none)
  revealRivulets: true, // the threads running out from the core over the land
  revealSwirls: false, // the circling threads round the tree
  rivuletColor: "#ff7a1f", // ...their colour
  outroGlass: 1.0, // the glass hexagons of the change to the white site: how much they bend the image
  outroChroma: 0.12, // ...and split its colours
  outroCell: 0.091, // ...a hexagon's size (screen heights)
  outroGlassCover: 0.4, // share of the change by which the glass has covered the whole screen (from the centre out)
  outroWhiteFrom: 0.22, // share of the change at which the white starts filling the hexagons (overlapping the glass)
  outroWhiteFill: 0.3, // share of the change each hexagon takes to fade in to white (the whole hexagon at once)
  outroRandom: 0.55, // 0 = the white fills in rings from the centre … 1 = hexagons at random
  cutGlass: 1.0, // the glass tiles of the cut from the logo: how much they bend the image
  cutChroma: 0.12, // ...and split its colours
  oasisTreeSize: 1.9, // the oasis's trees (x; bigger still round the lake)
  valleyWidth: 0.7, // the valley's floor between the dunes (x; the land is reshaped round it)
  oasisStreamWidth: 1.6, // the oasis stream's width (x; the land is reshaped round it)
  eyePassage: 4.4, // the camera's height over the stream (m)
  eyeLake: 8.5, // ...and over the lake, coming in to the tree
  // the camera magnet, both scenes: the camera swings round a point ahead of it, towards the cursor
  magnet: 1.0, // overall amount (0 = off)
  magnetValley: 0.3, // ...× this in the second scene (the valley, the oasis): much calmer there
  magnetValleyOrbit: 0.2, // ...and how much of it moves the camera there rather than turning it (low: it stays over the beam)
  magnetYaw: 6.4, // degrees left/right at the screen's edge
  magnetPitch: 3.2, // degrees up/down
  magnetBank: 1.28, // degrees of roll into the move
  magnetSwing: 1.92, // degrees of sway with the cursor's speed
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
  seqBlastEnd: 38, // the blast has thrown the pieces out (with seqImpactEnd: the auto-scroll hands back to the visitor here)
  seqGatherStart: 34, // the pieces start to be drawn in towards the streams...
  seqGatherEnd: 130, // ...and are riding them
  seqSpinStart: 22, // the streams start to pick up speed...
  seqSpinEnd: 120, // ...and are up to full speed
  seqGrindStart: 60, // the pieces start to grind away into sand and gravel...
  seqGrindEnd: 190, // ...and are all sand
  seqSandFlow: 70, // how long (vh) a grain takes to find its place in its stream
  seqBreakEnd: 200, // the breakup is over
  seqHold: 60, // from here on the broken rock stays as it is — it keeps revolving, but scrolling on no longer changes it (breakHoldOn)

  // The beam's run to the core
  beamAccel: 0.35, // how much it speeds up into the core (0 = an even pace all the way; 0.9 = it rushes the last stretch)
  cameraSettle: 0.12, // share of the run to the core the camera spends easing to a stop (lower = it keeps moving to the end)

  // Forging event: when the excess rock breaks away, as shares of the event
  // (0 = the beam reaches the core, 1 = the forged logo) — set from seqBreak
  // / seqBreakEnd above
  breakStart: 0.1,
  breakEnd: 1.0,
  // the pointer stirring the broken rock (world/windField.js): while it
  // moves, whatever it hits — sand, gravel, pieces — is flung along its
  // stroke, coasts out and eases back home to its own place in its stream
  // (no overshoot, no circling; nothing at all while it rests)
  breakStirForce: 4.0, // how hard it flings them (how far they go)
  breakStirRadius: 0.09, // its reach (share of the screen's height)
  breakStirFollow: 800, // how closely it follows the pointer (lower = smoother, lazier)
  breakStirLinger: 2.85, // seconds they take to come back home
  breakStirMass: 1.3, // how much less the heavier stones and the broken pieces are flung
  breakStirSpread: 0.5, // how unevenly they are flung (0 = all alike: more fluid the higher)
  breakStirSand: 2.16, // how much the crumbled sand is stirred...
  breakStirGravel: 1.45, // ...and the gravel
  breakStirGlow: 0, // how much a stirred grain lights up (0 = not at all)
  breakImpact: 2.01, // how hard the blast hits: the shell of energy, the flare, the jolt
  blastRingSize: 1.35, // how far the blast's ring of energy swells (× the scatter's reach): past the camera, filling the screen
  breakSpread: 1.7, // how far the blast scatters the rock (× the streams' radius)
  breakSandShare: 1.0, // how much of each piece grinds into sand (1 = all of it; less leaves chunks riding round the mark)
  breakShrink: 0.4, // the pieces' size once broken off
  breakAuto: true, // the breakup plays by itself once the rock breaks (not scrubbed by the scroll)...
  breakAutoBlast: 1.6, // ...s of the great expansion (thrown far out, big, slowing as they fly)
  breakAutoCirculate: 10, // ...s of circulating round the mark, picking up from slow to fast, wearing down into gravel and sand
  breakSpinFrom: 0.07, // the streams' speed right after the blast (× breakSpin)...
  breakSpinTo: 2.2, // ...up to this at full speed (× breakSpin): an easy pick-up, never racing
  breakSpinSettle: 0.25, // ...and this (× breakSpin) once they have settled: the streams calming down as the rocks wear away
  breakSettleEase: 2.6, // ...how it eases out as the rocks settle (1 = even to the end; higher = slowing gently into the settle)
  breakAutoRewind: 3.0, // ...× as fast back, scrolled back before the break
  breakGrindShrink: 0.95, // the pieces wear down by shrinking as they go round (0 = the old shatter / erosion)
  breakHoldOn: true, // the broken rock, sand and gravel stay as they are after the break (seqHold): no drawing in or grinding away on the scroll
  breakSolid: true, // the pieces stay solid stone (no hollow wearing away); the big ones shatter into gravel and sand as the blast throws them
  breakBigVolume: 0, // ...how big a piece is to shatter (m³, the model's own; up to ~10)
  breakShatter: 0.3, // ...how soon they are gone (× the blast's length)
  breakSpin: 2.0, // how fast the streams carry it round
  breakTumble: 0, // how fast the pieces tumble as they go
  // when each stage runs, as shares of the breakup (a piece's own progress)
  // — set from the seq values above
  breakBurstEnd: 0.12, // the impact's energy has dissipated
  breakBlastEnd: 0.1, // the blast has thrown the pieces out
  breakGatherStart: 0.16, // they start to be drawn in towards the streams...
  breakGatherEnd: 0.75, // ...and are riding them
  breakGather: 0.8, // how far the rocks themselves are drawn in (0 = they stay out where the blast threw them and grind away there; 1 = they ride the streams)
  breakSpinStart: 0, // the streams start to pick up speed...
  breakSpinEnd: 0.63, // ...and are up to full speed
  breakGrindStart: 0, // the pieces start to grind away into sand and gravel...
  breakGrindEnd: 0.49, // ...and are gone
  breakSandFlow: 0.6, // how long a grain takes to find its place in the stream
  // the streams of sand the broken rock is carried round the mark in
  streams: 2, // how many
  streamRadius: 38.0, // metres: how far round the mark they loop
  streamTilt: 34.5, // degrees their loops lean towards the camera (0 = level, seen edge-on; 90 = facing it)
  streamWobble: 0.0, // degrees their loops keep tilting and turning by as they go
  streamHeight: 0.0, // metres they rise and fall on the way round
  streamTail: 0.54, // how long each stream's tail is (share of a turn)
  streamWidth: 1.7, // metres: how wide a stream spreads (wider towards its tail)
  streamLoose: 1.0, // share of the grains drifting loose all round
  // ...and the seconds the page takes to auto-scroll through it forwards
  // (core → forged logo), and back
  forgeDuration: 8.0,
  forgeReverse: 5.0,
};

// Day / night switch shared by the header toggle and the panel: writes T
// and tells listeners (the panel keeps its checkbox in sync).
export const NIGHT_EVENT = "forging-sand-dune-concept-v3:night";
export function setNight(on) {
  T.night = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NIGHT_EVENT, { detail: on }));
}
