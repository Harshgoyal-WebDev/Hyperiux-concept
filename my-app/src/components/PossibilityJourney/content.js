// All copy and data for /from-possibility.
//
// Facts about Hyperiux (contact, projects and their years and services,
// client logos, testimonials, insight titles) come from the existing site
// components in this repo (HyperiuxHome; gathered in OriginForge/content.js)
// and hyperiux-staging.vercel.app. Chapter lines and section headlines are
// the brief's. No metrics, awards, team members or partnerships are added:
// none are published, so outcomes are told qualitatively and through
// clients' own words.

import { CLIENTS, CONTACT, PROJECTS, TESTIMONIALS } from "../OriginForge/content";

export { CLIENTS, CONTACT, PROJECTS, TESTIMONIALS };

export const NAV = [
  { label: "Work", to: "#pj-work" },
  { label: "Services", to: "#pj-services" },
  { label: "About", to: "#pj-about" },
  { label: "Contact", to: "#pj-contact" },
];

export const FOOTER_NAV = [...NAV.slice(0, 3), { label: "Insights", to: "#pj-insights" }, NAV[3]];

// The six chapters of the journey (timeline.js gives each its window).
export const CHAPTERS = [
  {
    id: "opening",
    n: "01",
    label: "Opening",
    kind: "hero",
    title: "Hyperiux",
    body: "A growth and experience partner where human behaviour, design, technology and organic growth meet.",
  },
  {
    id: "path",
    n: "02",
    label: "The Path",
    title: ["Every brand has a story.", "Every interaction moves it forward."],
    body: "But creating meaningful digital experiences requires more than just making things look good.",
  },
  {
    id: "challenge",
    n: "03",
    label: "The Challenge",
    title: ["Great experiences don't happen", "in disconnected pieces."],
    body: "When strategy, design, and technology work independently, the experience loses its meaning.",
  },
  {
    id: "approach",
    n: "04",
    label: "Our Approach",
    title: ["One vision. Multiple disciplines.", "A connected experience."],
    body: "We combine insight, strategy, thoughtful design, and purposeful technology to create experiences that work as one.",
  },
  {
    id: "impact",
    n: "05",
    label: "Impact",
    title: ["Made to be experienced.", "Designed to perform."],
    body: "We create digital touchpoints that connect people with brands through clarity, usability, creativity, and purpose.",
  },
  {
    id: "possibilities",
    n: "06",
    label: "The Possibilities",
    title: ["Beyond the expected."],
    body: "We help brands discover new possibilities by creating digital experiences that people understand, remember, and want to return to.",
  },
];

// The four disciplines (the glass panels of chapter 04 and the service cards)
export const DISCIPLINES = [
  { id: "strategy", n: "01", name: "Strategy", short: "Strategy", body: "Brand direction, research, digital strategy, and experience planning." },
  { id: "design", n: "02", name: "Experience Design", short: "Experience\nDesign", body: "UI/UX, interaction design, visual identity, and digital experiences." },
  { id: "technology", n: "03", name: "Technology", short: "Technology", body: "Creative development, websites, digital products, and scalable solutions." },
  { id: "growth", n: "04", name: "Growth", short: "Growth", body: "Digital marketing, engagement, optimization, and organic growth." },
];

export const HERO = {
  title: ["We create digital", "experiences that "],
  accent: "move brands forward.",
  body: "Where strategy, human behaviour, thoughtful design, and technology come together to transform how people experience brands.",
};

// The featured case study: Montra, the studio's own lead project on the
// site. Its facts are the site's (year, services); the narrative is the
// brief's, not a claim of results.
export const CASE = {
  project: "montra",
  label: "Case Study",
  title: ["From concept", "to experience."],
  body:
    "Every successful digital experience begins with understanding the problem, identifying the opportunity, and finding the right creative and technical direction.",
};

// Outcomes, told qualitatively: no figures are published, so none are shown.
export const OUTCOMES = [
  { icon: "spark", title: "Stronger engagement", body: "Experiences that keep people involved, not just passing through." },
  { icon: "target", title: "Clearer journeys", body: "Simple, intuitive and purposeful flows from first look to action." },
  { icon: "layers", title: "A more cohesive brand", body: "One consistent presence across every touchpoint, carried by design and code alike." },
];

