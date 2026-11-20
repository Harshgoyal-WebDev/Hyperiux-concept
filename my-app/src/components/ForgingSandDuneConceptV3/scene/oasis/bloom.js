import * as THREE from "three";
import { pointer } from "../../pointer";
import { WATER_Y } from "../../world/oasis";

// The flowers answer the cursor: wherever it passes over them they open
// (their petals spreading flat, the head swelling and lighting up), and
// close again a moment after it has moved on.
//
// No per-flower state on the CPU: the cursor leaves a short trail of
// stamps — where its ray met the ground, and when — and every flower's
// vertex shader (Vegetation.jsx flowerMaterial) asks how close its head is
// to the line from the camera through each live stamp (so a flower on a
// bush, or high in a tree's crown, opens when the cursor is over it on
// screen, as one in the grass does), easing in after the stamp is laid and
// out once it has aged.

// tunables
export const BLOOM_STAMPS = 16; // the trail's length (shader loop count)
export const BLOOM_EVERY = 0.14; // s between stamps (the trail covers STAMPS × EVERY s)
export const BLOOM_HOLD_STILL = 0.45; // s between stamps while the cursor rests (it keeps them open)
export const BLOOM_RISE = 0.35; // s a flower takes to open
export const BLOOM_HOLD = 0.8; // s it stays open after the cursor has left
export const BLOOM_FADE = 1.0; // s it takes to close again
export const BLOOM_ANGLE = 0.085; // the brush's radius on screen (radians of view: ~60 px at 50° / 720 px)
export const BLOOM_MIN_R = 1.6; // m: and at least this, close up
export const BLOOM_GROUND_Y = WATER_Y + 0.5; // the plane the cursor's ray is laid on

export function createBloom() {
  return {
    uniforms: {
      uBloomPts: { value: Array.from({ length: BLOOM_STAMPS }, () => new THREE.Vector4(0, 0, 0, -1e4)) },
      uBloomNow: { value: 0 },
      uBloomOn: { value: 0 },
    },
    next: 0,
    last: -1e4,
    lastX: 1e9,
    lastY: 1e9,
    raycaster: new THREE.Raycaster(),
    ndc: new THREE.Vector2(),
    hit: new THREE.Vector3(),
  };
}

// once a frame: a stamp where the cursor's ray meets the ground (or far
// along it, over the horizon), whenever it has moved — and now and then
// while it rests
export function stepBloom(bloom, camera, now, enabled = true) {
  const u = bloom.uniforms;
  u.uBloomNow.value = now;
  if (enabled && pointer.active) {
    const moved = Math.hypot(pointer.x - bloom.lastX, pointer.y - bloom.lastY) > 0.004;
    const dt = now - bloom.last;
    if ((moved && dt > BLOOM_EVERY) || dt > BLOOM_HOLD_STILL) {
      bloom.ndc.set(pointer.x, pointer.y);
      bloom.raycaster.setFromCamera(bloom.ndc, camera);
      const { origin, direction } = bloom.raycaster.ray;
      let t = 400;
      if (direction.y < -1e-3) t = Math.min((BLOOM_GROUND_Y - origin.y) / direction.y, 400);
      if (t > 0) {
        bloom.hit.copy(origin).addScaledVector(direction, t);
        u.uBloomPts.value[bloom.next].set(bloom.hit.x, bloom.hit.y, bloom.hit.z, now);
        bloom.next = (bloom.next + 1) % BLOOM_STAMPS;
        bloom.last = now;
        bloom.lastX = pointer.x;
        bloom.lastY = pointer.y;
      }
    }
  }
  // (no live stamps: the shaders skip the trail altogether)
  u.uBloomOn.value = now - bloom.last < BLOOM_HOLD + BLOOM_FADE + 0.1 ? 1 : 0;
}

// The shaders' side: how open a flower whose head is at world wp is (0..1).
export const BLOOM_GLSL = /* glsl */ `
uniform vec4 uBloomPts[${BLOOM_STAMPS}];
uniform float uBloomNow;
uniform float uBloomOn;
float flBloomAt(vec3 wp) {
  if (uBloomOn < 0.5) return 0.0;
  vec3 toP = wp - cameraPosition;
  float b = 0.0;
  for (int i = 0; i < ${BLOOM_STAMPS}; i++) {
    vec4 s = uBloomPts[i];
    float age = uBloomNow - s.w;
    if (age < 0.0 || age > ${(BLOOM_RISE + BLOOM_HOLD + BLOOM_FADE).toFixed(3)}) continue;
    vec3 d = s.xyz - cameraPosition;
    float L = length(d);
    d /= max(L, 1e-3);
    float along = dot(toP, d);
    if (along < 0.0 || along > L + 30.0) continue;
    float perp = length(toP - d * along);
    float R = max(along * ${BLOOM_ANGLE.toFixed(4)}, ${BLOOM_MIN_R.toFixed(2)});
    float near = 1.0 - smoothstep(R * 0.3, R, perp);
    float e = smoothstep(0.0, ${BLOOM_RISE.toFixed(3)}, age) * (1.0 - smoothstep(${BLOOM_HOLD.toFixed(3)}, ${(BLOOM_HOLD + BLOOM_FADE).toFixed(3)}, age));
    b = max(b, near * e);
  }
  return b;
}
`;
