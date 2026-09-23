"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Vector3, VideoTexture, SRGBColorSpace } from "three";

const VIDEO_SRC = "/assets/models/bg-video.mp4";

// A dim, full-screen backdrop for the glass logo's own scene (see
// PortalInnerScene.jsx) — that scene is otherwise a bare black void behind
// the transmission material, so this also gives MeshTransmissionMaterial's
// own backdrop sampling something to actually refract/distort through the
// glass instead of flat black.
//
// The plane tracks the shared camera every frame (position + orientation +
// size, from its fov/aspect) rather than living at a fixed world position —
// PortalRenderer renders this scene with the SAME live camera used for the
// scroll-driven arc around the hero scene (see PortalRenderer.jsx), so a
// world-space-fixed plane would drift out of frame as that camera moves.
// Sitting a fixed distance directly in front of the camera and resizing to
// exactly fill its frustum at that distance keeps it covering the full
// screen regardless.
const DISTANCE = 60;

export default function PortalBackgroundVideo({ opacity = 0.3 }) {
  const meshRef = useRef(null);
  const forwardRef = useRef(new Vector3());

  // The video element/texture are built client-side only (after mount) and
  // handed to the material through state — not read back out of a ref
  // during render — once created, matching the pattern used for the
  // curve-simulator/ridge-plane pages' own ref-only-mutated-in-callbacks
  // conventions.
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    const video = document.createElement("video");
    video.src = VIDEO_SRC;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    // A <video> that's never attached to the document is exactly what was
    // making this laggy: Chrome (and others) treat an unattached media
    // element as invisible and heavily throttle its decode rate — often
    // down to just a few frames a second — regardless of how fast the
    // WebGL texture side tries to sample it. Actually inserting it into
    // the DOM (off-screen and invisible, but present) is what unlocks full
    // frame-rate decoding for a video used purely as a texture source.
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);
    video.play().catch(() => {});

    const videoTexture = new VideoTexture(video);
    videoTexture.colorSpace = SRGBColorSpace;
    setTexture(videoTexture);

    return () => {
      video.pause();
      video.remove();
      video.src = "";
      videoTexture.dispose();
    };
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const camera = state.camera;
    const forward = forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    mesh.position.copy(camera.position).addScaledVector(forward, DISTANCE);
    mesh.quaternion.copy(camera.quaternion);

    const verticalFov = MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(verticalFov / 2) * DISTANCE;
    const width = height * camera.aspect;
    mesh.scale.set(width, height, 1);
  });

  if (!texture) return null;

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}