export const PROCESS = {
  intro: ["Good experiences are never accidental."],
  body: "They are built through the right questions, clear thinking, purposeful creativity, and thoughtful execution.",
  steps: [
    { n: "01", name: "Discover", body: "Understand the brand, the problem and the people it serves." },
    { n: "02", name: "Define", body: "Turn what we learn into a clear direction: priorities, structure and the experience to build." },
    { n: "03", name: "Create", body: "Design and engineer together, testing ideas early and refining them in the real medium." },
    { n: "04", name: "Launch", body: "Ship with care: performance, accessibility and every detail checked before it goes live." },
    { n: "05", name: "Evolve", body: "Measure, learn and keep improving, so the experience grows with the business." },
  ],
};

export const STUDIO = {
  title: ["A team of thinkers,", "makers, and problem-solvers."],
  body: "We bring strategy, creativity, design, and technology together to build experiences that matter.",
  principles: [
    { k: "We understand people", v: "Every decision starts with the person on the other side of the screen." },
    { k: "We bring ideas together", v: "Strategists, designers and engineers shape the work at the same table." },
    { k: "We create meaningful experiences", v: "Beautiful is not enough: it has to be clear, fast and useful." },
    { k: "We move brands forward", v: "What we make is built to grow with the business behind it." },
  ],
};

// Insights: the articles listed on the site (HyperiuxHome/Home/BlogActive.jsx).
// Their pages are not published yet (the site links them to "#"), so they
// are shown as forthcoming rather than linked.
const BLOG = "/assets/images/homepage/blogs";
export const INSIGHTS = [
  { title: "Why Great Digital Products Feel Effortless", category: "Design", image: `${BLOG}/blog-img-2.jpg` },
  { title: "The New Rules of Conversion-Led Website Design", category: "Strategy", image: `${BLOG}/blog-img-3.jpg` },
  { title: "How Motion Design Shapes Brand Memory", category: "Motion", image: `${BLOG}/blog-img-4.jpg` },
  { title: "What Founders Get Wrong About Product Experience", category: "UX", image: `${BLOG}/blog-img-5.jpg` },
  { title: "Building Websites That Sell Before They Speak", category: "Development", image: `${BLOG}/blog-img-6.jpg` },
];

export const CTA = {
  title: ["Let's build your"],
  accent: "next experience.",
  body: "Have an idea, a challenge, or a vision worth bringing to life? Let's make it happen.",
  button: "Start a Conversation",
};

// The dark version's nine chapters (its own world: night/), after the
// cinematic storyboard: the origin, the spark, movement, alignment,
// assembly, convergence, the core, the reveal and the transition.
export const NIGHT_CHAPTERS = [
  {
    id: "origin",
    n: "01",
    label: "The Origin",
    title: ["A new perspective emerges."],
    body: "A growth and experience partner where human behaviour, design, technology and organic growth meet.",
  },
  { id: "spark", n: "02", label: "The Spark", title: ["The spark of an idea."], body: "Every brand has a story. Every interaction moves it forward." },
  { id: "movement", n: "03", label: "Movement", title: ["Ideas take motion."], body: "But creating meaningful digital experiences requires more than just making things look good." },
  { id: "alignment", n: "04", label: "Alignment", title: ["Different elements", "find a rhythm."], body: "Insight, strategy, thoughtful design and purposeful technology, moving as one." },
  { id: "assembly", n: "05", label: "Assembly", title: ["Fragments come together."], body: "We turn complexity into clarity." },
  { id: "convergence", n: "06", label: "Convergence", title: ["Strategy, design and", "technology converge."], body: "One vision. Multiple disciplines. A connected experience." },
  { id: "core", n: "07", label: "The Core", title: ["The Hyperiux core", "takes form."], body: "Made to be experienced. Designed to perform." },
  { id: "reveal", n: "08", label: "Reveal", kind: "reveal", title: ["Hyperiux"], body: "Where human behaviour, design, technology and organic growth meet." },
  { id: "transition", n: "09", label: "Transition", title: ["From an immersive journey…"], body: "…to experiences that move brands forward." },
];
