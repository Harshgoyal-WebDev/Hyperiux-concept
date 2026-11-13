"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { limestone, panelMetal } from "../world/materials";
import { mulberry32 } from "../../OriginForge/world/textures";

// The land the journey runs through: tall monoliths of paneled dark metal
// stand in ranks either side of the way (some leaning; a quarter burning
// along an edge with a line of orange light), and metallic rock lies heaped
// at their feet, holding the last light on its faces. Every opening in the
// architecture frames them against the dusk. Two instanced draws in
// all, set once; kept clear of the way itself.
const dummy = new THREE.Object3D();

// the way through: the journey's spaces, kept clear (|x| beyond, per z)
function clearance(z) {
  if (z > 20) return 34; // round the opening's shell
  if (z > -175) return 26; // the path and the passage
  if (z > -232) return 36; // the hall of glass
  if (z > -312) return 22; // the gallery
  if (z > -370) return 30; // the courtyard
  return 14;
}

export default function Rocks({ tier, clear = clearance, monoliths: withMonoliths = true, zFrom = 70, zSpan = 470 }) {
  const monoliths = useRef();
  const boulders = useRef();
  const res = useMemo(() => {
    const rand = mulberry32(19);
    const mono = [];
    let guard = 0;
    while (withMonoliths && mono.length < (tier.post ? 170 : 90) && guard++ < 4000) {
      const z = zFrom - rand() * zSpan;
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (clear(z) + Math.pow(rand(), 0.7) * 85);
      const h = 7 + Math.pow(rand(), 1.4) * 34;
      const lean = rand() < 0.28 ? (rand() - 0.5) * 0.5 : (rand() - 0.5) * 0.08;
      mono.push({
        p: [x, h / 2 - 0.6, z],
        r: [(rand() - 0.5) * 0.08, rand() * Math.PI, lean],
        s: [2 + rand() * 6, h, 1.4 + rand() * 4.5],
        glow: rand() < 0.26 ? 0.6 + rand() * 0.6 : 0, // a quarter burn along an edge
      });
    }
    const rubble = [];
    guard = 0;
    while (rubble.length < (tier.post ? 320 : 140) && guard++ < 6000) {
      const z = zFrom - 10 - rand() * zSpan;
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (clear(z) - 4 + Math.pow(rand(), 1.2) * 70);
      const s = 0.4 + Math.pow(rand(), 2.2) * 3.4;
      rubble.push({ p: [x, s * 0.35, z], r: [rand() * 3, rand() * 3, rand() * 3], s: [s * (0.9 + rand() * 0.6), s * (0.6 + rand() * 0.5), s * (0.9 + rand() * 0.6)] });
    }
    const monoGeo = new THREE.BoxGeometry(1, 1, 1);
    monoGeo.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, mono.length)), 1).copyArray(mono.map((m) => m.glow)));
    const monoMat = panelMetal("#34322f", { key: "mono" });
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    // dark metallic rock: polished enough to hold the dusk on its faces, its
    // grain (the stone's variation) breaking the shine up across each one
    const mat = limestone(new THREE.Color("#2c2d31"), { key: "rock", roughness: 0.3 });
    mat.metalness = 0.82;
    mat.envMapIntensity = 3.2;
    return { mono, rubble, monoGeo, rockGeo, mat, monoMat };
  }, [tier.post, clear, withMonoliths, zFrom, zSpan]);

  useEffect(() => {
    for (const [mesh, list] of [
      [monoliths.current, res.mono],
      [boulders.current, res.rubble],
    ]) {
      list.forEach((d, i) => {
        dummy.position.set(...d.p);
        dummy.rotation.set(...d.r);
        dummy.scale.set(...d.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [res]);

  useEffect(
    () => () => {
      res.monoGeo.dispose();
      res.rockGeo.dispose();
      res.mat.dispose();
      res.monoMat.dispose();
    },
    [res]
  );

  return (
    <group>
      <instancedMesh ref={monoliths} visible={res.mono.length > 0} args={[res.monoGeo, res.monoMat, Math.max(1, res.mono.length)]} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <instancedMesh ref={boulders} args={[res.rockGeo, res.mat, res.rubble.length]} castShadow={tier.shadows} receiveShadow={tier.shadows} />
    </group>
  );
}
