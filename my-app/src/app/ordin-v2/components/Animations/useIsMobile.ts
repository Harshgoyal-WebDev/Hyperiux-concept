// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useSyncExternalStore } from "react";

// Same range as the max-md: classes (below 768px). False on the server, so the desktop layout renders first.
const QUERY = "(max-width: 767px)";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
