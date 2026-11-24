"use client";

// A team member's headshot. With a photo: warm monochrome at rest, full
// colour on hover (the parent's `group`). Without one: a placeholder in the
// hero's palette — the dusk over the dunes, a basalt silhouette against it.
export default function Portrait({ person, index, sizes = "(max-width: 64rem) 50vw, 25vw", className = "", priority = false, compact = false }) {
  const n = String(index + 1).padStart(3, "0");
  if (person.photo) {
    return (
      <div className={`relative overflow-hidden bg-[#1a1410] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={person.photo}
          alt={`${person.name}, ${person.role}`}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 size-full object-cover [filter:grayscale(1)_sepia(0.18)_contrast(1.05)] transition-[filter,transform] duration-700 ease-out group-hover:scale-[1.04] group-hover:[filter:none]"
        />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${person.name}, ${person.role} (photo to come)`}
      className={`relative overflow-hidden bg-[linear-gradient(180deg,#141a2a_0%,#3a3646_38%,#b8704a_62%,#e48e4f_70%)] ${className}`}
    >
      {/* the sun low behind them */}
      <div className="absolute left-1/2 top-[56%] size-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,170,90,0.9)_0%,rgba(255,95,0,0.35)_40%,transparent_70%)] transition-transform duration-700 ease-out group-hover:scale-125" />
      {/* dunes */}
      <svg viewBox="0 0 400 500" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M0 340 C 80 300 140 330 210 316 S 330 290 400 312 L400 500 L0 500Z" fill="#8a4524" />
        <path d="M0 386 C 90 352 170 392 250 372 S 360 352 400 366 L400 500 L0 500Z" fill="#5d2f17" />
        <path d="M0 430 C 110 410 200 442 290 424 S 370 414 400 420 L400 500 L0 500Z" fill="#2f170b" />
      </svg>
      {/* the person, in basalt */}
      <svg viewBox="0 0 400 500" className="absolute inset-x-0 bottom-0 h-[82%] w-full transition-transform duration-700 ease-out group-hover:translate-y-[-2%]">
        <defs>
          <linearGradient id={`rim-${n}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ff5f00" stopOpacity="0" />
            <stop offset="0.82" stopColor="#ff5f00" stopOpacity="0" />
            <stop offset="1" stopColor="#ff7a2a" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <g>
          <ellipse cx="200" cy="190" rx="64" ry="78" fill="#15110f" />
          <path d="M60 500 C 62 392 108 326 168 308 C 172 292 170 274 166 252 L 234 252 C 230 274 228 292 232 308 C 292 326 338 392 340 500 Z" fill="#15110f" />
          <ellipse cx="200" cy="190" rx="64" ry="78" fill={`url(#rim-${n})`} className="opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
          <path d="M60 500 C 62 392 108 326 168 308 C 172 292 170 274 166 252 L 234 252 C 230 274 228 292 232 308 C 292 326 338 392 340 500 Z" fill={`url(#rim-${n})`} className="opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
        </g>
      </svg>
      {!compact && <span className="absolute bottom-[4%] right-[5%] font-[family-name:var(--font-orbitron)] text-[0.55vw] uppercase tracking-[0.25em] text-white/40 max-[64rem]:text-[9px]">Photo to come</span>}
    </div>
  );
}
