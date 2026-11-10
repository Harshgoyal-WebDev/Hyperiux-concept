"use client";

import { usePathname } from "next/navigation";
import { ReactLenis } from "lenis/react";

// The Ordin templates (/ordin, /ordin-v2) run their own Lenis from their layout, so they skip this one
const OWN_SCROLL = ["/ordin"];

export default function SmoothScroll({ children }) {
  const pathname = usePathname();
  if (OWN_SCROLL.some((p) => pathname?.startsWith(p))) return children;

  return (
    <ReactLenis root options={{ autoRaf: true }}>
      {children}
    </ReactLenis>
  );
}
