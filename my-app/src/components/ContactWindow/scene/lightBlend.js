import * as THREE from "three";

// Additive light that leaves the frame's alpha alone: the hands' canvas is
// see-through now (the about hero's world behind it — AboutBackdrop.jsx), so
// its glow adds onto what is behind without covering it — never a dark quad
// round a sprite, never the dunes dimmed behind the particles.
export const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};
