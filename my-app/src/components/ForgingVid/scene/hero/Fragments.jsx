"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fragmentGeometry } from "../../world/ruins";
import { mulberry32 } from "../../world/layout";
import { T } from "../../tuning";
import { heroBlast, reducedMotion } from "./heroState";

// Sandstone fragments floating round the slab: a few larger stones either
// side of it and a scatter of chips, each rising and falling, turning and
// drifting round the core at its own pace. None hangs in front of the cube.
// As the beam merges into the core the blast throws them out and they are
// gone (heroState.js). Instanced: one draw per shape.

// The larger stones: offset from the core (m) and size (m).
const STONES = [
  [-33, 4, 4, 7.2],
  [39, 22, -6, 6.0],
  [35, 1, 8, 5.0],
  [-42, 17, -10, 3.6],
  [-24, 28, 12, 2.8],
  [48, -9, -14, 3.8],
  [-50, -6, -18, 2.6],
];
const CHIPS = 26;
const SHAPES = 3; // shapes of the larger stones (the chips have their own)

function buildPieces() {
  const rng = mulberry32(613);
  const pieces = STONES.map(([x, y, z, size], i) => ({ base: new THREE.Vector3(x, y, z), size, shape: i % SHAPES, chip: false }));
  let guard = 0;
  while (pieces.length < STONES.length + CHIPS && guard++ < 2000) {
    const a = rng() * Math.PI * 2;
    const r = 26 + rng() * 26;
    const p = new THREE.Vector3(Math.cos(a) * r, -12 + rng() * 42, Math.sin(a) * r * 0.6);
    // (clear of the cube's opening and the slab's face)
    if (Math.abs(p.x) < 16 && p.y > -14 && p.y < 16) continue;
    if (Math.abs(p.x) < 31 && p.z > -9) continue; // (none in front of the slab's face)
    pieces.push({ base: p, size: 0.5 + rng() * rng() * 1.3, shape: SHAPES, chip: true });
  }
  return pieces.map((p, i) => ({
    ...p,
    axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
    spin: (0.04 + rng() * 0.1) * (rng() < 0.5 ? -1 : 1) * (p.chip ? 2.2 : 1),
    turn0: rng() * Math.PI * 2,
    bob: (p.chip ? 0.5 : 0.9) + rng() * 1.1,
    bobRate: 0.18 + rng() * 0.22,
    phase: rng() * Math.PI * 2,
    drift: (0.004 + rng() * 0.008) * (i % 2 ? 1 : -1), // rad/s round the core
    glow: rng() < 0.35 ? 0.5 + rng() * 0.5 : 0,
    seed: rng(),
  }));
}

export default function Fragments({ J, core, material }) {
  const built = useMemo(() => {
    const pieces = buildPieces();
    const geometries = [...Array(SHAPES)].map((_, i) => fragmentGeometry(701 + i * 13));
    geometries.push(fragmentGeometry(761));
    const groups = geometries.map((geometry, shape) => {
      const list = pieces.filter((p) => p.shape === shape);
      geometry.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(list.map((p) => p.glow)), 1));
      geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(list.map((p) => p.seed)), 1));
      return { geometry, list };
    });
    return { groups };
  }, []);
  useEffect(() => () => built.groups.forEach((g) => g.geometry.dispose()), [built]);

  const meshes = useRef([]);
  const root = useRef();
  const clock = useRef(0);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), turn: new THREE.Quaternion() }),
    []
  );

  useFrame((_, delta) => {
    const blast = heroBlast(J.progress);
    if (root.current) root.current.visible = blast < 0.999;
    if (blast >= 0.999) return;
    if (!reducedMotion()) clock.current += Math.min(delta, 0.1);
    const t = clock.current;
    const { m, p, q, s, up, turn } = tmp;
    built.groups.forEach((g, gi) => {
      const mesh = meshes.current[gi];
      if (!mesh) return;
      g.list.forEach((f, i) => {
        // drifting round the core, rising and falling
        turn.setFromAxisAngle(up, f.drift * t);
        p.copy(f.base).applyQuaternion(turn);
        p.y += Math.sin(t * f.bobRate + f.phase) * f.bob * T.fragmentFloat;
        // the blast throws it out, up a little, and it is gone
        p.multiplyScalar(1 + blast * 2.4);
        p.y += blast * 8;
        p.add(core);
        q.setFromAxisAngle(f.axis, f.turn0 + t * f.spin * T.fragmentSpin);
        s.setScalar(f.size * (1 - blast) ** 1.5);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group ref={root}>
      {built.groups.map((g, gi) => (
        <instancedMesh
          key={gi}
          ref={(el) => (meshes.current[gi] = el)}
          args={[g.geometry, material, g.list.length]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
