// All copy for the forging-concept page. Lines marked "site" are taken from
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

// The garden's four sections, one per pillar of the positioning statement
// (the JOURNEY markers above), each with the form the particle body takes.
// Titles are the site's own lines where it has them.
export const GARDEN_SECTIONS = [
  { id: "mark", n: "01", tag: "Human behaviour", title: ["We start", "with people"], body: JOURNEY[0].body, layout: "bottom" }, // editable
  { id: "cube", n: "02", tag: "Design", title: ["We don't just offer", "solutions, we", "craft impact"], body: JOURNEY[1].body, layout: "left" }, // site
  { id: "cloud", n: "03", tag: "Technology", title: ["From concept", "to conversion"], body: JOURNEY[2].body, layout: "bottom" }, // site
  { id: "ring", n: "04", tag: "Organic growth", title: ["Let's bring your", "ideas to life"], body: JOURNEY[3].body, layout: "center" }, // site
];
