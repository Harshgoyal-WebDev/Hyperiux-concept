"use client";

import { useFrame } from "@react-three/fiber";
import { C, S } from "../timeline";
import Atmosphere from "../scene/Atmosphere";
import CameraRig from "../scene/CameraRig";
import OrangePath from "../scene/OrangePath";
import PostFX from "../scene/PostFX";
import Rocks from "../scene/Rocks";
import { FirstFrame } from "../scene/World";
import { evaluateNight } from "./timeline";
import { nightCameraAt, nightCameraZ } from "./cameraPath";
import { NIGHT_PATH, NIGHT_PATH_LENGTH } from "./layout";
import Land from "./Land";
import Monoliths from "./Monoliths";
import Rings from "./Rings";

function Director() {
  useFrame(() => {
    evaluateNight(S.t, C);
  }, -2);
  return null;
}

// the plain kept clear of boulders: the way, the spark, the rings
const clear = (z) => {
  if (z > -48) return 12;
  if (z > -76) return 22; // round the spark
  if (z > -230) return 13;
  return 34; // the rings and the reveal
};
const NO_GAPS = [2, 2];

// The dark version's world: the wet plain at dusk among mountains, the
// spark, the ranks and the lifting blocks, the arcs that become a tunnel of
// rings, the glass core, the reveal; the orange beam through it all.
export default function NightWorld({ tier, onReady }) {
  return (
    <>
      <Director />
      <CameraRig cameraAt={nightCameraAt} />
      <Atmosphere tier={tier} />
      <Land tier={tier} />
      <Rocks tier={tier} clear={clear} monoliths={false} zFrom={60} zSpan={420} />
      <Monoliths tier={tier} />
      <Rings tier={tier} />
      <OrangePath curve={NIGHT_PATH} length={NIGHT_PATH_LENGTH} gaps={NO_GAPS} cameraZ={nightCameraZ} appear={[13, 17]} />
      {tier.post && <PostFX />}
      <FirstFrame onReady={onReady} />
    </>
  );
}
