// Built using Hyperiux Vault: https://vault.hyperiux.com

// Motion settings for the whole template. Tone the motion down for your brand here, not in the components.
export const MOTION = {
  // When the boot loader plays: "session" (first page view per browser tab), "always" (every load) or "off"
  introLoader: "session" as "session" | "always" | "off",
  // Seconds the loader's progress bar takes to fill
  introSeconds: 1.2,
  // Multiplies the scroll length of every pinned section (1 = default, 0.7 = 30% shorter)
  pinnedScroll: 0.7,
  // Particles in the signal globe, desktop and phone
  particles: { desktop: 1100, mobile: 700 },
};

// Height of a pinned section: `fixed` vh always stay (the pinned screen itself, plus any overlap with the next
// section); the rest is scrubbed animation and scales with MOTION.pinnedScroll
export const pinnedHeight = (total: number, fixed = 100) => `${Math.round(fixed + (total - fixed) * MOTION.pinnedScroll)}vh`;
