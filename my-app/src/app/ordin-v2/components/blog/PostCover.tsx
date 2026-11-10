// Built using Hyperiux Vault: https://vault.hyperiux.com

import type { CoverArt } from "./posts";

// Generated cover art: a dark panel with one line drawing per post, all in the theme colours,
// so covers follow theme.ts and need no image files. Swap in <Image> if you have real covers.

const LINE = { fill: "none", stroke: "var(--ord-primary)", strokeWidth: 1 } as const;
const BRIGHT = { fill: "none", stroke: "var(--ord-primary-light)", strokeWidth: 1.4 } as const;
const DOT = { fill: "var(--ord-primary-light)" } as const;

const ART: Record<CoverArt, React.ReactNode> = {
  orbit: (
    <>
      {[0, 60, 120].map((r) => (
        <ellipse key={r} cx="400" cy="250" rx="190" ry="70" transform={`rotate(${r} 400 250)`} style={LINE} opacity={0.7} />
      ))}
      <circle cx="400" cy="250" r="120" style={BRIGHT} />
      {Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        const ring = 60 + (i % 4) * 16;
        return <circle key={i} cx={400 + Math.cos(a) * ring} cy={250 + Math.sin(a) * ring} r="1.6" style={DOT} opacity={0.4 + (i % 3) * 0.2} />;
      })}
    </>
  ),
  grid: (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`v${i}`} x1={160 + i * 60} x2={160 + i * 60} y1="70" y2="430" style={LINE} opacity={0.35} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1="160" x2="640" y1={70 + i * 60} y2={70 + i * 60} style={LINE} opacity={0.35} />
      ))}
      <rect x="340" y="190" width="120" height="120" style={BRIGHT} />
      <path d="M160 250h180M460 250h180" style={BRIGHT} />
      {[220, 280, 520, 580].map((x) => (
        <rect key={x} x={x - 7} y="243" width="14" height="14" style={DOT} />
      ))}
    </>
  ),
  wave: (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={`M120 ${250 + (i - 4) * 22} C 260 ${150 + (i - 4) * 30}, 400 ${350 - (i - 4) * 10}, 680 ${250 + (i - 4) * 18}`}
          style={i === 4 ? BRIGHT : LINE}
          opacity={i === 4 ? 1 : 0.5 - Math.abs(i - 4) * 0.08}
        />
      ))}
      <circle cx="400" cy="262" r="6" style={DOT} />
    </>
  ),
  nodes: (
    <>
      {[
        [400, 250, 250, 140],
        [400, 250, 560, 150],
        [400, 250, 220, 340],
        [400, 250, 580, 350],
        [400, 250, 400, 100],
        [400, 250, 400, 400],
      ].map(([x1, y1, x2, y2], i) => (
        <g key={i}>
          <path d={`M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} style={LINE} opacity={0.7} />
          <rect x={x2 - 34} y={y2 - 14} width="68" height="28" style={LINE} />
          <circle cx={x2 - 22} cy={y2} r="3" style={DOT} />
        </g>
      ))}
      <circle cx="400" cy="250" r="34" style={BRIGHT} />
      <circle cx="400" cy="250" r="8" style={DOT} />
    </>
  ),
  bars: (
    <>
      <line x1="160" x2="640" y1="400" y2="400" style={LINE} opacity={0.6} />
      {[90, 140, 120, 190, 170, 230, 210, 280].map((h, i) => (
        <rect key={i} x={180 + i * 56} y={400 - h} width="28" height={h} style={i === 7 ? BRIGHT : LINE} opacity={i === 7 ? 1 : 0.4 + i * 0.07} />
      ))}
      <path d="M194 300 L250 262 L306 276 L362 214 L418 232 L474 176 L530 196 L590 128" style={BRIGHT} />
      <circle cx="590" cy="128" r="6" style={DOT} />
    </>
  ),
  rings: (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx="400" cy="250" r={30 + i * 30} style={i === 3 ? BRIGHT : LINE} opacity={i === 3 ? 1 : 0.6 - i * 0.06} strokeDasharray={i % 2 ? "4 8" : undefined} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={400 + Math.cos(i * 1.7) * 120} cy={250 + Math.sin(i * 1.7) * 120} r="5" style={DOT} />
      ))}
    </>
  ),
};

type PostCoverProps = { art: CoverArt; label?: string; className?: string };

export default function PostCover({ art, label, className = "" }: PostCoverProps) {
  return (
    <div className={`relative overflow-hidden bg-(--ord-ink) ${className}`}>
      <svg
        aria-hidden
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/post:scale-[1.06]"
      >
        <defs>
          <radialGradient id={`ord-cover-glow-${art}`} cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor="var(--ord-primary)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--ord-primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="500" fill="var(--ord-carbon)" />
        <rect width="800" height="500" fill={`url(#ord-cover-glow-${art})`} />
        {ART[art]}
      </svg>
      {label && (
        <span className="absolute bottom-[1.4vw] left-[1.4vw] ord-label text-14 uppercase text-ord-primary-light max-lg:bottom-[2.4vw] max-lg:left-[2.4vw] max-md:bottom-[4vw] max-md:left-[4vw]">
          {label}
        </span>
      )}
    </div>
  );
}
