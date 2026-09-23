import * as THREE from "three";

// Pointy-top hexagon vertex angles, in order around the hex, starting
// straight up. Every hexagon in the grid is drawn as its own 6-edge
// boundary plus 3 spokes from its center to the ALTERNATING vertices at
// indices 0/2/4 (up, down-left, down-right) — not all 6. Spoking only every
// other vertex is what leaves each of the 3 resulting rhombi (the cube's
// top/left/right faces) as a single blank face with no line crossing it;
// spoking all 6 (equivalently, drawing the full triangular lattice) would
// cut a diagonal straight through every face instead.
const HEX_ANGLES_DEG = [90, 150, 210, 270, 330, 30];
const SPOKE_INDICES = [0, 2, 4];

// Tiled edge-to-edge via THREE.RepeatWrapping, this reads as the classic
// "isometric cube grid": a honeycomb of hexagons, each split into 3 blank
// rhombus faces by its own spokes. The canvas is sized to exactly one
// lattice period so plain rectangular RepeatWrapping tiles it with no
// visible seam.
export function createCubeGridTexture({
  backgroundColor = "#1a1a1a",
  lineColor = "#333333",
  cubeSize = 64,
  lineWidth = 1.5,
  rotationDeg = 0,
}) {
  const radius = Math.max(2, cubeSize / 2);

  // Vertical row spacing for pointy-top hexagons is 1.5x the radius, and
  // the lattice's vertical period is 2 rows — canvasHeight is rounded
  // first (an integer pixel count) and every other measurement is then
  // derived back from it, so the drawn geometry's own period exactly
  // matches the canvas's actual pixel height (any mismatch there is what
  // causes a seam).
  const canvasHeight = Math.max(4, Math.round(3 * radius));
  const rowSpacing = canvasHeight / 2;
  const effectiveRadius = rowSpacing / 1.5;
  // Horizontal spacing between hex centers in the same row (= sqrt(3) *
  // radius) is the lattice's horizontal period.
  const canvasWidth = Math.max(4, Math.round(Math.sqrt(3) * effectiveRadius));

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "square";
  ctx.lineJoin = "round";
  ctx.beginPath();

  const vertexOffsets = HEX_ANGLES_DEG.map((deg) => {
    // Negated sin: canvas Y increases downward, but the angles above are
    // written in the usual "90deg = up" convention — without the negation,
    // the "up" spoke was actually drawn toward the bottom of the image
    // (and vice versa), which is what made the whole pattern read as
    // rotated/upside-down once mapped onto the plane.
    const rad = (deg * Math.PI) / 180;
    return [effectiveRadius * Math.cos(rad), -effectiveRadius * Math.sin(rad)];
  });

  // A ring of hexagons beyond every edge so ones whose centers sit outside
  // the canvas but whose edges/spokes cross into it are still drawn in
  // full here — RepeatWrapping is what makes them continue seamlessly.
  for (let row = -1; row <= 2; row++) {
    const cy = row * rowSpacing;
    const rowOffset = row % 2 !== 0 ? canvasWidth / 2 : 0;
    for (let col = -1; col <= 2; col++) {
      const cx = col * canvasWidth + rowOffset;
      const verts = vertexOffsets.map(([dx, dy]) => [cx + dx, cy + dy]);

      ctx.moveTo(verts[0][0], verts[0][1]);
      for (let k = 1; k <= 6; k++) {
        const v = verts[k % 6];
        ctx.lineTo(v[0], v[1]);
      }

      for (const idx of SPOKE_INDICES) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(verts[idx][0], verts[idx][1]);
      }
    }
  }

  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Manual fine-tune on top of the fix above, in case the plane's own UV
  // orientation still doesn't read as "upright" from a given camera angle.
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(rotationDeg);
  return texture;
}
