// All copy and data for the page. Everything about Hyperiux itself (services
// and their skills, projects, clients, industries, testimonials, contact) is
// taken from the existing site components in this repo
// (components/HyperiuxHome, components/ForgingConcept/content.js); the frame
// headlines are the brief's. No metrics, clients or claims are added.

export const CONTACT = {
  email: "hi@hyperiux.com",
  phone: "+91 8178 026 136",
  phoneHref: "tel:+918178026136",
  address: "Grandslam I-Thum, A-40, Sector 62, Noida, Uttar Pradesh 201309",
  company: "Hyperiux Immersion Labs",
};

// (no profile URLs in the project yet: placeholders until they are linked)
export const SOCIAL = ["LinkedIn", "Instagram", "X", "Facebook"];

export const NAV = [
  { label: "Work", to: "#work" },
  { label: "Services", to: "#capabilities" },
  { label: "About", to: "#about" },
  { label: "Contact", to: "#contact" },
];

// The twenty beats. Frames 01–09 play in the pinned opening (the blueprint
// drawing itself, dark into light); 10–20 are sections of the page.
export const FRAMES = [
  { n: 1, label: "Introduction", title: "From Insight to Impact.", body: "We are a growth and experience partner where human behaviour, design, technology and marketing connect." },
  { n: 2, label: "Origin", title: "Every great creation begins with an idea." },
  { n: 3, label: "Construction", title: "Every element has a purpose." },
  { n: 4, label: "Identity", title: "More than a symbol. A connected way of thinking." },
  { n: 5, label: "The core", title: "Everything begins with a strong foundation." },
  { n: 6, label: "Structure", title: "Great systems are built on meaningful connections." },
  { n: 7, label: "Who we are", title: "We connect what moves businesses forward.", body: "We bring human behaviour, strategic thinking, creative design and technology together." },
  { n: 8, label: "Human first", title: "Better experiences begin with understanding people." },
  { n: 9, label: "Capabilities", title: "Four disciplines. One connected approach." },
  { n: 10, label: "Strategy", id: "strategy" },
  { n: 11, label: "UI/UX Design", id: "design" },
  { n: 12, label: "Technology", id: "technology" },
  { n: 13, label: "Marketing", id: "marketing" },
  { n: 14, label: "Process", id: "process" },
  { n: 15, label: "Work", id: "work" },
  { n: 16, label: "Case study", id: "case-study" },
  { n: 17, label: "Impact", id: "impact" },
  { n: 18, label: "Bigger picture", id: "bigger-picture" },
  { n: 19, label: "About", id: "about" },
  { n: 20, label: "Contact", id: "contact" },
];

export const CONNECTIONS = ["Human behaviour", "Strategy", "Design", "Technology", "Growth"];

export const JOURNEY = [
  { n: "01", label: "Discover", body: "Who people are, and what they need." },
  { n: "02", label: "Explore", body: "Where they look, and what they compare." },
  { n: "03", label: "Engage", body: "The moments that earn attention." },
  { n: "04", label: "Convert", body: "Clear, confident decisions." },
  { n: "05", label: "Grow", body: "Relationships that keep compounding." },
];

// The four services and their skills, as on the site (Solutions.jsx).
export const SERVICES = [
  {
    id: "strategy",
    n: 10,
    name: "Strategy",
    line: "Find the right direction.",
    body: "Strategic planning based on insight is the starting point of everything we do: understanding business problems, people and opportunities before defining the solution.",
    skills: ["UI design strategy", "Branding", "User Experience Development", "Integrated Digital Marketing Plan", "Customer Experience Strategy", "Consumer Research"],
  },
  {
    id: "design",
    n: 11,
    name: "UI/UX Design",
    line: "Turn complexity into clarity.",
    body: "We design intuitive and meaningful digital experiences around real human needs: digital products, websites, mobile app UIs and brand experiences.",
    skills: ["User Interface Design", "User Experience Design", "Responsive Web Design", "Mobile App Design", "Digital Interface Design", "Design Systems Creation"],
  },
  {
    id: "technology",
    n: 12,
    name: "Technology",
    line: "Build for scale and performance.",
    body: "We build reliable, flexible and future-ready digital solutions, with a human-centred approach to every interface we ship.",
    skills: ["HTML", "CSS", "JavaScript", "React", "Vue", "Angular"],
  },
  {
    id: "marketing",
    n: 13,
    name: "Marketing",
    line: "Create momentum and growth.",
    body: "Brand marketing crafted to drive engagement, build loyalty and adapt to the digital landscape with precision and creativity.",
    skills: ["Social Media Management", "Content Creation & Curation", "Search Engine Optimisation", "Influencer Management", "Online Reputation Management", "Marketing Automation"],
  },
];

