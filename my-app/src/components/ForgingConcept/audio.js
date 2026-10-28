import { T } from "./tuning";
import { P } from "./config";

// Generative score and sound effects, synthesised live with Web Audio (no
// files). Browsers only allow audio after a user gesture, so the engine is
// created from the header's sound toggle (or the first click / key press
// when the visitor turned sound on before).
//
//   music  – an abyss with a slow pulse: a deep drone and a dark pad in D
//            minor, a quiet arpeggio through an echo, a soft bass on the
//            downbeats and the pad breathing on every beat. Chords move
//            every couple of bars. Wind and a rare far-off bell on top.
//   sand   – one continuous wind of sand while the pointer moves over the
//            dunes, swelling and brightening with its speed.
//   beam   – a faint rising hum and sizzle while the orange line is drawn.
//   cracks – a faint crackle and molten rumble while the glow fills the
//            monolith's cracks (only while it's actually spreading).
//   impact – the beam merging into the core: a sub drop, a sharp crack, an
//            energy ring and the shockwave rolling out across the dunes.
//   warp   – a slow-motion warp-field hum that bends downwards as the cube
//            cracks and tears open, plus one stretched boom as it breaks.
//   break  – the rock wearing away: a pour of sand and grit with stone chips
//            ticking off, as fast as the breakup runs.
//   swirl  – the sand and gravel going round the mark: a wind that sweeps
//            past, left to right and back, with each turn.
//   light  – the cube's inner light the camera flies into: a rising, glassy
//            chord and shimmer; an airy swell as it passes through.
//   garden – water lapping, leaves, and birds now and then.
//   logo   – glints as the particle logo gathers, a soft chord as it settles.
//   vanish – as the world dissolves into white, the music sinks, darkens
//            and washes out into the reverb until nothing is left.

export const SOUND_EVENT = "forging-concept:sound";
const STORE_KEY = "forging-concept-sound";

let engine = null;

export function getAudio() {
  return engine;
}

export function soundWanted() {
  try {
    return window.localStorage.getItem(STORE_KEY) === "on";
  } catch {
    return false;
  }
}

// Call from a user gesture.
export function setSound(on) {
  try {
    window.localStorage.setItem(STORE_KEY, on ? "on" : "off");
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
  if (on && !engine) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    engine = new AudioEngine(new Ctx());
  }
  engine?.setEnabled(on);
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: on }));
}

