// Copy and team data for the /about experience ("Revealed by light").

// 01 — on the hero, at the top of the scroll
export const INTRO = {
  title: ["The people", "behind Hyperiux"],
  body: "Hyperiux is a digital experience design agency. Designers, developers and storytellers turning ideas into worlds people can step into.",
};

// 02 — as the land turns to light
export const STORY = {
  title: ["Every streak, an idea.", "Together, a new world."],
};

// The team, one at a time in the slider. The count shown is TEAM.length.
//   source: the photo the light-strand portrait is built from (never shown
//     itself). Head and shoulders, roughly front-facing; a plain, darker
//     background separates best. Missing file → an anonymous silhouette and
//     an on-screen note naming the path.
//   mask (optional): a black-and-white outline of the person, the same size
//     as the photo (white = the person). The photo is used exactly as it is;
//     the mask only says where the person ends — for a backdrop the
//     automatic separation can't tell apart (e.g. a grey studio gradient).
//   focus: where to frame the photo in the portrait's 4:5 map — x/y (0..1,
//     the point of the photo put at the centre) and zoom (1 = cover).
export const TEAM = [
  {
    id: "harsh-goyal",
    name: "Harsh Goyal",
    role: "Frontend Developer",
    bio: "Crafting immersive, high-performance web experiences with design, motion and technology.",
    source: "/assets/images/about/team/harsh-goyal.jpg",
    focus: { x: 0.5, y: 0.5, zoom: 1 },
  },
  {
    id: "bhaskar-varshney",
    name: "Bhaskar Varshney",
    role: "CEO & Founder",
    bio: "Leading Hyperiux with a vision to create meaningful digital experiences through design, technology and innovation.",
    // (his light-line render, as Harsh's source is)
    source: "/assets/images/about/team/Amber%20Light-Line%20Portrait.png",
    focus: { x: 0.5, y: 0.5, zoom: 1 },
  },
];
