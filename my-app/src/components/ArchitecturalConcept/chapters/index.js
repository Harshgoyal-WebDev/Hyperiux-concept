import * as arrival from "./arrival";
import * as survey from "./survey";
import * as blueprint from "./blueprint";
import * as structure from "./structure";
import * as material from "./material";
import * as systems from "./systems";
import * as district from "./district";
import * as occupancy from "./occupancy";
import * as handover from "./handover";

// The nine chapters in scroll order. Each module exports:
//   key, name     — CSS prefix (.ac-<key>-…) and the chapter's display name
//   build(kit)    — builds its three.js objects once → { root: Group, update(t, f), bind?(els, f) }
//   Overlay()     — its DOM layer (copy, cards, labels); elements the update drives carry data-k="…"
// update(t, f) runs every frame while the chapter is on screen, t = 0–1 (the
// storyboard's ten frames sit at t = i/9). f is the frame context (Stage.jsx).
export const CHAPTERS = [arrival, survey, blueprint, structure, material, systems, district, occupancy, handover].map((m) => ({
  key: m.key, name: m.name, build: m.build, Overlay: m.Overlay,
}));
