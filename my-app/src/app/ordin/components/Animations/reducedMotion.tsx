// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useEffect, useState } from "react";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

export function isMobile() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export function hasFinePointer() {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches === true;
}

// True when the browser draws without a GPU (SwiftShader / llvmpipe: hardware acceleration off, old or
// virtual machines, and the machines PageSpeed Insights tests on). Canvas work then runs on the CPU, so the
// heavy effects draw a lighter version.
let software: boolean | null = null;
const SOFTWARE = /swiftshader|llvmpipe|software|basic render/i;

// A WebGL effect that already has a context reports its renderer here, so the check needs no context of its
// own (creating one costs over 100ms without a GPU)
export function noteRenderer(renderer: string) {
  software = SOFTWARE.test(renderer);
  return software;
}

// The answer if it's already known, without paying for a check
export function knownSoftwareRendering() {
  return software;
}

// Checked once with a throwaway WebGL context when nothing has reported yet; call it outside page start-up
export function isSoftwareRendering() {
  if (software !== null) return software;
  if (typeof document === "undefined") return false;
  software = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) {
      // No WebGL at all usually means no usable GPU either
      software = true;
      return software;
    }
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    software = SOFTWARE.test(renderer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {}
  return software;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}
