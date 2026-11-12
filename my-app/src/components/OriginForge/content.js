// All copy and data for /origin-forge.
//
// Sources: everything about Hyperiux itself (services and skills, projects,
// clients, testimonials, industries, contact) comes from the existing site
// components in this repo (components/HyperiuxHome, ArchitecturalStorytelling/
// content.js) and hyperiux-staging.vercel.app. Story lines and section
// headlines are the brief's. No metrics, results or partnerships are added:
// the staging site publishes none, so "Impact" is told through client words.

export const CONTACT = {
  email: "hi@hyperiux.com",
  mailto: "mailto:hi@hyperiux.com?subject=New%20project%20with%20Hyperiux",
  phone: "+91 8178 026 136",
  phoneHref: "tel:+918178026136",
  address: ["Grandslam I-Thum, A-40, Sector 62", "Noida, Uttar Pradesh 201309"],
  company: "Hyperiux Immersion Labs",
  // the only staging page that resolves (checked 10.11.2026)
  aboutUrl: "https://hyperiux-staging.vercel.app/about",
};

export const NAV = [
  { label: "Work", to: "#of-work" },
  { label: "Services", to: "#of-services" },
  { label: "About", to: "#of-about" },
  { label: "Contact", to: "#of-contact" },
];

export const HERO = {
  brand: "Hyperiux",
  title: ["Experiences", "Engineered"],
  accent: "for Growth.",
  body: "A creative technology studio building high-performance digital experiences for ambitious brands.",
};

// The four forces. `piece` is the part of the Hyperiux mark each one becomes
// (world/logo.js), so Strategy, the tall left bar, forges the mark's left bar.
export const PILLARS = [
  { id: "strategy", n: "06", name: "Strategy", line: "Finding the right direction before building what comes next.", piece: "A" },
  { id: "design", n: "07", name: "Design", line: "Shaping meaningful experiences that people connect with.", piece: "C" },
  { id: "development", n: "08", name: "Development", line: "Turning ambitious ideas into robust digital experiences.", piece: "D" },
  { id: "marketing", n: "09", name: "Marketing", line: "Creating momentum, visibility and lasting impact.", piece: "B" },
];

export const STEPS = [
  { n: "01", name: "Idea", body: "Discover possibilities, understand the challenge and define what comes next." },
  { n: "02", name: "Build", body: "Design, develop and bring ambitious ideas to life." },
  { n: "03", name: "Deploy", body: "Launch with precision, performance and care." },
  { n: "04", name: "Scale", body: "Grow, optimise and create lasting impact." },
];

export const ABOUT = {
  label: "About Hyperiux",
  title: ["A Creative Tech Studio", "for "],
  accent: "Modern Brands.",
  lead: "We bring strategy, design, technology and growth together to create digital experiences that move businesses forward.",
  body: [
    "Hyperiux Immersion Labs is a studio in Noida where researchers, designers, engineers and marketers work at the same table. We start with people: how they think, what they feel and what makes them act. Then we work outward to the interface, the code and the campaign.",
    "A website is not a brochure. It is where a brand is experienced, judged and chosen. So we treat every project as one system, where the thinking, the craft and the performance hold up together, from concept to conversion.",
  ],
  beliefs: [
    { k: "People first", v: "Every decision starts with the person on the other side of the screen." },
    { k: "Craft with purpose", v: "Beautiful is not enough. It has to be clear, fast and useful." },
    { k: "Built to grow", v: "What we make is designed to scale with the business behind it." },
  ],
};

// Services: the brief's four, each with its skills as listed on the site
// (HyperiuxHome Solutions.jsx).
export const SERVICES = [
  {
    id: "strategy",
    icon: "strategy",
    name: "Strategy",
    body: "Research, positioning, brand thinking, planning and digital strategy.",
    skills: ["UI Design Strategy", "Branding", "Consumer Research", "Customer Experience Strategy", "Integrated Digital Marketing Plan"],
  },
  {
    id: "design",
    icon: "design",
    name: "UI/UX & Experience Design",
    body: "Digital product design, websites, interfaces, user experience, interaction design and design systems.",
    skills: ["User Interface Design", "User Experience Design", "Responsive Web Design", "Mobile App Design", "Design Systems Creation"],
  },
  {
    id: "development",
    icon: "development",
    name: "Technology & Development",
    body: "Websites, digital platforms, scalable products, advanced frontend engineering and interactive experiences.",
    skills: ["HTML", "CSS", "JavaScript", "React", "Vue", "Angular"],
  },
  {
    id: "marketing",
    icon: "marketing",
    name: "Marketing & Growth",
    body: "Brand communication, digital marketing, visibility, engagement and growth strategy.",
    skills: ["Social Media Management", "Content Creation & Curation", "Search Engine Optimisation", "Influencer Management", "Marketing Automation"],
  },
];

