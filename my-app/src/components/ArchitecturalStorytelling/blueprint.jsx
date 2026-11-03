"use client";

// HTML lines for frames round images and rules between rows: thin spans
// that grow in (data-grow, scaled by useDraw) — an SVG stretched to a box
// would stretch its strokes with it.
export function Rule({ dir = "x", tone = "guide", className = "" }) {
  const color = tone === "ink" ? "bg-[var(--bp-fg)]" : "bg-[var(--bp-guide)]";
  const shape = dir === "x" ? "h-px w-full" : "h-full w-px";
  return <span data-grow={dir} aria-hidden="true" className={`pointer-events-none absolute block ${shape} ${color} ${className}`} />;
}

export function Frame({ tone = "ink" }) {
  return (
    <>
      <Rule tone={tone} className="left-0 top-0" />
      <Rule tone={tone} dir="y" className="right-0 top-0" />
      <Rule tone={tone} className="bottom-0 left-0" />
      <Rule tone={tone} dir="y" className="left-0 top-0" />
    </>
  );
}
