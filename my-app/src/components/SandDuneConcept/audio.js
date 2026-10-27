import { T } from "./tuning";

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
//   warp   – a slow-motion warp-field hum that bends downwards as the cube
//            cracks and tears open, plus one stretched boom as it breaks.
//   vanish – as the world dissolves into white, the music sinks, darkens
//            and washes out into the reverb until nothing is left.

export const SOUND_EVENT = "sand-dune-concept:sound";
const STORE_KEY = "sand-dune-concept-sound";

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

    this.prev = { crackSpread: 0, fracture: 0, beam: 0 };
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
    const w = Math.max(J.crack * 0.75, Math.sin(Math.PI * Math.min(fr / 0.8, 1)), J.field * 0.4);
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

    this.prev.crackSpread = J.crackSpread;
    this.prev.fracture = fr;
    this.prev.beam = J.beam;
  }
}