export const PROCESS = [
  { n: "01", label: "Discover", body: "Research the people, the business and the opportunity." },
  { n: "02", label: "Define", body: "Turn insight into a clear strategy and scope." },
  { n: "03", label: "Design", body: "Shape the experience, from flows to the final interface." },
  { n: "04", label: "Develop", body: "Build it fast, accessible and ready to scale." },
  { n: "05", label: "Grow", body: "Launch, measure and keep improving." },
];

// Selected work, as listed on the site (Work/WorkMobile.jsx,
// WorkWithContent.jsx): name, year, services and its imagery. The site has
// no case-study pages yet, so a project opens in the case study below.
const PROJECT_BODY = "We specialize in crafting one-of-a-kind, unforgettable experiences that captivate and engage your customers, leaving them craving for more."; // site
export const PROJECTS = [
  { id: "montra", name: "Montra", year: "2023", services: ["Web Design", "Branding", "Marketing"], image: "/assets/images/homepage/work/our-work-1.png", detail: "/assets/images/homepage/work/our-work-4.png", body: PROJECT_BODY },
  { id: "yellow", name: "Yellow", year: "2024", services: ["Web Design", "Branding", "Marketing"], image: "/assets/images/homepage/work/our-work-2.png", body: PROJECT_BODY },
  { id: "patronum", name: "Patronum", year: "2023", services: ["Web Design", "Marketing", "Branding"], image: "/assets/images/homepage/work/our-work-3.png", body: PROJECT_BODY },
  { id: "monielink", name: "Monielink", year: "2025", services: ["Web Design", "Marketing", "Branding"], image: "/assets/images/homepage/work/our-work-5.png", body: PROJECT_BODY },
];

const LOGOS = "/assets/images/homepage/clients-grid-images";
export const CLIENTS = [
  ["Montra", "montra"],
  ["Yellow", "yellow"],
  ["Patronum", "patronum"],
  ["Monielink", "monielink"],
  ["Kedarkala", "kedarkala"],
  ["DMTCA", "dmtca"],
  ["Hiveminds", "hiveminds"],
  ["Bespin Labs", "bespin-labs"],
  ["DSW", "dsw"],
  ["AMS", "ams"],
  ["Patra", "patra"],
  ["QuickX", "quickx"],
].map(([name, file]) => ({ name, logo: `${LOGOS}/${file}-icon.svg` }));

export const INDUSTRIES = ["Fintech", "Banking", "Technology", "Education", "Electronics"];

// Testimonials from the site (TestimonialSectionInterActive.jsx).
export const TESTIMONIALS = [
  {
    name: "Shraddha Kasaudhan",
    role: "Founder & CEO, Kedarkala",
    quote:
      "Their unconventional approach and attention to detail allowed them to create a website that truly reflects our brand's essence and showcases our work in the best possible light. The new website has not only improved our online presence but has also significantly increased our leads and conversions.",
  },
  {
    name: "Chinara Musa",
    role: "Managing Director & Chief Promoter, GCM",
    quote:
      "Hyperiux exceeded our expectations in every way, delivering a website that truly captures the essence of our brand and sets the stage for our grand opening.",
  },
  {
    name: "Ankush Chawla",
    role: "CEO, DMTCA",
    quote: "Hyperiux has truly outdone themselves. The new website is not just a testament to their capabilities but a reflection of their understanding of our brand. It's not just a website; it's DMTCA's digital identity.",
  },
];

export const ABOUT = {
  title: "From Concept to Conversion, We're Changing the Face of Web.", // site
  body: "We unravel complex design challenges through meticulous user research, expert analysis, prototyping, and collaborative design with users and stakeholders. Harnessing the power of cutting edge tools and our proprietary approach we craft delightful and intuitive experiences.", // site
};
