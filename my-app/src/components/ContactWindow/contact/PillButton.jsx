// the black pill with its orange dot (weareenigma-next's MainButton), here
export default function PillButton({ children, href, type, onClick, disabled, busy }) {
  const cls =
    "group/pill relative inline-flex h-[3.4vw] min-h-11 w-fit shrink-0 items-center gap-[0.7vw] overflow-hidden rounded-full bg-[#111111] pl-[1.3vw] pr-[1.6vw] text-[1.05vw] font-medium text-white transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:pl-[1.6vw] hover:pr-[2.6vw] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5f00] disabled:cursor-wait max-md:gap-2.5 max-md:pl-5 max-md:pr-6 max-md:text-sm";
  const inner = (
    <>
      <span aria-hidden className={`h-[0.45vw] min-h-1.5 w-[0.45vw] min-w-1.5 rounded-full bg-[#ff5f00] ${busy ? "animate-pulse" : ""}`} />
      <span>{children}</span>
      <span aria-hidden className="absolute right-[1vw] translate-x-2 opacity-0 transition-all duration-500 group-hover/pill:translate-x-0 group-hover/pill:opacity-100 max-md:right-3">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.343 8h11.314m0 0L8.673 3.016M13.657 8l-4.984 4.984" />
        </svg>
      </span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type={type || "button"} onClick={onClick} disabled={disabled} aria-busy={busy} className={cls}>
      {inner}
    </button>
  );
}
