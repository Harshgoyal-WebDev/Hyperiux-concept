# Hyperiux website concept: handoff

Paste this file into a new Claude chat (or open this folder in Claude Code) to continue the work.

## The brief
Redesign concepts for hyperiux.com (staging: https://hyperiux-staging.vercel.app/), a UI/UX and web design agency in Noida.
The goal is a 3D and 2D, architecture-themed scroll journey: one connected story about how Hyperiux turns a client's brand identity into a web experience. The Hyperiux logo is the centrepiece.

References the user chose to follow:
- heronaiapp.com: paper drafting world. The floor plan draws itself, walls fill in solid, dimension strings appear, and orange markers open spec cards. One-line statements sit alone on blank sheets.
- composites.archi: dark, ribbed sculptural forms; big caps headlines revealed line by line with orange highlight words.
- zeggo.com.sg: edge-only wireframe city on black, with a numbered list stepping down the page.
- mkebsi.com: grain, particle clouds forming shapes, contour lines.
- enpowertrading.co.za: line-drawn 3D world; the camera travels station to station, with a bottom chapter progress bar and an info card.

## The concept: "Your brand is the cube. We build the world around it."
The logo is read as architecture:
- Two columns (orange bars) and a beam that rises about 12° left to right.
- A cube in the joint. The cube is the client's brand and appears in every chapter.
- The H is Hyperiux, the structure that carries the brand.
- #FF6A13 orange marks Hyperiux only. Client colours appear only on the cube and the facade.

Logo geometry, in a 240×240 px space:
- LA = [[15,0],[47,0],[47,78],[15,78]]
- LB = [[15,240],[15,108],[192,70],[192,0],[225,0],[225,99],[47,137],[47,240]]
- LC = [[192,133],[225,133],[225,240],[192,240]]
- Iso cube centred at (120,101), radius 19, white fill with an orange stroke.

### Nine chapters (one camera, one day: day → dusk → night → dawn → day)
1. **Arrival** (day): loader 00→100; the H assembles around the floating cube, turns orange, and the camera dives into the cube.
2. **Survey** (day): the cube unfolds into six facets (Purpose, Voice, Audience, Behaviour, Visuals, Market). Contour lines appear, and particles cluster into the four lenses: emotion, design, technology, neuromarketing. A bionic-reading paragraph carries the research copy.
3. **Blueprint** (day): the H as a floor plan. Walls draw, then fill solid; dimension strings appear; six orange markers stand for the six strategy services; the user flow climbs the beam to "conversion". Headline: "Strategy is the floor plan."
4. **Structure** (day): the plan rises into three masses. Grid, columns, slabs and core map to the design system. Exploded view: tokens, components, patterns, pages. Headline: "Design systems are load-bearing."
5. **Material** (dusk → night): fins around the cube take each brand palette, then become dark composite ribs, then wireframe. Headline: "Your identity becomes the facade."
6. **Systems** (night): wireframe building with orange risers. Numbered list: 01 Motion & WebGL, 02 Performance, 03 Headless CMS, 04 Organic growth. Headline: "What you don't see holds everything up."
7. **District** (night): the projects (Montra, Yellow, Patronum, Montra App, Monielink) are buildings along a road. The camera stops at each one, and its facade shows the live site.
8. **Occupancy** (dawn): industry zones (Electronics, Fintech, Education, Technology, Banking), people flowing along roads, growth bars, the Patronum testimonial.
9. **Handover** (day): from above, the city's streets spell the H and the cube rises in the plaza. CTA "Let's bring your ideas to life", Say Hi, contact details as a drawing title block, then a loop back to the start.

## Files in this folder
| File | What it is |
|---|---|
| `src/engine.js` | SVG frame engine. `HX.frame(chapter 0–8, t 0–1)` returns an SVG string. It has a tiny 3D projection, prisms, painter's sort, and the camera path for all 9 chapters. |
| `src/page.html` | Concept presentation page template (logo study, references, journey map, storyboard, scroll player, build notes). It has a `/*__ENGINE__*/` placeholder. |
| `build.py` | Inlines `src/engine.js` into `src/page.html` and writes `hyperiux-scroll-journey.html`. Run `python3 build.py` after editing either file. |
| `hyperiux-scroll-journey.html` | Built concept page: 90 storyboard frames (10 per chapter), a lightbox scrubber and a full scroll player. |
| `hyperiux-arrival.html` | Hi-fi Three.js prototype of chapter 1. Done and checked. |
| `hyperiux-blueprint.html` | Hi-fi Three.js prototype of chapter 3, with clickable service markers and cards. Done and checked. |
| `hyperiux-district.html` | Hi-fi Three.js prototype of chapter 7, with lit windows, live-site facades and click-a-building-to-travel. Done and checked. |
| `hyperiux-material.html` | Hi-fi Three.js prototype of chapter 5, with brand chips that recolour the fins and cube. Done and checked. |

All hi-fi pages are single self-contained HTML files. Each one:
- Loads Three.js r149 from `https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js`.
- Uses Google Fonts: Archivo (display), IBM Plex Mono (labels), Instrument Sans (body).
- Maps scroll to t (0–1) with damping, and has a bottom F01–F10 frame strip that jumps to each storyboard frame. Adding `#f6` to the URL opens at frame 6.
- Uses the same timeline curves as the storyboard: `seg(t,a,b)`, `io` (ease-in-out cubic), `eo` (ease-out cubic).

Published links (republished 03.11.2026 from the current account; all private until shared from each page's Share menu). If a different account takes over, republish from the files instead.
- Concept page: https://claude.ai/artifact/AskQVWqqaGDna2F1gfYJWg
- Arrival: https://claude.ai/artifact/K3GwwUp27AXdM95YPWt37X
- Blueprint: https://claude.ai/artifact/3AcUcNBmLDw5zAMmHwCa7d
- District: https://claude.ai/artifact/QP9BHwBydEopRA8yiRsm8g
- Material: https://claude.ai/artifact/TpeTZwsrA4BJvSFpmqrRG8

The concept page's hero has "hi-fi WebGL ↗" buttons linking those four; they live in `src/page.html`. If you republish under a new account, update the links and run `build.py`.

## How frames were checked
Headless Chrome with software WebGL, at a fixed timeline position. Scrolling the page in headless mode renders blank, so the scroll reader is swapped for a fixed value:

```bash
# make a test copy pinned at frame F (1–10), then screenshot it
python3 - hyperiux-material.html 5 /tmp/mt5.html <<'EOF'
import sys
src,f,out=sys.argv[1],int(sys.argv[2]),sys.argv[3]
s=open(src).read()
a="const readScroll=()=>{ target=clamp(scrollY/maxScroll()); };"
s=s.replace(a,f"const readScroll=()=>{{ target={(f-1)/9}; }}; cur={(f-1)/9};")
open(out,'w').write('<!doctype html><html><head><meta charset="utf-8"></head><body>'+s+'</body></html>')
EOF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --virtual-time-budget=4000 --window-size=1440,810 --screenshot=/tmp/mt5.png file:///tmp/mt5.html
```

Also check at a narrow width (`--window-size=500,900`). Headless Chrome won't go narrower than about 500px.

## Next steps
1. Material is done (rendered, fixed and published, with its link on the concept page). Its timeline: paper warms while the fins rise (F2–F3), the sky darkens to dusk just before the spec chips (F4, the text flips to light at the same time), Brand A/B/C are each fully applied by F5/F6/F7, dark ribs by F8, statement F9, wireframe F10.
2. Next: hi-fi versions of the remaining chapters: Systems, Survey, Structure, Occupancy, Handover.
3. Before showing clients, replace the placeholders:
   - Brand palettes in Material (labelled "Placeholder palettes").
   - Mock facade sites in District (should be real captures of each project).
   - Service card copy in Blueprint (written by Claude, not taken from the site).
   - Growth bars in Occupancy, which have no real metrics yet.

## Style rules used throughout
- **Colours:** paper #E7E6E2, sheet #F3F2EE, ink #141413, graphite #5D5B56, orange #FF6A13 (use #B9440A for small orange text on paper), night #0C0C0D.
- **Type:** caps-tight Archivo headlines that reveal line by line, with orange highlight words. Mono uppercase labels.
- **Site chrome on every frame:** logo + HYPERIUX at top left, "0X / Chapter" in the centre, Menu and a "Start a project" pill at the right, and the progress strip along the bottom.
- **Copy:** plain and direct. The "not X but Y" construction is allowed only inside the client's own quote.
