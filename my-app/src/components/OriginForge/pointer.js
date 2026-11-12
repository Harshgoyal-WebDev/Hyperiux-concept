// One window-level pointer for the whole film. The canvas sits under the
// overlays (pointer-events: none), so R3F's own pointer never updates; the
// parallax, the particles and the water read this instead. Only a fine
// pointer (mouse, pen) counts: on touch, a drag is a scroll.
export const pointer = {
  x: 0, // NDC -1..1
  y: 0,
  active: false,
  movedAt: 0,
};

let users = 0;
function onMove(e) {
  if (e.pointerType === "touch") return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  pointer.active = true;
  pointer.movedAt = performance.now();
}
function onLeave() {
  pointer.active = false;
}

export function attachPointer() {
  if (users++ === 0) {
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  return () => {
    if (--users === 0) {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    }
  };
}
