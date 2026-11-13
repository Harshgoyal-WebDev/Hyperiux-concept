import * as THREE from "three";

export const ORANGE = new THREE.Color("#FF6A00");
export const LIMESTONE = new THREE.Color("#E8DED1");
export const BEIGE = new THREE.Color("#D6C5B3");
export const WARM_WHITE = new THREE.Color("#F7F4F0");
export const TAUPE = new THREE.Color("#958578");

// Value noise in 3D (cheap) and a travertine pattern from it: soft clouding,
// fine horizontal bedding and the occasional pore. Read in world space, so
// every surface shares one continuous stone with no uvs needed.
const STONE_GLSL = /* glsl */ `
  float stHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float stNoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(stHash(i), stHash(i + vec3(1,0,0)), f.x), mix(stHash(i + vec3(0,1,0)), stHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(stHash(i + vec3(0,0,1)), stHash(i + vec3(1,0,1)), f.x), mix(stHash(i + vec3(0,1,1)), stHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float stFbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * stNoise(p); p *= 2.07; a *= 0.5; } return v / 0.875; }
  float travertine(vec3 p) {
    float cloud = stFbm(p * 0.18);
    float bed = stFbm(vec3(p.x * 0.05, p.y * 2.6, p.z * 0.05) + cloud * 1.5);
    float pores = smoothstep(0.78, 0.86, stNoise(p * 3.1)) * 0.5;
    return (cloud - 0.5) * 0.55 + (bed - 0.5) * 0.6 - pores * 0.35;
  }
`;

