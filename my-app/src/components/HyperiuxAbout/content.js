// All copy for the /about page. Lines marked "site" are Hyperiux's own words
// (hyperiux-staging / the forging-sand-dune-concept-v3 content); the rest is
// editorial copy written around that positioning — no dates, numbers or
// claims that aren't on the live site.

export const HERO = {
  eyebrow: "About Hyperiux",
  title: ["We are", "Hyperiux"],
  body: "A growth and experience partner where human behaviour, design, technology and organic growth meet.", // site
  cue: "Scroll to meet us",
};

// The lines told over the monolith as it opens (p = the hero's scroll, 0..1).
export const HERO_LINES = [
  {
    id: "minds",
    eyebrow: "Many minds",
    text: "One forge.",
    body: "Strategists, designers, engineers and marketers, shaping every idea in the same fire.",
    from: 0.3,
    to: 0.58,
    place: "left",
  },
  {
    id: "people",
    eyebrow: "The people",
    text: "Behind every pixel.",
    body: "Meet the team that turns ambitious ideas into digital experiences.",
    from: 0.6,
    to: 0.86,
    place: "right",
  },
];

export const INTRO = {
  index: "001",
  label: "Who we are",
  statement: "From concept to conversion, we're changing the face of web.", // site
  body: "We unravel complex design challenges through meticulous user research, expert analysis, prototyping, and collaborative design with users and stakeholders. Harnessing the power of cutting edge tools and our proprietary approach we craft delightful and intuitive experiences.", // site
  // the four meeting points of the site's positioning statement
  pillars: [
    { n: "01", title: "Human behaviour", body: "We start with people: emotion and neuromarketing shape every decision." },
    { n: "02", title: "Design", body: "Strategic planning based on insight is the starting point of everything we do." }, // site
    { n: "03", title: "Technology", body: "Helping brands thrive in today's fast-evolving digital landscape." }, // site (adapted)
    { n: "04", title: "Organic growth", body: "Digital brand experiences that drive real results." }, // site
  ],
};

// ---------------------------------------------------------------------------
// TEAM — PLACEHOLDERS. Replace every entry with the real people.
// ---------------------------------------------------------------------------
// photo: a path under /public (e.g. "/assets/images/about/team/jane.jpg"),
//   portrait, ideally 4:5 and at least 900px wide. Leave it null and the card
//   shows the dune placeholder portrait instead.
// lead: true puts the person in the large leadership slider at the top; the
//   whole team (leads included) is in the grid below it.
// links: any of { linkedin, x, instagram, dribbble, behance, site }.
export const TEAM = [
  {
    name: "Team Member 01",
    role: "Founder & CEO",
    discipline: "Strategy",
    bio: "Placeholder bio. Two or three lines on what they lead at Hyperiux, how they got here, and what they care about in the work.",
    photo: null,
    lead: true,
    links: { linkedin: "#" },
  },
  {
    name: "Team Member 02",
    role: "Creative Director",
    discipline: "Design",
    bio: "Placeholder bio. Two or three lines on what they lead at Hyperiux, how they got here, and what they care about in the work.",
    photo: null,
    lead: true,
    links: { linkedin: "#" },
  },
  {
    name: "Team Member 03",
    role: "Head of Technology",
    discipline: "Technology",
    bio: "Placeholder bio. Two or three lines on what they lead at Hyperiux, how they got here, and what they care about in the work.",
    photo: null,
    lead: true,
    links: { linkedin: "#" },
  },
  { name: "Team Member 04", role: "UI/UX Designer", discipline: "Design", bio: "Placeholder bio. One or two lines about them.", photo: null, links: { linkedin: "#" } },
  { name: "Team Member 05", role: "Creative Developer", discipline: "Technology", bio: "Placeholder bio. One or two lines about them.", photo: null, links: { linkedin: "#" } },
  { name: "Team Member 06", role: "3D Artist", discipline: "Design", bio: "Placeholder bio. One or two lines about them.", photo: null, links: { linkedin: "#" } },
  { name: "Team Member 07", role: "Brand Strategist", discipline: "Strategy", bio: "Placeholder bio. One or two lines about them.", photo: null, links: { linkedin: "#" } },
  { name: "Team Member 08", role: "Growth Marketer", discipline: "Marketing", bio: "Placeholder bio. One or two lines about them.", photo: null, links: { linkedin: "#" } },
];

export const TEAM_COPY = {
  index: "002",
  label: "The team",
  title: ["The people", "behind the forge"],
  body: "A small, senior team of strategists, designers, engineers and marketers, working as one from the first idea to the last line of code.",
  gridLabel: "Everyone",
};

// Area of expertise (the site's four solutions)
export const EXPERTISE = {
  index: "003",
  label: "Area of expertise",
  title: ["We Don't Just Offer Solutions,", "We Craft Impact"], // site
  items: [
    { glyph: "S", title: "Strategy", body: "Strategic planning based on insight is the starting point of everything we do.", tags: ["UI design strategy", "Branding", "Consumer research"] },
    { glyph: "D", title: "UI/UX Design", body: "A UI/UX partner for startups and enterprises, from responsive web design to design systems.", tags: ["Responsive web design", "Design systems"] },
    { glyph: "T", title: "Technology", body: "Our mission is to help you thrive in today's fast-evolving digital landscape.", tags: ["HTML", "CSS", "JavaScript", "React", "Vue", "Angular"] },
    { glyph: "M", title: "Marketing", body: "Brand marketing, social media, SEO, influencer management and marketing automation.", tags: ["Brand", "Social", "SEO", "Automation"] },
  ],
};

export const JOIN = {
  index: "004",
  label: "Join us",
  title: "Curious minds always have a seat at the forge.",
  body: "We're always glad to hear from designers, engineers and storytellers who want to build what's next. Tell us about yourself and the work you're proudest of.",
  cta: "Say hello",
};

export const CTA = {
  title: "Let's Bring Your Ideas To Life!", // site
  email: "hi@hyperiux.com",
  phone: "+91 8178026136",
  address: "Grandslam I-Thum, A-40, Sector 62, Noida, Uttar Pradesh 201309",
};
