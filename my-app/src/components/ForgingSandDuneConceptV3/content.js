import { zoneAt } from "./config";

// All copy for the forging-sand-dune-concept-v3 page. Lines marked "site" are taken from
// hyperiux-staging.vercel.app / the existing About component; lines marked
// "editable" are general brand messaging written around that positioning —
// no dates, numbers or claims that aren't on the live site.

export const HERO = {
  eyebrow: "Hyperiux Immersion Labs", // site (footer)
  title: ["Digital Experience", "Design Agency"], // site
  body: "A growth and experience partner where human behaviour, design, technology and organic growth meet.", // site
  cue: "Scroll to enter",
};

// Four markers along the trail, taken from the four meeting points in the
// site's positioning statement.
export const JOURNEY = [
  {
    n: "01",
    title: "Human behaviour",
    body: "We start with people: emotion and neuromarketing shape every decision.", // editable (site: "Emotion, Design, Technology, and Neuromarketing")
  },
  {
    n: "02",
    title: "Design",
    body: "Strategic planning based on insight is the starting point of everything we do.", // site
  },
  {
    n: "03",
    title: "Technology",
    body: "Helping brands thrive in today's fast-evolving digital landscape.", // site (adapted)
  },
  {
    n: "04",
    title: "Organic growth",
    body: "Digital brand experiences that drive real results.", // site
  },
];

export const ABOUT = {
  label: "About Hyperiux",
  title: "From Concept to Conversion, We're Changing the Face of Web.", // site
  body: "We unravel complex design challenges through meticulous user research, expert analysis, prototyping, and collaborative design with users and stakeholders. Harnessing the power of cutting edge tools and our proprietary approach we craft delightful and intuitive experiences.", // site
};

export const SOLUTIONS = {
  eyebrow: "Explore Our Solutions", // site
  title: ["We Don't Just Offer Solutions,", "We Craft Impact"], // site
  items: [
    {
      title: "Strategy",
      body: "Strategic planning based on insight is the starting point of everything we do.",
      tags: ["UI design strategy", "Branding", "Consumer research"],
    },
    {
      title: "UI/UX Design",
      body: "A UI/UX partner for startups and enterprises, from responsive web design to design systems.",
      tags: ["Responsive web design", "Design systems"],
    },
    {
      title: "Technology",
      body: "Our mission is to help you thrive in today's fast-evolving digital landscape.",
      tags: ["HTML", "CSS", "JavaScript", "React", "Vue", "Angular"],
    },
    {
      title: "Marketing",
      body: "Brand marketing, social media, SEO, influencer management and marketing automation.",
      tags: ["Brand", "Social", "SEO", "Automation"],
    },
  ],
};

export const CTA = {
  title: "Let's Bring Your Ideas To Life!", // site
  email: "hi@hyperiux.com",
  phone: "+91 8178026136",
  address: "Grandslam I-Thum, A-40, Sector 62, Noida, Uttar Pradesh 201309",
};

// The story told over the oasis past the mark, one moment at a time, each
// over its stretch of the way (zone and share of it, config.js): from the
// bare sand to the tree. Lines marked "site" are the site's own words (see
// above); the rest is editorial copy written for the concept around its
// positioning — no claims, names or figures.
const LINES = [
  { id: "bring", eyebrow: "What we bring", text: "Strategy. Design. Technology.", from: ["passage", 0.22], to: ["passage", 0.95], place: "low" },
  { id: "concept", eyebrow: "Design × Technology", text: "From concept to conversion.", body: JOURNEY[2].body, from: ["glow", 0.1], to: ["glow", 0.92], place: "left" }, // site
  { id: "tree", text: "Potential deserves a place to grow.", from: ["reveal", 0.2], to: ["canopy", 0.08], place: "left" },
  { id: "growth", eyebrow: "Organic growth", text: "Growth you can see.", body: JOURNEY[3].body, from: ["canopy", 0.2], to: ["outro", 0.35], place: "right" }, // site
];
export const OASIS_LINES = LINES.map((l) => {
  const from = zoneAt(...l.from);
  const to = zoneAt(...l.to);
  return { ...l, from, to, mid: (from + to) / 2 };
});
