// All copy and data for the page. The story's lines and the four
// capabilities are the brief's; everything about Hyperiux itself (projects
// and their services, clients, testimonials, contact, the process) is taken
// from the existing site components in this repo. No metrics, results or
// screenshots are added.

export const CONTACT = {
  email: "hi@hyperiux.com",
  phone: "+91 8178 026 136",
  phoneHref: "tel:+918178026136",
  address: "Grandslam I-Thum, A-40, Sector 62, Noida, Uttar Pradesh 201309",
  company: "Hyperiux Immersion Labs",
};

// (no profile URLs in the project yet: shown as text until they are linked)
export const SOCIAL = ["LinkedIn", "Instagram", "X", "Behance"];

export const NAV = [
  { label: "Work", to: "#work" },
  { label: "Capabilities", to: "#capabilities" },
  { label: "Studio", to: "#studio" },
  { label: "Vault", to: "#vault" },
  { label: "Contact", to: "#contact" },
];

// The fifteen beats of the opening, in four acts. `w` is a beat's share of
// the scroll (reading beats are longer); `layout` places its copy as the
// storyboard does.
export const ACTS = ["Curiosity", "Connection", "Creation", "Impact"];
export const BEATS = [
  { n: 1, act: 0, w: 1.0, name: "The void", layout: "centre", caps: ["A space for ideas"] },
  { n: 2, act: 0, w: 1.0, name: "Emergence", layout: "low", caps: ["Ideas emerge", "from curiosity."] },
  { n: 3, act: 0, w: 1.0, name: "Flow", layout: "low", caps: ["They move, evolve", "and find connections."] },
  {
    n: 4,
    act: 0,
    w: 1.7,
    name: "Identity",
    layout: "hero",
    eyebrow: "Creative technology studio",
    title: [["We make digital"], ["experiences ", "move."]],
    body: "Where design, technology and imagination converge to create experiences beyond the ordinary.",
    cta: "Explore our world",
  },
  { n: 5, act: 0, w: 1.0, name: "The journey", layout: "low", caps: ["A journey from", "idea to impact."] },
  { n: 6, act: 1, w: 1.4, name: "The network", layout: "left", title: [["Ideas don't exist"], ["in isolation."], ["", "Everything connects."]] },
  { n: 7, act: 1, w: 1.3, name: "Expanding universe", layout: "labels" },
  { n: 8, act: 1, w: 1.0, name: "Convergence", layout: "lowRight", caps: ["Creativity, design", "and engineering", "converge here."] },
  { n: 9, act: 1, w: 1.0, name: "Formation", layout: "low", caps: ["Ideas take", "a tangible form."] },
  {
    n: 10,
    act: 2,
    w: 1.5,
    name: "Design",
    layout: "impact",
    eyebrow: "01 / Design",
    title: [["Experiences"], ["with intention."]],
    body: "We turn complexity into clarity through purposeful design and intuitive experiences.",
  },
  {
    n: 11,
    act: 2,
    w: 1.5,
    name: "Engineering",
    layout: "impact",
    eyebrow: "02 / Engineering",
    title: [["Technology"], ["without limits."]],
    body: "We use creative engineering, interactive technologies and modern development to bring ideas to life.",
  },
  {
    n: 12,
    act: 2,
    w: 1.5,
    name: "Experience",
    layout: "impact",
    eyebrow: "03 / Experience",
    title: [["Built to leave"], ["an impression."]],
    body: "We create digital touchpoints that engage people and give brands a distinct identity.",
  },
  { n: 13, act: 2, w: 1.0, name: "Dissolution", layout: "low", caps: ["Experiences", "move people."] },
  { n: 14, act: 3, w: 1.0, name: "Transformation", layout: "low", caps: ["And turn", "possibilities", "@into reality."] },
  { n: 15, act: 3, w: 1.1, name: "Into the light", layout: "none" },
];

// frame 07's disciplines, embedded at their clusters (world/states.js)
export const DISCIPLINES = ["Design", "Technology", "Strategy", "Engineering"];

