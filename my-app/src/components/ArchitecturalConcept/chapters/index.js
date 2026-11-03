import * as arrival from "./arrival";
import * as research from "./research";
import * as strategy from "./strategy";
import * as design from "./design";
import * as engineering from "./engineering";
import * as work from "./work";
import * as impact from "./impact";
import * as handover from "./handover";

// The eight chapters in scroll order. The world (../world/world.js) is one
// continuous scene; a chapter owns only its DOM layer. Each module exports:
//   key, name            — CSS prefix (.ac-<key>-…) and the chapter's name
//   Overlay()            — its DOM; elements it drives carry data-k="…"
//   dom(t, f, w, st)     — runs every frame while the chapter is on screen, t = 0–1;
//                          f is the frame context (Stage.jsx), w the world's api, st its own state
//   bind?(els, f, w, st) — once, to wire clicks
export const CHAPTERS = [arrival, research, strategy, design, engineering, work, impact, handover].map((m) => ({
  key: m.key, name: m.name, Overlay: m.Overlay, dom: m.dom, bind: m.bind,
}));
