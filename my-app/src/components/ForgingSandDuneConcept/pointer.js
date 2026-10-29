// One window-level pointer source for the whole page. The canvas has
// pointer-events: none (so text and links stay usable), which means R3F's
// own pointer never updates; parallax and sand stirring read this instead.
export const pointer = {
  x: 0, // NDC -1..1
  y: 0,
  active: false, // a fine pointer (mouse / pen) has moved over the page
  movedAt: 0,
  // every position the pointer passed through (coalesced events included),
  // NDC + time, for anything that traces its exact path (the sand trail);
  // the reader empties it
  path: [],
  clicks: 0, // presses so far
};
const PATH_MAX = 512;

let users = 0;
function onMove(e) {
  if (e.pointerType === "touch") return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const events = e.getCoalescedEvents?.() ?? [];
  for (const c of events.length ? events : [e]) {
    if (pointer.path.length >= PATH_MAX) pointer.path.shift();
    pointer.path.push({ x: (c.clientX / w) * 2 - 1, y: -(c.clientY / h) * 2 + 1, t: c.timeStamp });
  }
  pointer.x = (e.clientX / w) * 2 - 1;
  pointer.y = -(e.clientY / h) * 2 + 1;
  pointer.active = true;
  pointer.movedAt = performance.now();
}
function onDown(e) {
  if (e.pointerType === "touch") return;
  onMove(e);
  pointer.clicks++;
}
function onLeave() {
  pointer.active = false;
}

export function attachPointer() {
  if (users++ === 0) {
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });
  }
  return () => {
    if (--users === 0) {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    }
  };
}
