// One window-level pointer source for the whole page. The canvas has
// pointer-events: none (so text and links stay usable), which means R3F's
// own pointer never updates; parallax and sand stirring read this instead.
export const pointer = {
  x: 0, // NDC -1..1
  y: 0,
  active: false, // a fine pointer (mouse / pen) has moved over the page
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
