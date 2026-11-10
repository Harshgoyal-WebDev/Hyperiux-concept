// Built using Hyperiux Vault: https://vault.hyperiux.com

// Shared by the header, the footer and the page transition
export const BASE = "/ordin";

export const ROUTES = {
  home: BASE,
  platform: `${BASE}/platform`,
  agents: `${BASE}/agents`,
  governance: `${BASE}/governance`,
  pricing: `${BASE}/pricing`,
  blog: `${BASE}/blog`,
  privacy: `${BASE}/privacy`,
};

// Any link to one of these opens the enquiry dialog instead of navigating (see EnquiryDialog.tsx).
// The suffix picks the topic the form opens on.
export const ENQUIRE = {
  demo: "#enquire",
  sales: "#enquire-sales",
  security: "#enquire-security",
};

export const LINKS = [
  { label: "Platform", href: ROUTES.platform },
  { label: "Agents", href: ROUTES.agents },
  { label: "Governance", href: ROUTES.governance },
  { label: "Pricing", href: ROUTES.pricing },
  { label: "Blog", href: ROUTES.blog },
];
