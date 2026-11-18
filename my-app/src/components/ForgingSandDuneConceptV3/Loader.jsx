"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { T } from "./tuning";
import { loadProgress, startLoading } from "./loading";

// The loader: the Hyperiux wordmark in white on #111, a slim orange bar under it
// filling as the scene's assets come in (loading.js) — only full once the
// forge is built behind it. Then "Enter the
// experience": on click the loader opens from the centre out to the edges
// (a soft, slowly churning edge, drawn by the shader below) while the scene
// comes in from far off to the camera (J.arrive, Rig.jsx).

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uOpen; // 0 closed .. 1 gone
uniform float uTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float d = length(p);
  // the opening's edge: round, softly frayed, drifting as it goes
  // (noise round the circle from its direction, not its angle: no seam)
  vec2 around = p / max(d, 1e-4);
  float fray = fbm(around * 1.8 + vec2(0.0, d * 2.5 - uTime * 0.35)) * 0.16 + fbm(p * 3.0 + uTime * 0.12) * 0.06;
  float reach = length(0.5 * uRes / uRes.y) + 0.45; // past the corners, frayed edge and all
  float r = uOpen * reach - 0.2;
  float feather = 0.16 + 0.12 * uOpen;
  float keep = smoothstep(r - feather, r + 0.02, d + fray);
  // a faint warm light along the edge as it opens
  float rim = smoothstep(r - feather, r - feather * 0.4, d + fray) * (1.0 - smoothstep(r - feather * 0.4, r + 0.02, d + fray));
  vec3 col = vec3(0.0667) + vec3(1.0, 0.373, 0.0) * rim * 0.22 * (1.0 - uOpen);
  gl_FragColor = vec4(col, max(keep, rim * 0.5) * (1.0 - smoothstep(0.92, 1.0, uOpen)));
}
`;

function createOpening(canvas) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = { res: gl.getUniformLocation(prog, "uRes"), open: gl.getUniformLocation(prog, "uOpen"), time: gl.getUniformLocation(prog, "uTime") };
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return {
    draw(open, time) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.open, open);
      gl.uniform1f(u.time, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      // (the context itself is left to the canvas: a remount — React's dev
      // double run — gets the same one back and must find it working)
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
}

function setReveal(J, open) {
  J.reveal = open;
}

export default function Loader({ J, problem, onEnter, onGone }) {
  const root = useRef(null);
  const canvasRef = useRef(null);
  const barRef = useRef(null);
  const contentRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const entering = useRef(false);
  const problemRef = useRef(problem);
  useEffect(() => {
    problemRef.current = problem;
  }, [problem]);

  // the bar: eases towards the real progress, never back, full only when
  // everything is in
  useEffect(() => {
    startLoading();
    let shown = 0;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = loadProgress(J, problemRef.current);
      const goal = target >= 1 ? 1 : Math.min(target, 0.97);
      shown = Math.max(shown, shown + (goal - shown) * (1 - Math.exp(-dt * 4)));
      if (target >= 1 && 1 - shown < 0.004) shown = 1;
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown})`;
      if (shown >= 1) {
        setReady(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [J]);

  // the opening's shader (closed, the loader is its plain #111 background;
  // the shader takes over only as it opens)
  const opening = useRef(null);
  useEffect(() => {
    const o = createOpening(canvasRef.current);
    opening.current = o;
    return () => {
      opening.current = null;
      o?.dispose();
    };
  }, []);

  const enter = (quiet = false) => {
    if (!ready || entering.current) return;
    entering.current = true;
    onEnter({ quiet });
    // the mark, the bar and the words lift away and soften first...
    gsap.to(contentRef.current, { autoAlpha: 0, scale: 1.06, filter: "blur(6px)", duration: 0.7, ease: "power2.in" });
    // ...as the loader opens from the centre out past the edges
    const t0 = performance.now();
    const state = { open: 0 };
    // (the shader draws the ground from here; without WebGL the plain
    // background simply fades)
    if (opening.current) {
      opening.current.draw(0, 0);
      canvasRef.current.style.visibility = "visible";
      root.current.style.background = "transparent";
    }
    const draw = () => {
      if (opening.current) opening.current.draw(state.open, (performance.now() - t0) / 1000);
      else if (root.current) root.current.style.opacity = String(1 - state.open);
    };
    gsap.to(state, {
      open: 1,
      duration: T.loaderReveal,
      delay: 0.15,
      ease: "power2.inOut",
      onUpdate: () => {
        draw();
        // (the scene's post pass warps along the same edge: Rig.jsx Post)
        setReveal(J, state.open);
      },
      onComplete: () => {
        setGone(true);
        onGone?.();
      },
    });
  };

  if (gone) return null;
  // (out of <main>: over the header, out of the journey's sticky frame)
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[100] select-none bg-[#111111]" role="dialog" aria-label="Loading the experience" aria-busy={!ready}>
      {/* the ground (#111), drawn by the shader so it can open */}
      {/* (hidden until it opens: an undrawn WebGL canvas can flash black as
          the page repaints round it — on the button's hover) */}
      <canvas ref={canvasRef} aria-hidden="true" className="invisible absolute inset-0 h-full w-full bg-transparent" />
      <div ref={contentRef} className="absolute inset-0 flex flex-col items-center justify-center">
        <Face barRef={barRef} />
        <button
          type="button"
          onClick={() => enter(false)}
          disabled={!ready}
          tabIndex={ready ? 0 : -1}
          className={`${ENTER_TYPE} cursor-pointer text-white hover:border-[#ff5f00] hover:bg-[#ff5f00] hover:text-black focus-visible:border-[#ff5f00] focus-visible:bg-[#ff5f00] focus-visible:text-black focus-visible:outline-none ${
            ready ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
          // (it rises in slowly once ready; its hover is quick)
          style={{ transition: "opacity 1s ease-out, transform 1s ease-out, background-color 0.3s, border-color 0.3s, color 0.3s" }}
        >
          Enter the Experience
        </button>
        {/* ...or without the sound */}
        <button
          type="button"
          onClick={() => enter(true)}
          disabled={!ready}
          tabIndex={ready ? 0 : -1}
          className={`${QUIET_TYPE} cursor-pointer text-white/55 hover:text-white focus-visible:text-white focus-visible:outline-none ${
            ready ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
          style={{ transition: "opacity 1s ease-out 0.15s, transform 1s ease-out 0.15s, color 0.3s" }}
        >
          Enter quietly
        </button>
      </div>
    </div>,
    // (beside the page's <main>, inside the layout that carries the site's
    // fonts: on <body> it would fall back to Arial)
    document.querySelector("main")?.parentElement ?? document.body
  );
}

// the wordmark and the bar (shared with the cover below)
// (a button: a white outline, filling orange on hover)
const ENTER_TYPE =
  "mt-[2vw] border border-white/60 px-[1.6vw] py-[0.65vw] font-[family-name:var(--font-aeonikpro)] text-[0.95vw] max-[64rem]:mt-6 max-[64rem]:px-5 max-[64rem]:py-2.5 max-[64rem]:text-sm";
// (the quieter way in: plain text under the button, underlined)
const QUIET_TYPE =
  "mt-[1vw] font-[family-name:var(--font-aeonikpro)] text-[0.8vw] underline decoration-white/30 underline-offset-4 max-[64rem]:mt-4 max-[64rem]:text-xs";
function Face({ barRef }) {
  return (
    <>
      {/* (the wordmark is drawn dark: shown white) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/icons/hyperiux-wordmark.svg" alt="Hyperiux" className="h-auto w-[16vw] brightness-0 invert max-[64rem]:w-56" />
      <div className="mt-[1.8vw] h-px w-[16vw] overflow-hidden bg-white/12 max-[64rem]:mt-5 max-[64rem]:w-56 mb-6" aria-hidden="true">
        <div ref={barRef} className="h-full w-full origin-left bg-[#ff5f00]" style={{ transform: "scaleX(0)" }} />
      </div>
    </>
  );
}

// The loader as the page arrives, before its script runs: the same face,
// still, in the server's HTML, so the hero never shows first. The live
// loader takes its place (or it simply goes, for a review frame).
export function LoaderCover() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#111111]" aria-hidden="true">
      <Face />
      <span className={`${ENTER_TYPE} invisible`}>Enter the Experience</span>
      <span className={`${QUIET_TYPE} invisible`}>Enter quietly</span>
    </div>
  );
}
