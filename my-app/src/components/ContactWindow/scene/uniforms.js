import * as THREE from "three";

// The uniforms every material of the scene shares (set once a frame by the
// Director from the choreography: scene/choreography.js).
export function createSceneUniforms() {
  return {
    uTime: { value: 0 },
    uContact: { value: new THREE.Vector3() },
    uEnergy: { value: 0 },
    uFlash: { value: 0 },
    uShock: { value: 0 },
    uFocus: { value: 40 },
    uDof: { value: 1 },
    uScale: { value: 1000 },
    uFade: { value: 1 },
    uGlow: { value: 0 },
    uPixelRatio: { value: 1 },
    // the pointer: where it is on screen (−1..1), and how present it is (0..1)
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseOn: { value: 0 },
    uAspect: { value: 1 },
  };
}
