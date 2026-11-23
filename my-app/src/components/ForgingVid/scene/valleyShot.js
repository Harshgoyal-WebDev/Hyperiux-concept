import * as THREE from "three";
import { T } from "../tuning";
import { CUT_TO, oasisCamera, routeDistance } from "../world/oasisCamera";
import { beamFrameAt, beamLength, beamPointAt, cameraQAt } from "./oasis/Streaks";

// The valley's shot at p (past the mark): the camera's place and aim, and
// its lens. One function for the CameraRig and for the cut's view into the
// valley (CutTransition), so the shot seen through the hexagons is exactly
// the one the camera carries on in once the cut is over — no hand-over.
// (where the valley's beam is, for the camera to follow it: Streaks)
const beam = { head: new THREE.Vector3(), back: new THREE.Vector3(), under: new THREE.Vector3(), ahead: new THREE.Vector3(), fwd: new THREE.Vector3() };

export function valleyShot(p, pos, tgt) {
  const lens = oasisCamera(p, pos, tgt);
  // ...following the beam (Streaks beamFrameAt: in step with it, frame
  // for frame): its aim drawn along with the beam's head as it runs on
  // ahead (T.camFollowBeam), and then — as it runs on in to the core —
  // riding it: just behind its head (T.camRideBehind m back along it),
  // over it (T.camRideLift m), looking where it goes, until it touches
  // the sphere; then handing over to the turn round the tree
  const touch = T.tlBeamToTreeEnd;
  // ...on one pace with the beam (T.camBeamPace: Streaks cameraQAt): over
  // its line, moving evenly along it, looking on along it — and at the
  // end at the cube it runs into — the beam's head a lead ahead that
  // reaches the cube just as the touch comes; after the touch handed over
  // to the turn round the tree (T.camRideRelease)
  const qc = T.camBeamPace ? cameraQAt(p) : null;
  if (qc !== null && beamPointAt(qc, beam.under) && beamPointAt(Math.min(qc + T.camOverLook, beamLength()), beam.ahead)) {
    const w = 1 - THREE.MathUtils.smootherstep(p, touch, touch + T.camRideRelease);
    if (w > 0) {
      pos.x += (beam.under.x - pos.x) * w;
      pos.z += (beam.under.z - pos.z) * w;
      // (low over the beam all the way in: T.camOverHeight)
      pos.y += (beam.under.y + T.camOverHeight - pos.y) * w;
      // (its aim a touch down along the beam; onto the cube at the end)
      const end = THREE.MathUtils.smoothstep(qc + T.camOverLook, beamLength() - 60, beamLength());
      beam.ahead.y = THREE.MathUtils.lerp(pos.y - 1.4, beam.ahead.y, end);
      tgt.lerp(beam.ahead, w);
    }
  }
  // ...and all the way in, attached to the beam (T.camOverBeam): over the
  // point of it level with the camera along the way, looking on along it
  // (to the point T.camOverLook m further on) — so it turns as the beam
  // turns and the beam always runs straight ahead from under it; near the
  // end that point is the sphere, so it looks straight down the beam into
  // it. It holds back T.camSphereDist m short of the sphere (eased: no
  // stop), and after the touch hands over smoothly to the turn round the
  // tree (T.camRideRelease)
  // (drawn in along it closer to the sphere than the way alone takes it:
  // what is left to go × (1 − T.camApproachCloser), eased in over the
  // approach — it keeps moving forwards all the while)
  const closer = T.camApproachCloser * THREE.MathUtils.smoothstep(p, CUT_TO(), touch);
  const s = beamLength() - (beamLength() - routeDistance(p)) * (1 - closer);
  const qEnd = beamLength() - T.camSphereDist;
  const kSoft = 45;
  // (a soft min of the two: it slows into the hold rather than stopping dead)
  const d = (qEnd - s) / kSoft;
  const qCam = d > 30 ? s : qEnd - kSoft * Math.log1p(Math.exp(d));
  const over =
    THREE.MathUtils.smootherstep(p, CUT_TO() + 0.004, CUT_TO() + 0.035) *
    (1 - THREE.MathUtils.smootherstep(p, touch + T.camHoldAfterTouch, touch + T.camHoldAfterTouch + T.camRideRelease)) *
    T.camOverBeam;
  if (over > 0 && beamPointAt(qCam, beam.under) && beamPointAt(Math.min(qCam + T.camOverLook, beamLength()), beam.ahead)) {
    pos.x += (beam.under.x - pos.x) * over;
    pos.z += (beam.under.z - pos.z) * over;
    // (low over it, at one height: it never lifts off the beam on the way in)
    pos.y += (beam.under.y + T.camOverHeight - pos.y) * over;
    tgt.lerp(beam.ahead, over);
  }
  // (riding the beam's head right in to the sphere: off by default — a
  // close-up the sphere filled)
  if (T.camRide && beamFrameAt(p, T.camRideBehind, beam.head, beam.back)) {
    const rideFrom = T.tlBeamToTreeStart - T.camRideLead;
    const ride = THREE.MathUtils.smootherstep(p, rideFrom, T.tlBeamToTreeStart) * (1 - THREE.MathUtils.smootherstep(p, touch, touch + T.camRideRelease));
    if (ride > 0) {
      beam.back.y += T.camRideLift;
      pos.lerp(beam.back, ride);
      tgt.lerp(beam.head, ride);
    }
  }
  return lens;
}
