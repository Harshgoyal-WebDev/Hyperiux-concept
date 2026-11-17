# Hyperiux: Forging Concept

A standalone copy of the `/forging-concept` page from the Hyperiux-concept repo (`my-app`), with all the code and assets it needs.

## Run it

Requires Node 20.9 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000. It redirects to `/forging-concept`.

## What's inside

| Path | What it is |
|---|---|
| `src/app/forging-concept/` | The route: its page and its layout, which loads the fonts (Aeonik Pro and Orbitron). |
| `src/components/ForgingConcept/` | The concept: the scroll timeline, the 3D scene (forge, sand, garden), overlays, loader and audio. |
| `src/components/HyperiuxHome/` | The Hyperiux homepage sections (Work, Solutions, Clients, Testimonials, Blogs, FAQ). They load below the garden at the end of the journey. |
| `src/components/SmoothScroll.jsx` | Lenis smooth scroll, mounted in the root layout. |
| `src/app/globals.css` | Tailwind and the global styles the homepage sections use. |
| `public/models/` | `hyperiux-forging-assets.glb` and `hyperiux-garden-environment.glb`, each with a metadata JSON that documents its anchors. |
| `public/draco/` | The Draco decoder the GLB loader uses. |
| `public/assets/` | Fonts, icons and the homepage images. |

## Notes

- Stack: Next.js 16, React 19, React Three Fiber, Three.js, GSAP, Lenis and Tailwind 4.
- The tuning panel (leva) is part of the concept and loads on demand.
- `HyperiuxHome` links to `/assets/icons/arrow-diagonal.svg`, which isn't in the main repo either, so that one icon request returns a 404 in both copies.