// Limestone: warm, matte, a very subtle natural variation (uStone sets how
// much). One program, shared by every wall; `uStone` is a shared uniform.
export const stoneUniforms = { uStone: { value: 1 } };
export function limestone(color = LIMESTONE, { roughness = 0.88, key = "a" } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.6 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uStone = stoneUniforms.uStone;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vStoneP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvStoneP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vStoneP;\nuniform float uStone;\nfloat stTv;\n${STONE_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        stTv = travertine(vStoneP);
        float tv = stTv;
        diffuseColor.rgb *= 1.0 + tv * 0.22 * uStone;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.03, 0.99, 0.95), clamp(tv * 1.5, 0.0, 1.0) * 0.4 * uStone);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - stTv * 0.18 * uStone, 0.05, 1.0);`
      );
  };
  m.customProgramCacheKey = () => `pj-limestone2-${key}`;
  return m;
}

// The orange path: a flat ribbon on the floor (and wherever it is carried),
// drawn up to uReveal along its length (aT), with a bright head; uGap breaks
// it into segments (the challenge), uSoft makes it gentler (the courtyard).
export function pathMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uReveal: { value: 0 },
        uGap: { value: 0 },
        uGapFrom: { value: 0.22 },
        uGapTo: { value: 0.4 },
        uSoft: { value: 0 },
        uIntensity: { value: 1 },
        uColor: { value: new THREE.Color("#ff5f00") },
        uGold: { value: new THREE.Color("#ffc25a") },
        uLength: { value: 500 },
      },
    ]),
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute float aAcross;
      varying float vT;
      varying float vAcross;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vT = aT;
        vAcross = aAcross;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReveal, uGap, uGapFrom, uGapTo, uSoft, uIntensity, uLength;
      uniform vec3 uColor, uGold;
      varying float vT;
      varying float vAcross;
      #include <common>
      #include <fog_pars_fragment>
      float h11(float x) { return fract(sin(x * 91.17) * 43758.5453); }
      void main() {
        // drawn up to the reveal, its tip a soft bright head
        float m = uLength;
        float drawn = 1.0 - smoothstep(uReveal - 1.5 / m, uReveal, vT);
        if (drawn <= 0.001) discard;
        float head = smoothstep(uReveal - 10.0 / m, uReveal, vT) * drawn;
        // a beam: a hot golden core, a body of #ff5f00, a soft halo.
        // Antialiased in screen space: fw is how much of the ribbon's width
        // one pixel covers, so no edge is ever sharper than a pixel and the
        // beam never thinner than ~1.5 pixels; where it has to be widened to
        // stay that size it is dimmed in proportion, so its light stays even
        // with distance instead of breaking up into stair-steps.
        float x = abs(vAcross);
        float fw = max(fwidth(vAcross), 1e-5);
        float cw = max(0.04, fw * 1.6);
        float bw = max(0.1, fw * 2.6);
        float core = 1.0 - smoothstep(cw * 0.25, cw + fw, x);
        float body = 1.0 - smoothstep(bw * 0.35, bw + fw, x);
        float thin = clamp(0.1 / bw, 0.25, 1.0);
        float halo = exp(-x * 6.5) * (1.0 - x);
        // broken into lengths where the challenge pulls things apart
        float inGaps = smoothstep(uGapFrom - 0.01, uGapFrom + 0.01, vT) * (1.0 - smoothstep(uGapTo - 0.01, uGapTo + 0.01, vT));
        float cell = floor(vT * m / 2.6);
        float gap = step(h11(cell), 0.5) * inGaps * uGap;
        float flick = 1.0 - gap;
        float k = (body * mix(0.55, 1.0, thin) + halo * 0.6) * mix(1.0, 0.65, uSoft);
        // bright enough (HDR) for the bloom to catch it and nothing else
        vec3 col = mix(uColor, uGold, core * 0.85) * (2.4 + core * 2.6 * thin + head * 4.0) * uIntensity;
        // the halo: a warm wash of light on the stone either side
        col = mix(uColor * (0.8 + halo * 1.2) * uIntensity, col, clamp(body + core, 0.0, 1.0));
        float a = clamp(k * drawn * flick, 0.0, 1.0);
        // (an inlay on the light stone: drawn over it, not added to it, so it
        // stays orange; its HDR brightness is what blooms)
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
}

// a flat ribbon along a curve: `width` across, aT (0–1 along) and aAcross
// (-1..1) per vertex. Lies on the curve's own up (y).
export function ribbonAlong(curve, width = 0.3, segments = 1400) {
  const pts = curve.getSpacedPoints(segments);
  const pos = new Float32Array((segments + 1) * 2 * 3);
  const t = new Float32Array((segments + 1) * 2);
  const across = new Float32Array((segments + 1) * 2);
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const p = pts[i];
    const q = pts[Math.min(segments, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    tan.subVectors(q, o).normalize();
    side.crossVectors(tan, up).normalize();
    for (let s = 0; s < 2; s++) {
      const k = (i * 2 + s) * 3;
      const sg = s === 0 ? -1 : 1;
      pos[k] = p.x + side.x * width * 0.5 * sg;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z + side.z * width * 0.5 * sg;
      t[i * 2 + s] = i / segments;
      across[i * 2 + s] = sg;
    }
  }
  const idx = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  g.setAttribute("aAcross", new THREE.BufferAttribute(across, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// A canvas texture for a glass panel: an icon and a name, warm white on
// clear (alpha), as etched into the pane.
export function etchedPanel({ icon, name, n }, family = "Arial, sans-serif") {
  const W = 512;
  const H = 712;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.clearRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 7;
  g.lineJoin = "round";
  g.lineCap = "round";
  const cx = W / 2;
  const cy = 250;
  g.save();
  g.translate(cx, cy);
  drawIcon(g, icon);
  g.restore();
  g.textAlign = "center";
  g.font = `400 26px ${family}`;
  g.globalAlpha = 0.7;
  g.fillText(n, cx, 92);
  g.globalAlpha = 1;
  g.font = `400 44px ${family}`;
  name.split("\n").forEach((line, i) => g.fillText(line, cx, 420 + i * 54));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function drawIcon(g, icon) {
  const s = 1;
  g.beginPath();
  if (icon === "strategy") {
    // stacked layers
    for (let k = 0; k < 3; k++) {
      const y = -46 + k * 38;
      g.moveTo(-70 * s, y);
      g.lineTo(0, y - 34);
      g.lineTo(70 * s, y);
      g.lineTo(0, y + 34);
      g.closePath();
    }
  } else if (icon === "design") {
    // a framed image with a mountain and a sun
    g.rect(-70, -56, 140, 112);
    g.moveTo(-70, 40);
    g.lineTo(-22, -6);
    g.lineTo(14, 28);
    g.lineTo(34, 10);
    g.lineTo(70, 44);
    g.moveTo(38, -24);
    g.arc(30, -24, 12, 0, Math.PI * 2);
  } else if (icon === "technology") {
    // code brackets
    g.moveTo(-34, -46);
    g.lineTo(-78, 0);
    g.lineTo(-34, 46);
    g.moveTo(34, -46);
    g.lineTo(78, 0);
    g.lineTo(34, 46);
    g.moveTo(14, -60);
    g.lineTo(-14, 60);
  } else if (icon === "growth") {
    // rising bars
    [-48, -16, 16, 48].forEach((x, k) => {
      g.moveTo(x, 56);
      g.lineTo(x, 56 - (k + 1) * 26);
    });
  }
  g.stroke();
}

// Paneled metal (the sculptures and the monolith field): dark brushed metal
// cut into plates by fine seams, each plate a slightly different finish. The
// seams are laid out in each object's own space (an instance's scale read
// back from its matrix), so they follow every block's edges at any tilt.
// With the per-instance attribute aGlow, the vertical edges of its side
// faces burn with a line of orange light (bright enough to bloom).
export const panelUniforms = { uGlowColor: { value: new THREE.Color("#ff5f00").multiplyScalar(5) } };
export function panelMetal(color = "#3a3836", { key = "a", roughness = 0.36, metalness = 0.82 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 2.6 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowColor = panelUniforms.uGlowColor;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying vec3 vPanel;\nvarying vec3 vPanelN;\nvarying vec3 vHalf;\nvarying float vGlow;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vPanel = position * sc;
          vHalf = sc * 0.5;
        #else
          vPanel = position;
          vHalf = vec3(1000.0);
        #endif
        vPanelN = normal;
        vGlow = aGlow;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uGlowColor;
        varying vec3 vPanel;
        varying vec3 vPanelN;
        varying vec3 vHalf;
        varying float vGlow;
        float pnH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float panelCell;
        float panelSeam;
        vec2 panelQ;
        vec2 panelHS;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 an = abs(vPanelN);
        if (an.x > 0.5) { panelQ = vPanel.zy; panelHS = vHalf.zy; }
        else if (an.z > 0.5) { panelQ = vPanel.xy; panelHS = vHalf.xy; }
        else { panelQ = vPanel.xz; panelHS = vHalf.xz; }
        vec2 g;
        if (panelHS.x > 100.0) g = panelQ / vec2(1.8, 2.4);
        else {
          // plates of about 1.7 x 2.4 m, the count fitted to the face
          vec2 cells = max(floor(panelHS * 2.0 / vec2(1.7, 2.4) + 0.5), 1.0);
          g = (panelQ + panelHS) / (panelHS * 2.0) * cells;
        }
        vec2 fq = abs(fract(g) - 0.5);
        vec2 px = max(fwidth(g), vec2(1e-4));
        panelSeam = max(smoothstep(0.5 - px.x * 1.4, 0.5, fq.x), smoothstep(0.5 - px.y * 1.4, 0.5, fq.y));
        panelCell = pnH(floor(g) + floor(vPanelN.xz * 3.0));
        diffuseColor.rgb *= (0.84 + 0.3 * panelCell) * (1.0 - panelSeam * 0.6);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (0.75 + 0.5 * panelCell) + panelSeam * 0.4, 0.05, 1.0);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (vGlow > 0.0 && panelHS.x < 100.0) {
          float sideFace = 1.0 - step(0.5, abs(vPanelN.y));
          float edge = panelHS.x - abs(panelQ.x);
          // at least ~2 pixels wide however far away (dimmed as it widens)
          float ew = max(0.1, fwidth(panelQ.x) * 2.5);
          float glowLine = (1.0 - smoothstep(ew * 0.3, ew, edge)) * sideFace;
          totalEmissiveRadiance += uGlowColor * glowLine * vGlow * clamp(0.1 / ew, 0.45, 1.0);
        }`
      );
  };
  m.customProgramCacheKey = () => `pj-panel-${key}`;
  return m;
}
