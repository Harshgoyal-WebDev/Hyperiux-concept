import * as THREE from "three";
import { A } from "../tuning";

// The team's stage: its own place (its own scene, TeamWorld.jsx), reached
// through the bunq transition. The portrait stands at TEAM_LIFT above the ground there.
// (high enough over the land that the dunes behind sit low in the frame)
export const TEAM_LIFT = 10;
export const TEAM_CAM_DIST = 9.4;
// the team scene's own layer (TeamWorld.jsx): only the team camera sees it
export const TEAM_LAYER = 3;

// (found on the land: the flattest open ground out beyond the hero, where the
// land ahead of the team camera stays below its eye line — the dunes rise as
// a backdrop further off, never as a wall right behind the portrait)
export function teamStage(height) {
  let best = null;
  for (let z = -240; z >= -620; z -= 12) {
    for (let x = -180; x <= 180; x += 12) {
      const g = height(x, z);
      let flat = 0;
      for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [0, 12], [8, 10], [-8, 10]]) flat += Math.abs(height(x + dx, z + dz) - g);
      // the land ahead (where the camera looks), out to 90 m
      let block = 0;
      for (let d = 6; d <= 90; d += 7) {
        for (let w = -1; w <= 1; w++) {
          const rise = height(x + w * d * 0.45, z - d) - (g + TEAM_LIFT * 0.6);
          if (rise > 0) block += rise / (1 + d * 0.03);
        }
      }
      const score = flat * 2 + block + Math.abs(x) * 0.02;
      if (!best || score < best.score) best = { x, z, g, score };
    }
  }
  return new THREE.Vector3(best.x, best.g + TEAM_LIFT, best.z);
}

// The team camera: square on to the portrait, moved round it by the pointer
// (the light-strand sculpture's depth shows in the parallax).
export function teamPose(stage, S, sway, pos, target) {
  const near = THREE.MathUtils.smoothstep(S.reveal, 0.3, 1);
  // (level with the portrait, square on to it)
  pos.set(stage.x + sway.x * A.parallaxX * near, stage.y + 0.05 + sway.y * A.parallaxY * near, stage.z + TEAM_CAM_DIST - (S.teamPush || 0));
  target.copy(stage);
}
