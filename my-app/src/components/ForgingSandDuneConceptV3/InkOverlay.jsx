"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// The light at the end: white ink spreading from the centre of the screen
// out over all of it, onto the white site below. Drawn on the GPU (its own
// small WebGL canvas, at a fraction of the screen's resolution — the soft
// edge hides it), redrawn only when the scroll moves it: a field of
// domain-warped noise laid over the distance from the centre, so the ink
// runs out unevenly — fingers and tendrils reaching ahead, blots blooming
// on their own before the main body reaches them — until, at the end, the
// whole screen is white (then it is just a white sheet, the site's own
// colour, and the canvas rests).
//
// set(w): 0 none … 1 the whole screen white.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const FRAG = `
precision highp float;
uniform float uK;
uniform vec2 uAspect;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  // (0 at the centre, 1 at the farthest corner)
  float d = length(p) / length(uAspect * 0.5);
  // the ink's own uneven flow: noise warped by noise, drifting as it spreads
  vec2 q = vec2(fbm(p * 2.2 + uK * 0.6), fbm(p * 2.2 + vec2(5.2, 1.3) - uK * 0.4));
  float n = fbm(p * 3.1 + q * 2.4 + uK * 0.8);
  float fine = fbm(p * 11.0 + q * 3.0);
  float f = d * 0.78 + (n - 0.5) * 0.85 + (fine - 0.5) * 0.12;
  // its front: from before the centre to past every corner
  float k = mix(-0.45, 1.25, uK);
  // (edges in order: a reversed smoothstep is undefined in GLSL)
  float ink = 1.0 - smoothstep(k - 0.012, k + 0.012, f);
  // (a faint wash just ahead of it, where it is soaking in)
  ink = max(ink, (1.0 - smoothstep(k, k + 0.09, f)) * 0.25);
  // (premultiplied: white where the ink is, nothing at all where it is not)
  gl_FragColor = vec4(vec3(ink), ink);
}
`;

const InkOverlay = forwardRef(function InkOverlay(_, ref) {
  const canvasRef = useRef(null);
  const sheetRef = useRef(null);
  const gl = useRef(null);
  const last = useRef(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!ctx) return undefined;
    const sh = (type, src) => {
      const s = ctx.createShader(type);
      ctx.shaderSource(s, src);
      ctx.compileShader(s);
      return s;
    };
    const prog = ctx.createProgram();
    ctx.attachShader(prog, sh(ctx.VERTEX_SHADER, VERT));
    ctx.attachShader(prog, sh(ctx.FRAGMENT_SHADER, FRAG));
    ctx.linkProgram(prog);
    ctx.useProgram(prog);
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(prog, "aPos");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    gl.current = { ctx, uK: ctx.getUniformLocation(prog, "uK"), uAspect: ctx.getUniformLocation(prog, "uAspect") };
    const resize = () => {
      // (a fraction of the screen's pixels: the edge is soft, and it is cheap)
      const s = 0.5;
      canvas.width = Math.max(Math.round(window.innerWidth * s), 2);
      canvas.height = Math.max(Math.round(window.innerHeight * s), 2);
      last.current = -1;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      // (its resources freed, the context kept: a remount — React's dev
      // double mount — gets the same context back, and a lost one shows white)
      ctx.deleteBuffer(buf);
      ctx.deleteProgram(prog);
      gl.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    set(w) {
      const k = Math.min(Math.max(w, 0), 1);
      const canvas = canvasRef.current;
      const sheet = sheetRef.current;
      if (!canvas || !sheet) return;
      // all white: the plain sheet, the canvas resting
      const full = k >= 0.999;
      sheet.style.opacity = full ? "1" : "0";
      canvas.style.opacity = k > 0.001 && !full ? "1" : "0";
      if (k <= 0.001 || full || Math.abs(k - last.current) < 1e-4) return;
      last.current = k;
      const g = gl.current;
      if (!g) {
        sheet.style.opacity = String(k);
        return;
      }
      const { ctx } = g;
      ctx.viewport(0, 0, canvas.width, canvas.height);
      ctx.clearColor(0, 0, 0, 0);
      ctx.clear(ctx.COLOR_BUFFER_BIT);
      ctx.uniform1f(g.uK, k);
      ctx.uniform2f(g.uAspect, canvas.width / canvas.height, 1);
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
    },
  }));

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full opacity-0" />
      <div ref={sheetRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-white opacity-0" />
    </>
  );
});

export default InkOverlay;