// Selected work. Names, years and services as on the site
// (ArchitecturalStorytelling/content.js, from Work/WorkMobile.jsx); imagery
// is the site's: device mockups where the site has them, otherwise the
// brand's logo on its own background from the clients grid.
const SITE_BODY = "We specialize in crafting one-of-a-kind, unforgettable experiences that captivate and engage your customers, leaving them craving for more."; // site
const LOGOS = "/assets/images/homepage/clients-grid-images";
export const PROJECTS = [
  {
    id: "montra",
    name: "Montra",
    year: "2023",
    services: ["Web Design", "Branding", "Marketing"],
    images: ["/assets/images/homepage/work/our-work-1.png", "/assets/images/homepage/work/our-work-4.png"],
    body: SITE_BODY,
  },
  { id: "yellow", name: "Yellow", year: "2024", services: ["Web Design", "Branding", "Marketing"], images: ["/assets/images/homepage/work/our-work-2.png"], body: SITE_BODY },
  { id: "monielink", name: "Monielink", year: "2025", services: ["Web Design", "Marketing", "Branding"], images: ["/assets/images/homepage/work/our-work-5.png"], body: SITE_BODY },
  { id: "patronum", name: "Patronum", year: "2023", services: ["Web Design", "Marketing", "Branding"], images: ["/assets/images/homepage/work/our-work-3.png"], body: SITE_BODY },
  // client brands without case imagery on the site: logo on its background
  { id: "dsw", name: "DSW", services: ["Client"], cover: `${LOGOS}/dsw-background.png`, logo: `${LOGOS}/dsw-icon.svg` },
  { id: "ams", name: "AMS", services: ["Client"], cover: `${LOGOS}/ams-background.png`, logo: `${LOGOS}/ams-icon.svg` },
  { id: "hiveminds", name: "Hiveminds", services: ["Client"], cover: `${LOGOS}/hiveminds-background.png`, logo: `${LOGOS}/hiveminds-icon.svg` },
];

// The four capabilities are the brief's; what each covers is drawn from the
// site's services and skills (Solutions.jsx).
export const CAPABILITIES = [
  {
    n: "01",
    name: "Digital Experiences",
    body: "Websites, digital products and brand experiences designed around real human needs.",
    items: ["User Experience Design", "User Interface Design", "Responsive Web Design", "Design Systems"],
  },
  {
    n: "02",
    name: "Creative Engineering",
    body: "Reliable, flexible and future-ready builds, with a human-centred approach to every interface we ship.",
    items: ["HTML", "CSS", "JavaScript", "React", "Vue", "Angular"],
  },
  {
    n: "03",
    name: "Product Development",
    body: "From research and strategy to the shipped product: understanding the problem before defining the solution.",
    items: ["Consumer Research", "UI Design Strategy", "Mobile App Design", "Digital Interface Design"],
  },
  {
    n: "04",
    name: "Motion & 3D",
    body: "Interactive environments, motion and WebGL that make an experience move — like the one you just scrolled through.",
    items: ["Motion Design", "WebGL", "Interactive 3D", "Scroll Storytelling"],
  },
];

export const PROCESS = [
  { n: "01", label: "Discover", body: "Research the people, the business and the opportunity." },
  { n: "02", label: "Define", body: "Turn insight into a clear strategy and scope." },
  { n: "03", label: "Design", body: "Shape the experience, from flows to the final interface." },
  { n: "04", label: "Develop", body: "Build it fast, accessible and ready to scale." },
  { n: "05", label: "Deliver", body: "Launch, measure and keep improving." },
];

// Testimonials from the site (TestimonialSectionInterActive.jsx).
export const TESTIMONIALS = [
  {
    name: "Shraddha Kasaudhan",
    role: "Founder & CEO, Kedarkala",
    quote:
      "Their unconventional approach and attention to detail allowed them to create a website that truly reflects our brand's essence and showcases our work in the best possible light.",
  },
  {
    name: "Ankush Chawla",
    role: "CEO, DMTCA",
    quote: "It's not just a website; it's DMTCA's digital identity.",
  },
];

export const STUDIO = {
  title: "From concept to conversion, we're changing the face of web.", // site
  body: "We unravel complex design challenges through meticulous user research, expert analysis, prototyping, and collaborative design with users and stakeholders.", // site
};