export const WHY = [
  { n: "01", title: "Creative thinking, technical precision", body: "Ideas are only as good as their execution. Designers and engineers shape the work together, so nothing is lost between the concept and the build." },
  { n: "02", title: "Experience-led by default", body: "We design around how people actually behave: what they look for, what they compare and what earns their trust." },
  { n: "03", title: "Performance and usability", body: "Fast, accessible and clear is not a finishing touch. It is part of the brief from the first day." },
  { n: "04", title: "Design and engineering, one team", body: "One team from the first sketch to the final deploy. Fewer handovers, fewer compromises." },
  { n: "05", title: "Scalable and future-ready", body: "Design systems and codebases built to grow with you, not to be rebuilt next year." },
  { n: "06", title: "A long-term partnership", body: "Launch is a milestone, not the finish line. We stay close to measure, refine and keep the momentum going." },
];

// Selected work: names, years, services and imagery as on the site
// (Work/WorkMobile.jsx). The site has no case-study pages yet (its project
// links are "#" or 404), so "View project" opens the project panel here.
const WORK = "/assets/images/homepage/work";
export const PROJECTS = [
  { id: "montra", name: "Montra", year: "2023", services: ["Web Design", "Branding", "Marketing"], images: [`${WORK}/our-work-1.png`, `${WORK}/our-work-4.png`] },
  { id: "yellow", name: "Yellow", year: "2024", services: ["Web Design", "Branding", "Marketing"], images: [`${WORK}/our-work-2.png`] },
  { id: "patronum", name: "Patronum", year: "2023", services: ["Web Design", "Marketing", "Branding"], images: [`${WORK}/our-work-3.png`] },
  { id: "monielink", name: "Monielink", year: "2025", services: ["Web Design", "Marketing", "Branding"], images: [`${WORK}/our-work-5.png`] },
].map((p) => ({
  ...p,
  intro: `A digital presence for ${p.name}, shaped across ${p.services.map((s) => s.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}.`,
}));

const LOGOS = "/assets/images/homepage/clients-grid-images";
export const CLIENTS = [
  ["Montra", "montra"],
  ["Monielink", "monielink"],
  ["Yellow", "yellow"],
  ["Bespin Labs", "bespin-labs"],
  ["DSW", "dsw"],
  ["Patronum", "patronum"],
  ["QuickX", "quickx"],
  ["Kedarkala", "kedarkala"],
  ["DMTCA", "dmtca"],
  ["AMS", "ams"],
  ["Patra", "patra"],
  ["Hiveminds", "hiveminds"],
].map(([name, file]) => ({ name, logo: `${LOGOS}/${file}-icon.svg`, bg: `${LOGOS}/${file}-background.png` }));

export const INDUSTRIES = ["Fintech", "Banking", "Technology", "Education", "Electronics"];

// Testimonials from the site (Testimonials/TestimonialSectionInterActive.jsx).
const PEOPLE = "/assets/images/homepage/testimonial";
export const TESTIMONIALS = [
  {
    name: "Shraddha Kasaudhan",
    role: "Founder & CEO, Kedarkala",
    image: `${PEOPLE}/kedarkala-client-image.webp`,
    quote:
      "Their unconventional approach and attention to detail allowed them to create a website that truly reflects our brand's essence and showcases our work in the best possible light. The new website has not only improved our online presence but has also significantly increased our leads and conversions.",
  },
  {
    name: "Chinara Musa",
    role: "Managing Director & Chief Promoter, GCM",
    image: `${PEOPLE}/gcm-client.webp`,
    quote: "Hyperiux exceeded our expectations in every way, delivering a website that truly captures the essence of our brand and sets the stage for our grand opening.",
  },
  {
    name: "Ankush Chawla",
    role: "CEO, DMTCA",
    image: `${PEOPLE}/dmtca-client-image.webp`,
    quote: "The new website is not just a testament to their capabilities but a reflection of their understanding of our brand. It's DMTCA's digital identity.",
  },
];

export const VISION = {
  title: ["Digital Experiences", "for "],
  accent: "What's Next.",
  body: [
    "The brands people remember are not the ones with a website. They are the ones that felt effortless to use: that understood quickly, spoke clearly and moved naturally.",
    "We believe the brands that grow will treat creativity and technology as one discipline. That is the work we want to keep doing: experiences that are thoughtful in their design, uncompromising in their engineering and honest in what they promise.",
  ],
};

export const CTA = {
  title: ["Let's Build"],
  accent: "What's Next.",
  body: ["Have an ambitious idea, a product to launch or a digital experience to transform?", "Let's make it happen."],
  button: "Start a project",
};