export function soundOn() {
  return !!engine?.enabled;
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const smoothstep = (x, a, b) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// D minor, low and open. Each chord glides into the next.
const CHORDS = [
  [50, 53, 57, 64], // Dm(add9)
  [46, 50, 53, 57], // B♭maj7
  [43, 46, 50, 57], // Gm(add9)
  [45, 50, 52, 57], // Asus4
];
const BASS = [38, 34, 31, 33]; // chord roots, an octave or two down
const ARP = [0, 1, 2, 3, 2, 1, 3, 2]; // chord-tone order over a bar of 8ths
const BELLS = [74, 77, 79, 81, 84, 86]; // D minor pentatonic, high

class AudioEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.enabled = false;
    const t = ctx.currentTime;

    // master → gentle compressor → out
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.02;
    comp.release.value = 0.4;
    this.master.connect(comp).connect(ctx.destination);

    // one long, dark hall shared by everything
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(7, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.85;
    this.reverb.connect(wet).connect(this.master);

    this.noise = this.noiseBuffer(6);
    this.crackle = this.crackleBuffer(4);

    this.sfx = this.bus(0.45);

    this.buildMusic(t);
    this.buildSand();
    this.buildBeam();
    this.buildCracks();
    this.buildWarp();
    this.buildVanish();
    this.buildBreak();
    this.buildSwirl();
    this.buildLight();
    this.buildGarden();
    this.logoBus = this.bus(1.1);

    this.prev = { crackSpread: 0, fracture: 0, beam: 0, pulse: 0, progress: 0, pForm: 0, pSettle: 0 };
    this.breakLevel = 0;
    this.nextChip = 0;
    this.swirlPhase = 0;
    this.nextChirp = 0;
    this.glints = 0;
    this.lastImpact = -10;
    this.crackLevel = 0;
    this.beamLevel = 0;
    this.sandLevel = 0;
    this.lastBoom = -10;
  }

  // dry bus + reverb send
  bus(send) {
    const g = this.ctx.createGain();
    g.connect(this.master);
    const s = this.ctx.createGain();
    s.gain.value = send;
    g.connect(s).connect(this.reverb);
    return g;
  }

  impulse(seconds, decay) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        // darker as it decays: average a little of the previous sample in
        const n = Math.random() * 2 - 1;
        d[i] = (i > 0 ? d[i - 1] * 0.35 + n * 0.65 : n) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  noiseBuffer(seconds) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // sparse tiny clicks: grains of sand, stone cracking
  crackleBuffer(seconds) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.0009) {
        const amp = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? -1 : 1);
        const n = 20 + Math.floor(Math.random() * 120);
        for (let k = 0; k < n && i + k < len; k++) d[i + k] += amp * Math.exp(-k / (n * 0.25)) * (Math.random() * 2 - 1);
      }
    }
    return buf;
  }

  loop(buffer, offset = 0) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(this.ctx.currentTime, offset);
    return s;
  }

  lfo(freq, depth, target) {
    const o = this.ctx.createOscillator();
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
    return o;
  }

  filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  gain(value) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  buildMusic(t) {
    const { ctx } = this;
    // musicLevel (volume, ducking, vanish) → musicTone (darkens as it
    // vanishes) → dry out + a reverb send that grows as it vanishes
    this.musicLevel = this.gain(1);
    this.musicTone = this.filter("lowpass", 18000, 0.5);
    this.musicLevel.connect(this.musicTone).connect(this.master);
    this.musicWet = this.gain(0.55);
    this.musicTone.connect(this.musicWet).connect(this.reverb);
    // held voices, detuned (sink) as the world vanishes
    this.musicDetuned = [];
    this.sink = 0;

    // drone: detuned saws on D1/D2 through a slowly breathing low-pass
    const droneFilter = this.filter("lowpass", 190, 0.8);
    this.lfo(0.031, 80, droneFilter.frequency);
    const drone = this.gain(0.14);
    droneFilter.connect(drone).connect(this.musicLevel);
    for (const [f, cents] of [
      [midi(26), -6],
      [midi(26), 7],
      [midi(38), -4],
      [midi(38), 5],
    ]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(droneFilter);
      o.start(t);
      this.musicDetuned.push({ o, base: cents });
    }

    // pad: four voices gliding between chords; its level breathes with
    // the beat (padPulse)
    this.padFilter = this.filter("lowpass", 680, 1.4);
    this.lfo(0.019, 260, this.padFilter.frequency);
    this.padPulse = this.gain(1);
    const pad = this.gain(0.07);
    this.padFilter.connect(this.padPulse).connect(pad).connect(this.musicLevel);
    this.voices = CHORDS[0].map((n) =>
      [
        ["sawtooth", -9],
        ["sawtooth", 8],
        ["triangle", 0],
      ].map(([type, cents]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midi(n);
        o.detune.value = cents;
        o.connect(this.padFilter);
        o.start(t);
        this.musicDetuned.push({ o, base: cents });
        return o;
      })
    );

    // arpeggio and bass go through a soft echo (dotted 8th), low-passed
    this.echo = ctx.createDelay(2);
    const fb = this.gain(0.38);
    const echoTone = this.filter("lowpass", 1600, 0.5);
    this.echo.connect(echoTone).connect(fb).connect(this.echo);
    this.arpBus = this.gain(1);
    this.arpBus.connect(this.musicLevel);
    this.arpBus.connect(this.echo);
    const echoOut = this.gain(0.5);
    echoTone.connect(echoOut).connect(this.musicLevel);

    // abyssal wind: band-passed noise breathing in and out
    const wind = this.loop(this.noise);
    const windFilter = this.filter("bandpass", 420, 0.7);
    this.lfo(0.023, 180, windFilter.frequency);
    const windGain = this.gain(0.03);
    this.lfo(0.041, 0.022, windGain.gain);
    wind.connect(windFilter).connect(windGain).connect(this.musicLevel);

    this.chord = 0;
    this.step = 0; // 8th-note counter
    this.nextStep = t + 0.5;
    this.nextBell = t + 9;
  }

  // one 8th-note step of the pulse (scheduled slightly ahead of time)
  scheduleStep(t, step) {
    const { ctx } = this;
    const beatLen = 60 / T.musicTempo;
    const stepsPerChord = 8 * Math.max(1, Math.round(T.chordBars));
    const inBar = step % 8;

    // chord change on the bar line, gliding
    if (step % stepsPerChord === 0) {
      this.chord = (step / stepsPerChord) % CHORDS.length;
      CHORDS[this.chord].forEach((n, i) => {
        for (const o of this.voices[i]) o.frequency.setTargetAtTime(midi(n), t, 0.6);
      });
    }
    const tones = CHORDS[this.chord];

    // pad breathes on every beat
    if (inBar % 2 === 0) {
      const dip = 1 - T.pulseDepth * (inBar === 0 ? 1 : 0.6);
      this.padPulse.gain.setTargetAtTime(dip, t, 0.02);
      this.padPulse.gain.setTargetAtTime(1, t + 0.06, beatLen * 0.35);
    }

    // soft bass on beats 1 and 3
    if (inBar === 0 || inBar === 4) {
      const o = ctx.createOscillator();
      o.frequency.value = midi(BASS[this.chord]);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11 * T.bassVolume, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + beatLen * 1.8);
      o.detune.value = this.sink;
      o.connect(g).connect(this.musicLevel);
      o.start(t);
      o.stop(t + beatLen * 1.9);
    }

    // quiet arpeggio of the chord tones, an octave up; a few steps rest so
    // it never turns into a sequence
    if (T.arpVolume > 0 && (inBar === 0 || Math.random() > 0.22)) {
      const n = tones[ARP[inBar]] + 12 + (inBar >= 6 ? 12 : 0);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midi(n);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 3;
      f.frequency.setValueAtTime(1500, t);
      f.frequency.exponentialRampToValueAtTime(320, t + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03 * T.arpVolume * (inBar === 0 ? 1.2 : 0.8 + Math.random() * 0.3), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.detune.value = this.sink;
      o.connect(f).connect(g).connect(this.arpBus);
      o.start(t);
      o.stop(t + 0.5);
    }
  }

  bell(t) {
    const { ctx } = this;
    const f = midi(BELLS[Math.floor(Math.random() * BELLS.length)]);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.03, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 6);
    // soft FM bell, mostly reverb: it should sound far away
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 2.01;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 0.6, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 4);
    mod.connect(modGain).connect(car.frequency);
    const send = this.gain(2.2);
    car.connect(env);
    env.connect(this.musicLevel);
    env.connect(send).connect(this.reverb);
    car.start(t);
    mod.start(t);
    car.stop(t + 6.2);
    mod.stop(t + 6.2);
  }

  // continuous sand wind: noise + grains, opened by sandHover()
  buildSand() {
    const { ctx } = this;
    this.sandGain = this.gain(0);
    this.sandPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.sandPan) this.sandGain.connect(this.sandPan).connect(this.sfx);
    else this.sandGain.connect(this.sfx);
    const air = this.loop(this.noise, 1);
    this.sandFilter = this.filter("bandpass", 1200, 0.6);
    air.connect(this.sandFilter).connect(this.gain(0.5)).connect(this.sandGain);
    const grains = this.loop(this.crackle, 0.5);
    const hp = this.filter("highpass", 2600, 0.5);
    grains.connect(hp).connect(this.gain(0.7)).connect(this.sandGain);
  }

  // faint rising hum + sizzle while the orange line is drawn
  buildBeam() {
    const { ctx } = this;
    this.beamGain = this.gain(0);
    this.beamGain.connect(this.sfx);
    this.beamTones = [1, 2.005].map((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "sawtooth";
      o.frequency.value = 110 * ratio;
      const g = this.gain(i === 0 ? 0.5 : 0.08);
      o.connect(g).connect(this.beamGain);
      o.start();
      return { o, ratio };
    });
    const sizzle = this.loop(this.crackle, 2);
    const bp = this.filter("bandpass", 3800, 1.2);
    sizzle.connect(bp).connect(this.gain(0.6)).connect(this.beamGain);
  }

  buildCracks() {
    this.crackGain = this.gain(0);
    this.crackGain.connect(this.sfx);
    const crackle = this.loop(this.crackle);
    crackle.connect(this.filter("highpass", 1600)).connect(this.crackGain);
    // molten rumble underneath
    const rumble = this.loop(this.noise, 2);
    rumble.connect(this.filter("lowpass", 130)).connect(this.gain(0.9)).connect(this.crackGain);
  }

  buildWarp() {
    const { ctx } = this;
    this.warpGain = this.gain(0);
    this.warpGain.connect(this.sfx);
    // slow tremolo on everything: the "slowed-down" feel
    this.warpTrem = this.gain(0.75);
    this.warpTremLfo = this.lfo(3.2, 0.25, this.warpTrem.gain);
    this.warpTrem.connect(this.warpGain);
    // low tones a fifth apart, bending down as it breaks
    this.warpTones = [1, 1.498, 2.003].map((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "sawtooth" : "sine";
      o.frequency.value = 55 * ratio;
      const g = this.gain(i === 2 ? 0.05 : 0.32);
      o.connect(g).connect(this.warpTrem);
      o.start();
      return { o, ratio };
    });
    // swept, resonant noise: the field
    const field = this.loop(this.noise, 4);
    this.warpFilter = this.filter("bandpass", 300, 7);
    field.connect(this.warpFilter).connect(this.gain(0.55)).connect(this.warpTrem);
  }

  // the world blowing away as dust: an airy whisper that swells and fades
  buildVanish() {
    this.vanishGain = this.gain(0);
    this.vanishGain.connect(this.sfx);
    const air = this.loop(this.noise, 3);
    this.vanishFilter = this.filter("bandpass", 2400, 0.5);
    this.lfo(0.11, 900, this.vanishFilter.frequency);
    air.connect(this.vanishFilter).connect(this.vanishGain);
  }

  // one stretched, slow-motion impact as the cube breaks
  boom() {
    const { ctx } = this;
    const t = ctx.currentTime;
    const out = this.gain(T.warpVolume);
    out.connect(this.sfx);
    out.connect(this.gain(1.6)).connect(this.reverb);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(78, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 3.2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.75, t + 0.08);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 4.6);

    // whoosh: noise through a low-pass falling slowly
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const lp = this.filter("lowpass", 2600, 4);
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + 3.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.32, t + 0.25);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    n.connect(lp).connect(ng).connect(out);
    n.start(t, Math.random() * 2);
    n.stop(t + 4.1);
  }

  // a StereoPanner where available (else a plain pass-through gain)
  panner(pan = 0) {
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.gain(1);
    if (p.pan) p.pan.value = pan;
    return p;
  }

  // a one-shot noise burst: filter → envelope → out
  noiseHit(t, out, { type = "bandpass", freq, to, q = 1, peak, attack = 0.005, decay, offset = Math.random() * 4 }) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const f = this.filter(type, freq, q);
    if (to) {
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    n.connect(f).connect(g).connect(out);
    n.start(t, offset);
    n.stop(t + attack + decay + 0.05);
    return g;
  }

  // a one-shot tone: sine (or type) gliding from f0 to f1
  tone(t, out, { f0, f1 = f0, glide = 0.1, peak, attack = 0.01, decay, type = "sine" }) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  // the rock wearing away: sand pouring, grit, a low grind
  buildBreak() {
    this.breakGain = this.gain(0);
    this.breakGain.connect(this.sfx);
    this.loop(this.noise, 5).connect(this.filter("bandpass", 2600, 0.8)).connect(this.gain(0.55)).connect(this.breakGain);
    this.loop(this.crackle, 3).connect(this.filter("bandpass", 1500, 0.9)).connect(this.gain(1.3)).connect(this.breakGain);
    this.loop(this.noise, 0.7).connect(this.filter("lowpass", 200)).connect(this.gain(0.5)).connect(this.breakGain);
  }

  // one stone chip ticking off
  chip(t) {
    const out = this.panner((Math.random() - 0.5) * 1.4);
    out.connect(this.sfx);
    this.noiseHit(t, out, { freq: 900 + Math.random() * 3200, q: 5, peak: 0.3 * T.breakVolume * (0.35 + Math.random() * 0.65), attack: 0.002, decay: 0.03 + Math.random() * 0.07 });
  }

  // the swirl: wind and fine sand sweeping round
  buildSwirl() {
    this.swirlGain = this.gain(0);
    this.swirlPan = this.panner();
    this.swirlGain.connect(this.swirlPan).connect(this.sfx);
    this.swirlFilter = this.filter("bandpass", 600, 1.1);
    this.loop(this.noise, 2.5).connect(this.swirlFilter).connect(this.gain(0.8)).connect(this.swirlGain);
    this.loop(this.crackle, 1.5).connect(this.filter("highpass", 3000)).connect(this.gain(0.35)).connect(this.swirlGain);
  }

  // the cube's inner light: a glassy D chord with a slow vibrato, and air
  buildLight() {
    const { ctx } = this;
    this.lightGain = this.gain(0);
    this.lightGain.connect(this.sfx);
    this.lightTones = [
      [62, 0.26],
      [69, 0.2],
      [74, 0.14],
      [81, 0.07],
    ].map(([n, level], i) => {
      const o = ctx.createOscillator();
      o.frequency.value = midi(n);
      this.lfo(4.2 + i * 0.7, 6, o.detune);
      o.connect(this.gain(level)).connect(this.lightGain);
      o.start();
      return o;
    });
    this.loop(this.noise, 1.2).connect(this.filter("highpass", 5200, 0.5)).connect(this.gain(0.25)).connect(this.lightGain);
  }

  // through the light: an airy swell opening onto the garden
  passThrough() {
    const t = this.ctx.currentTime;
    const out = this.gain(T.lightVolume);
    out.connect(this.sfx);
    out.connect(this.gain(1.4)).connect(this.reverb);
    this.noiseHit(t, out, { type: "highpass", freq: 7000, to: 900, q: 0.7, peak: 0.3, attack: 0.12, decay: 3 });
    for (const n of [62, 69, 74]) this.tone(t, out, { f0: midi(n), peak: 0.05, attack: 0.25, decay: 3.5 });
  }

  // the garden: water lapping, leaves; birds are scheduled in update()
  buildGarden() {
    this.gardenGain = this.gain(0);
    this.gardenGain.connect(this.sfx);
    const water = this.gain(0.5);
    this.lfo(0.23, 0.32, water.gain);
    this.loop(this.noise, 3.3).connect(this.filter("lowpass", 620, 0.5)).connect(water).connect(this.gardenGain);
    const ripple = this.gain(0.12);
    this.lfo(0.61, 0.1, ripple.gain);
    this.loop(this.crackle, 2.2).connect(this.filter("bandpass", 1100, 1.5)).connect(ripple).connect(this.gardenGain);
    const leaves = this.gain(0.1);
    this.lfo(0.07, 0.07, leaves.gain);
    this.loop(this.noise, 4.4).connect(this.filter("bandpass", 3200, 0.6)).connect(leaves).connect(this.gardenGain);
  }

  // a bird: two to four quick chirps
  chirp(t) {
    const out = this.panner((Math.random() - 0.5) * 1.6);
    out.connect(this.gardenGain);
    const base = 2400 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const f0 = base * (0.9 + Math.random() * 0.25);
      this.tone(t + i * (0.1 + Math.random() * 0.07), out, { f0, f1: f0 * (Math.random() < 0.5 ? 1.35 : 0.75), glide: 0.07, peak: 0.035, attack: 0.008, decay: 0.09 });
    }
  }

  // the particle logo: one glint, and the chord it settles on
  glint(t) {
    const n = BELLS[Math.floor(Math.random() * BELLS.length)] + 12 * (Math.random() < 0.4 ? 1 : 0);
    const out = this.panner((Math.random() - 0.5) * 1.2);
    out.connect(this.logoBus);
    this.tone(t, out, { f0: midi(n), peak: 0.022 * T.logoVolume, attack: 0.004, decay: 0.7 + Math.random() * 0.6 });
  }

  resolve() {
    const t = this.ctx.currentTime;
    for (const n of [62, 69, 74, 77]) this.tone(t, this.logoBus, { f0: midi(n), peak: 0.035 * T.logoVolume, attack: 1.2, decay: 5 });
  }

  // the beam merging into the core
  impact() {
    const t = this.ctx.currentTime;
    const out = this.gain(T.impactVolume);
    out.connect(this.sfx);
    out.connect(this.gain(1.2)).connect(this.reverb);
    // sub drop
    this.tone(t, out, { f0: 95, f1: 26, glide: 1.8, peak: 0.9, attack: 0.01, decay: 3 });
    // the crack of it
    this.noiseHit(t, out, { type: "highpass", freq: 1800, q: 0.7, peak: 0.55, attack: 0.002, decay: 0.12 });
    // an energy ring, inharmonic, fading
    this.tone(t, out, { f0: midi(62) * 1.5, peak: 0.07, attack: 0.005, decay: 2.6, type: "triangle" });
    this.tone(t, out, { f0: midi(62) * 2.13, peak: 0.04, attack: 0.005, decay: 2.2 });
    // the shockwave rolling out across the dunes, left to right
    const roll = this.panner(-0.6);
    roll.connect(out);
    if (roll.pan) {
      roll.pan.setValueAtTime(-0.6, t);
      roll.pan.linearRampToValueAtTime(0.6, t + 3);
    }
    this.noiseHit(t, roll, { type: "lowpass", freq: 1400, to: 70, q: 0.8, peak: 0.5, attack: 0.06, decay: 3.6 });
  }

  // Pointer over the dunes: level 0..1 from how fast it's moving.
  sandHover(level, pan = 0) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const target = clamp01(level);
    // swell quickly, settle softly: one connected breath of sand
    this.sandLevel += (target - this.sandLevel) * (target > this.sandLevel ? 0.25 : 0.06);
    this.sandGain.gain.setTargetAtTime(this.sandLevel * T.sandVolume * 0.35, t, 0.08);
    this.sandFilter.frequency.setTargetAtTime(700 + this.sandLevel * 2200, t, 0.15);
    if (this.sandPan) this.sandPan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, pan)), t, 0.2);
  }

  setEnabled(on) {
    const { ctx } = this;
    this.enabled = on;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    if (on) {
      ctx.resume();
      this.nextStep = Math.max(this.nextStep, t + 0.1);
      this.master.gain.linearRampToValueAtTime(T.masterVolume, t + 2.5);
    } else {
      this.master.gain.linearRampToValueAtTime(0, t + 0.8);
      clearTimeout(this.suspendTimer);
      this.suspendTimer = setTimeout(() => !this.enabled && ctx.suspend(), 1000);
    }
  }

  // Called every frame with the journey state.
  update(J, delta) {
    if (!this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const dt = Math.max(delta, 1e-3);
    const smooth = (param, value, tc = 0.12) => param.setTargetAtTime(value, t, tc);

    smooth(this.master.gain, T.masterVolume, 0.3);

    // vanish: from the white-out to the end of the dissolve the music
    // sinks, darkens and washes out into the reverb, then is gone
    const v = smoothstep(J.progress, T.vanishStart, T.vanishEnd);
    const left = Math.pow(1 - v, 1.6);

    // the pulse, scheduled a little ahead; it thins out as it vanishes
    // (after a background tab, skip ahead instead of catching up in a burst)
    if (this.nextStep < t - 0.5) this.nextStep = t + 0.05;
    while (this.nextStep < t + 0.25) {
      if (v < 0.85) this.scheduleStep(this.nextStep, this.step);
      this.step++;
      this.nextStep += 60 / T.musicTempo / 2;
    }
    this.echo.delayTime.setTargetAtTime((60 / T.musicTempo) * 0.75, t, 0.5);
    if (t >= this.nextBell) {
      if (v < 0.5) this.bell(t + 0.05);
      this.nextBell = t + 8 + Math.random() * 10;
    }

    // warp field: rises as the cube cracks, peaks as it tears open, and
    // bends down in pitch and slows its tremolo (slow motion)
    const fr = J.fracture;
    const w = Math.max(J.crack * 0.75, Math.sin(Math.PI * Math.min(fr / 0.8, 1)));
    smooth(this.warpGain.gain, w * T.warpVolume * 0.5, 0.15);
    const bend = 1 - 0.42 * Math.min(fr * 1.2, 1);
    for (const { o, ratio } of this.warpTones) smooth(o.frequency, 55 * ratio * bend, 0.25);
    smooth(this.warpFilter.frequency, 260 + 1400 * Math.max(J.crack, 0) * (1 - fr * 0.7), 0.2);
    smooth(this.warpTremLfo.frequency, 3.2 - 2.6 * Math.min(fr * 1.3, 1), 0.3);

    // music level: steps back while the cube breaks, and vanishes
    smooth(this.musicLevel.gain, T.musicVolume * (1 - 0.55 * w) * left, 0.4);
    smooth(this.musicTone.frequency, 18000 * Math.pow(1 - v, 3) + 220, 0.4);
    smooth(this.musicWet.gain, 0.55 + 1.4 * Math.sin(Math.PI * Math.min(v * 1.2, 1)), 0.5);
    this.sink = -v * 160; // cents: the held voices sink, new notes start there
    for (const { o, base } of this.musicDetuned) o.detune.setTargetAtTime(base + this.sink, t, 0.6);
    smooth(this.vanishGain.gain, Math.sin(Math.PI * v) * T.vanishVolume * 0.18, 0.3);

    // one boom as it breaks (scrolling forwards)
    if (this.prev.fracture < 0.03 && fr >= 0.03 && t - this.lastBoom > 2.5) {
      this.lastBoom = t;
      this.boom();
    }

    // beam: audible while it's being drawn, rising as it climbs to the core
    const beamRate = Math.abs(J.beam - this.prev.beam) / dt;
    const bTarget = Math.min(beamRate / 3, 1) * (J.beam < 0.999 ? 1 : 0);
    this.beamLevel += (bTarget - this.beamLevel) * (1 - Math.exp(-dt / (bTarget > this.beamLevel ? 0.1 : 0.45)));
    smooth(this.beamGain.gain, this.beamLevel * T.beamVolume * 0.12, 0.1);
    for (const { o, ratio } of this.beamTones) smooth(o.frequency, 110 * ratio * (1 + J.beam * 0.5), 0.2);

    // cracks: only audible while the glow is actually spreading
    const rate = Math.abs(J.crackSpread - this.prev.crackSpread) / dt;
    const target = Math.min(rate / 0.5, 1);
    this.crackLevel += (target - this.crackLevel) * (1 - Math.exp(-dt / (target > this.crackLevel ? 0.08 : 0.5)));
    smooth(this.crackGain.gain, this.crackLevel * T.crackVolume * 0.22, 0.1);

    const forward = J.progress > this.prev.progress;
    // ---- impact: the beam reaches the core (scrolling forwards)
    if (forward && this.prev.pulse < 0.15 && J.pulse >= 0.15 && t - this.lastImpact > 2) {
      this.lastImpact = t;
      this.impact();
    }

    // ---- the rock wearing away into sand and gravel: as fast as it runs
    const breakRate = Math.abs(fr - this.prev.fracture) / dt;
    const breakTarget = fr > 0 && fr < 1 ? Math.min(breakRate / 0.12, 1) : 0;
    this.breakLevel += (breakTarget - this.breakLevel) * (1 - Math.exp(-dt / (breakTarget > this.breakLevel ? 0.1 : 0.6)));
    smooth(this.breakGain.gain, this.breakLevel * T.breakVolume * 0.16, 0.1);
    if (this.breakLevel > 0.05 && t >= this.nextChip) {
      this.chip(t + 0.02);
      this.nextChip = t + (0.02 + Math.random() * 0.12) / this.breakLevel;
    }

    // ---- the swirl: a wind sweeping past with each turn
    this.swirlPhase += dt * 0.9 * J.orbitSpeed * T.swirlSpeed;
    const swirlOn = J.inGarden ? 0 : smoothstep(fr, 0, 0.25) * (1 - smoothstep(J.flash, 0.2, 0.9));
    const sweep = 0.5 + 0.5 * Math.sin(this.swirlPhase * 2.3);
    smooth(this.swirlGain.gain, swirlOn * (0.55 + 0.45 * sweep) * T.swirlVolume * 0.12, 0.2);
    smooth(this.swirlFilter.frequency, 420 + 600 * sweep, 0.2);
    if (this.swirlPan.pan) smooth(this.swirlPan.pan, 0.65 * Math.sin(this.swirlPhase), 0.2);

    // ---- the inner light the camera flies into, rising; through it
    const light = Math.max(J.inGarden ? 0 : Math.min(J.innerGlow / 4, 1), J.flash);
    smooth(this.lightGain.gain, light * light * T.lightVolume * 0.14, 0.15);
    for (const o of this.lightTones) smooth(o.detune, 220 * light, 0.3);
    if (forward && this.prev.progress < P.through && J.progress >= P.through) this.passThrough();

    // ---- the garden
    const garden = J.inGarden ? 1 - 0.7 * J.flash : 0;
    smooth(this.gardenGain.gain, garden * T.gardenVolume * 0.3, 0.8);
    if (garden > 0.2 && t >= this.nextChirp) {
      this.chirp(t + 0.05);
      this.nextChirp = t + 1.2 + Math.random() * 3.6;
    }

    // ---- the particle logo: glints as it gathers, a chord as it settles
    const formRate = Math.abs(J.pForm - this.prev.pForm) / dt + Math.abs(J.pSettle - this.prev.pSettle) / dt * 0.5;
    this.glints += Math.min(formRate * 40, 14) * dt;
    while (this.glints >= 1) {
      this.glints -= 1;
      this.glint(t + Math.random() * 0.08);
    }
    if (forward && this.prev.pSettle < 0.85 && J.pSettle >= 0.85) this.resolve();

    this.prev.crackSpread = J.crackSpread;
    this.prev.fracture = fr;
    this.prev.beam = J.beam;
    this.prev.pulse = J.pulse;
    this.prev.progress = J.progress;
    this.prev.pForm = J.pForm;
    this.prev.pSettle = J.pSettle;
  }
}
