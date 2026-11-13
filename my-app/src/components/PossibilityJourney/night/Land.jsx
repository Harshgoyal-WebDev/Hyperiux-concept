"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { T, setColor } from "../tuning";
import { limestone } from "../world/materials";
import { mulberry32 } from "../../OriginForge/world/textures";

// The land of the dark version: a wide, wet plain (a soft mirror, broken by
// puddles and drier patches of stone) and, all round it, rugged mountains
// of dark rock: low on the horizon ahead, where the sun is going down
// behind their ridges, higher and closer to either side.

// ridged noise: sharp crests, worn valleys
function ridged(noise, x, z) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    const n = 1 - Math.abs(noise(x * f, z * f));
    v += a * n * n;
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

function terrainGeometry(segments) {
  const noise = createNoise2D(mulberry32(77));
  const size = 1700;
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -160);
  const p = g.attributes.position;
  const ss = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const ax = Math.abs(x);
    // the plain: flat where the journey runs; the land rises beyond it
    const side = ss(120, 330, ax);
    const ahead = ss(-430, -620, z);
    const behind = ss(150, 330, z);
    const mask = Math.max(side, ahead * 0.62, behind);
    // ahead, near the sun's bearing, the ridges stay low so it can set behind them
    const sunGap = 1 - 0.55 * Math.exp(-Math.pow((x + 90) / 220, 2)) * ahead;
    const r = ridged(noise, x * 0.0032, z * 0.0032);
    let h = mask * (14 + 120 * Math.pow(r, 1.6)) * sunGap;
    // stony unevenness just beyond the plain's edge
    h += ss(70, 140, ax) * (1 - side) * 6 * Math.max(0, noise(x * 0.03, z * 0.03));
    p.setY(i, h - 0.8);
  }
  g.computeVertexNormals();
  return g;
}

// a roughness map for the wet ground: glossy puddles in a duller stone
function puddleTexture(size = 512) {
  const noise = createNoise2D(mulberry32(5));
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // tileable: sample a torus
      const ax = (x / size) * TAU;
      const ay = (y / size) * TAU;
      const n = noise(Math.cos(ax) * 1.6 + Math.sin(ay) * 0.7, Math.sin(ax) * 1.6 + Math.cos(ay) * 1.2) * 0.65 + noise(Math.cos(ax) * 5 + 9, Math.sin(ay) * 5 + 3) * 0.35;
      const wet = Math.min(1, Math.max(0, (n + 0.05) / 0.3));
      const v = Math.round(255 * (0.7 - wet * 0.42 + (Math.random() - 0.5) * 0.03));
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 20);
  return t;
}

export default function Land({ tier }) {
  const ground = useRef();
  const res = useMemo(() => {
    const terrain = terrainGeometry(tier.post ? 260 : 150);
    const rock = limestone(new THREE.Color("#25262b"), { key: "mountain", roughness: 0.92 });
    const puddles = puddleTexture();
    return { terrain, rock, puddles };
  }, [tier.post]);

  useEffect(
    () => () => {
      res.terrain.dispose();
      res.rock.dispose();
      res.puddles.dispose();
    },
    [res]
  );

  useFrame(() => {
    const m = ground.current;
    if (!m) return;
    setColor(m.color, T.floor);
    if (m.mixStrength !== undefined) m.mixStrength = T.floorReflection * 1.9;
  });

  return (
    <group>
      <mesh geometry={res.terrain} material={res.rock} receiveShadow={tier.shadows} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -150]} receiveShadow={tier.shadows}>
        <planeGeometry args={[280, 620]} />
        {tier.reflections ? (
          <MeshReflectorMaterial
            ref={ground}
            resolution={512}
            blur={[260, 90]}
            mixBlur={0.75}
            mixStrength={1.6}
            mixContrast={1.1}
            mirror={0.85}
            depthScale={0.4}
            minDepthThreshold={0.5}
            maxDepthThreshold={1.4}
            roughness={1}
            roughnessMap={res.puddles}
            metalness={0.2}
            color="#0e0f12"
          />
        ) : (
          <meshStandardMaterial ref={ground} color="#0e0f12" roughness={1} roughnessMap={res.puddles} metalness={0.2} />
        )}
      </mesh>
    </group>
  );
}
