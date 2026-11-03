"use client";

import gsap from "gsap";
import { LOOK } from "./tuning";

// World time, from the scroll.
//
// T runs 0 → 20 down the page, one unit per frame. The opening's frames are
// lengths of its tall, sticky stage; below it, frame n is at n − ½ when its
// anchor (an element marked data-world="n") is in the middle of the screen,
// so the camera arrives at a place as its section does. Between anchors T
// is linear in the scroll; it is then eased (the camera's inertia), and W
// adds the opening drawing that plays on load (W = T − 1 + intro).
export const WORLD = {
  T: 0, // from the scroll, now
  Ts: 0, // eased
  W: -1, // what the scene draws
  intro: 0,
  reduced: false,
  anchors: [
    [0, 0],
    [1, 20],
  ],
};

const listeners = new Set();
export function onWorld(fn) {
  listeners.add(fn);
  fn(WORLD);
  return () => listeners.delete(fn);
}

// the opening: frame lengths in screen heights
export const unitOf = () => (window.innerWidth < 768 ? 0.8 : 1) * window.innerHeight;

export function measure() {
  const vh = window.innerHeight;
  const stage = document.querySelector("[data-world-opening]");
  const top = stage ? stage.getBoundingClientRect().top + window.scrollY : 0;
  const U = unitOf();
  const a = [[0, 0]];
  // (with reduced motion there is no tall opening: its frames are copy)
  if (stage) for (let n = 1; n <= 9; n++) a.push([top + (n - 0.5) * U, n - 0.5]);
  for (let n = 10; n <= 20; n++) {
    const el = document.querySelector(`[data-world="${n}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    a.push([r.top + window.scrollY + r.height / 2 - vh / 2, n - 0.5]);
  }
  a.push([Math.max(document.documentElement.scrollHeight - vh, 1), 20]);
  // keep it increasing (a short page, or a section shorter than a screen)
  for (let i = 1; i < a.length; i++) if (a[i][0] <= a[i - 1][0]) a[i][0] = a[i - 1][0] + 1;
  WORLD.anchors = a;
}

export function tOf(y) {
  const a = WORLD.anchors;
  if (y <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    if (y <= a[i][0]) return a[i - 1][1] + ((y - a[i - 1][0]) / (a[i][0] - a[i - 1][0])) * (a[i][1] - a[i - 1][1]);
  }
  return a[a.length - 1][1];
}

// the scroll at which T is t (for navigation)
export function yOf(t) {
  const a = WORLD.anchors;
  if (t <= a[0][1]) return a[0][0];
  for (let i = 1; i < a.length; i++) {
    if (t <= a[i][1]) return a[i - 1][0] + ((t - a[i - 1][1]) / (a[i][1] - a[i - 1][1])) * (a[i][0] - a[i - 1][0]);
  }
  return a[a.length - 1][0];
}

let running = 0;
let introTween = null;
function tick(time, dt) {
  WORLD.T = tOf(window.scrollY);
  // eased: quick enough to feel attached to the wheel, slow enough to glide
  const k = WORLD.reduced ? 1 : 1 - Math.exp(-(dt / 1000) * LOOK.scrollEase);
  WORLD.Ts += (WORLD.T - WORLD.Ts) * k;
  if (Math.abs(WORLD.T - WORLD.Ts) < 1e-4) WORLD.Ts = WORLD.T;
  // reduced motion: one still, the mark
  WORLD.W = WORLD.reduced ? 3.6 : WORLD.Ts - 1 + WORLD.intro;
  listeners.forEach((fn) => fn(WORLD));
}

// start the clock (once per page; returns its stop)
export function startWorld({ reduced }) {
  WORLD.reduced = reduced;
  measure();
  WORLD.T = WORLD.Ts = tOf(window.scrollY);
  introTween?.kill();
  if (reduced) WORLD.intro = 1;
  else {
    WORLD.intro = 0;
    introTween = gsap.to(WORLD, { intro: 1, duration: 3.2, ease: "power2.inOut", delay: 0.25 });
  }
  if (running++ === 0) gsap.ticker.add(tick);
  const ro = new ResizeObserver(() => measure());
  ro.observe(document.body);
  window.addEventListener("resize", measure);
  return () => {
    ro.disconnect();
    window.removeEventListener("resize", measure);
    introTween?.kill();
    if (--running === 0) gsap.ticker.remove(tick);
  };
}

// a 0 → 1 → 0 window: in over [a, b], out over [c, d]
export const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
export const win = (x, a, b, c = Infinity, d = Infinity) => smooth(a, b, x) * (c === Infinity ? 1 : 1 - smooth(c, d, x));
