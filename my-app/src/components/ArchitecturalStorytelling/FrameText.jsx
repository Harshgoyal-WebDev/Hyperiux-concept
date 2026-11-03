"use client";

// A frame's copy: its number and label, the headline (its full stop in
// orange) and a supporting line. In the opening the blocks sit stacked over
// the drawing and the timeline brings each in and out (data-frame-text); in
// the sections below the same block is laid out in the flow.
// With `words`, each word is its own span (useDraw fills them in, one by
// one, as the headline scrolls up the screen).
export function Headline({ text, as: Tag = "h2", className = "", words = false }) {
  const stop = /[.!?]$/.test(text);
  const body = stop ? text.slice(0, -1) : text;
  const mark = stop && <span className="text-[var(--bp-accent)]">{text.slice(-1)}</span>;
  if (words) {
    const list = body.split(" ");
    return (
      <Tag data-words="" aria-label={text} className={`font-[family-name:var(--font-aeonikpro)] font-normal tracking-[-0.025em] ${className}`}>
        {list.map((w, i) => (
          <span key={i} aria-hidden="true">
            <span data-word="">
              {w}
              {i === list.length - 1 && mark}
            </span>
            {i < list.length - 1 && " "}
          </span>
        ))}
      </Tag>
    );
  }
  return (
    <Tag className={`font-[family-name:var(--font-aeonikpro)] font-normal tracking-[-0.025em] ${className}`}>
      {body}
      {mark}
    </Tag>
  );
}

export function FrameLabel({ n, label }) {
  return (
    <p className="bp-mono flex items-center gap-[1.2em] text-[0.72rem] uppercase tracking-[0.18em] text-[var(--bp-muted)] md:text-[0.78rem]">
      <span className="text-[var(--bp-fg)]">
        {String(n).padStart(2, "0")} / 20
      </span>
      <span className="h-px w-6 bg-[var(--bp-accent)]" aria-hidden="true" />
      {label}
    </p>
  );
}

export function FrameText({ frame, first }) {
  return (
    <div
      data-frame-text={frame.n}
      className="absolute left-[6vw] right-[6vw] top-[14svh] md:right-auto md:top-[22svh] md:w-[34vw]"
      style={first ? undefined : { opacity: 0, visibility: "hidden" }}
    >
      <FrameLabel n={frame.n} label={frame.label} />
      <Headline
        as={first ? "h1" : "h2"}
        text={frame.title}
        className="mt-[3svh] text-[2.4rem] leading-[1.02] md:text-[4.2vw] md:leading-[0.98]"
      />
      {frame.body && <p className="mt-[3svh] max-w-[28rem] text-[0.98rem] leading-relaxed text-[var(--bp-muted)] md:text-[1.08vw]">{frame.body}</p>}
      {first && (
        <p className="bp-mono mt-[6svh] flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--bp-muted)]">
          <span className="inline-block size-2 rounded-full border border-[var(--bp-accent)]" aria-hidden="true" />
          Scroll to explore
        </p>
      )}
    </div>
  );
}
