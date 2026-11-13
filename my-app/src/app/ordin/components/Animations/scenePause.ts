// Built using Hyperiux Vault: https://vault.hyperiux.com

// While a modal covers the page, the canvases behind it (the particle globe, the Arc Light shader) stop
// drawing, so opening and closing the modal never competes with them for frames.
let paused = false;
const listeners = new Set<() => void>();

export const isScenePaused = () => paused;

export function setScenePaused(next: boolean) {
  if (paused === next) return;
  paused = next;
  listeners.forEach((listener) => listener());
}

export function onScenePause(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
