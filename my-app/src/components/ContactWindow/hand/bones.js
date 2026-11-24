// The rig's bone layout (shared by hand/handModel.js, which folds the model's
// armature onto it, and hand/handRig.js, which poses it — kept apart so the
// rig never pulls the model loader into the page's bundle):
//   0              the forearm
//   1 + f·3 + j    finger f (FINGERS), joint j (base, middle, end)
//   WRIST_BONE     the hand itself, turning on the forearm at the wrist
export const FINGERS = ["thumb", "index", "middle", "ring", "little"];
export const WRIST_BONE = 1 + FINGERS.length * 3;
export const BONE_COUNT = WRIST_BONE + 1;
export const INDEX_DISTAL_BONE = 1 + 3 * 1 + 2;
