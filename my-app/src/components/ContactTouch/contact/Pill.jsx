// The page's button: a dark pill, an orange dot, an arrow sliding in on hover.
// A link (href) or a button.
const CLS =
  "group/pill relative inline-flex h-[3.4vw] min-h-11 w-fit shrink-0 items-center gap-[0.7vw] overflow-hidden rounded-full bg-[#111111] pl-[1.3vw] pr-[1.6vw] text-[1.05vw] font-medium text-white transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:pl-[1.6vw] hover:pr-[2.7vw] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5f00] disabled:cursor-wait max-md:gap-2.5 max-md:pl-5 max-md:pr-6 max-md:text-sm";

export default function Pill({ children, href, busy = false, ...rest }) {
  const inner = (
    <>
      <span aria-hidden className={`size-[0.45vw] min-h-1.5 min-w-1.5 rounded-full bg-[#ff5f00] ${busy ? "animate-pulse" : ""}`} />
      <span>{children}</span>
      <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" className="absolute right-[1vw] translate-x-2 opacity-0 transition-all duration-500 group-hover/pill:translate-x-0 group-hover/pill:opacity-100 max-md:right-3">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.343 8h11.314m0 0L8.673 3.016M13.657 8l-4.984 4.984" />
      </svg>
    </>
  );
  if (href) {
    return (
      <a href={href} className={CLS} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" aria-busy={busy} className={CLS} {...rest}>
      {inner}
    </button>
  );
}
