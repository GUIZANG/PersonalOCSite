# PersonalOCSite

An evolving web-based visual narrative and interaction laboratory by ZhuiYuYu.

[GitHub repository](https://github.com/GUIZANG/PersonalOCSite)

PersonalOCSite explores the web as a medium for atmosphere, spatial interaction,
experimental typography, and fragmented storytelling. The project combines
WebGL particles, shader-driven faults, custom cursor states, industrial interface
systems, and responsive editorial layouts into a connected set of scenes.

The work is actively developed. Visual systems, timing, performance, and
interaction details continue to change as the project evolves.

## Current Archive Experience

`020archive` — **PRECOGNITIVE STRATA** — is the current main experimental scene.
It is structured as three connected interface states:

### Hypercube

- A shared Three.js particle field appears through five movable observation windows.
- Recursive grayscale frames create a black → white → black depth tunnel beneath the scene.
- Moving near the central object folds the Hypercube into an eye-like particle formation.
- Holding the core for three seconds progressively destabilizes the interface:
  particle polarity changes, the background depth cycles accelerate, HUD copy mutates,
  and signal faults intensify.
- Completing the hold breaks the Hypercube into a full-screen red particle field.
- Random television-signal faults, image intrusions, blink shutters, and hidden eye
  traces interrupt the otherwise controlled interface.

### Card Stream

The particle burst resolves into four minimal archive records:

1. `SIGNAL`
2. `VECTOR`
3. `ORACLE`
4. `NOESIS`

Cards can be changed by dragging horizontally, using the mouse wheel, selecting the
bottom index, pressing `1–4`, or using the arrow keys. The bottom rail acts as a
fixed capture point while the surrounding records move through it.

### Credits

Dwelling above the upper edge rail remaps the observation interface into the
Credits page. The transition preserves the perceived depth of the video windows
while reorganizing them into an acknowledgement index.

The Credits scene includes a grid-built SVG wordmark, source links, controlled
text faults, and a bottom-edge return interaction. Moving to the lower edge
restores the Archive through a dedicated depth-calibration transition.

## Archive Controls

| Context | Input | Result |
| --- | --- | --- |
| Hypercube | Move into the central observation area | Form and orient the particle eye |
| Hypercube core | Hold primary mouse button for 3 seconds | Open the Card Stream |
| Observation window bar | Drag | Reposition the window |
| Lower-left depth control | Drag horizontally / arrow keys | Adjust the recursive background index |
| Upper edge rail | Dwell for 2 seconds | Open Credits |
| Credits | Move or tap near the lower edge | Return to Archive |
| Card Stream | Horizontal drag | Move between records |
| Card Stream | Mouse wheel / arrow keys | Select previous or next record |
| Card Stream | Number keys `1–4` | Select a record directly |

## Quick Start

Requirements:

- Node.js 18 or newer
- npm 9 or newer

Install and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/). The root page redirects to
the Awake entry scene.

Individual scenes can also be opened directly:

- Awake entry: `http://localhost:5173/010awake/awake.html`
- Precognitive Strata: `http://localhost:5173/020archive/archive.html`
- Black Moon text: `http://localhost:5173/021blackMoon/010blackMoonText/blackMoonText.html`
- Black Moon main scene: `http://localhost:5173/021blackMoon/020blackMoonMain/blackMoon.html`
- Black Moon terminal: `http://localhost:5173/021blackMoon/030blackMoonTerminal/blackMoonTerminal.html`

Build and preview:

```bash
npm run build
npm run preview
```

## Project Structure

```text
public/
├── 010awake/       Entry scene and scroll-driven narrative
├── 020archive/     Hypercube, observation windows, Credits, and Card Stream
├── 021blackMoon/   Black Moon narrative modules
├── assets/         Shared images, fonts, and audio
├── libs/           Locally bundled browser libraries
└── reference/      Visual and interaction studies

src/                Legacy Vue scaffold; not used by the current static scenes
```

The live experience is primarily a static multi-page site served through Vite.
Scene-specific HTML, CSS, and JavaScript remain under `public/` so each visual
system can be developed independently.

## Recent Archive Update

- Rebuilt Card Stream as four clear title records over the persistent particle field.
- Added a drag-responsive carousel with a fixed Roman-numeral capture rail.
- Refined the custom SVG `CREDITS` wordmark and acknowledgement layout.
- Preserved window depth during the Archive ↔ Credits metamorphosis.
- Added responsive corner systems, signal faults, text glitches, image intrusions,
  and long-press feedback.
- Optimized Hypercube interaction without changing its particle count, motion,
  color, timing, easing, or transition design:
  pointer work is frame-coalesced, layout measurements are cached, and redundant
  DOM/WebGL state writes are skipped.

## Technical Direction

- **HTML, CSS, and JavaScript** for the scene and interface systems
- **Three.js / WebGL** for particle geometry and shader rendering
- **GSAP** for selected motion and depth-field interpolation
- **SVG and Canvas** for typography, masks, grids, and signal layers
- **Vite** for local development and production builds
- Responsive layout, custom pointer handling, blend modes, clip paths, and
  deliberately constrained monochrome/red/cyan color systems

The implementation favors visual continuity and precise interaction timing.
Performance work is treated as part of the design: optimization should preserve
the rendered composition rather than simplify it.

## Design Language

The project combines:

- glitch and damaged-signal aesthetics
- industrial interfaces and diagnostic instrumentation
- Brutalist composition
- Swiss typographic restraint
- recursive depth, surveillance, memory, and precognition motifs

Narrative influences include *Disco Elysium*, the *SCP Foundation*, and
*Cultist Simulator*. Interface and motion references are credited within the
Credits scene; copyright remains with each original author.

## Status

This is an independent, non-commercial visual experiment. It is not intended as
a conventional product or finished application. The repository functions as both
an artwork in progress and a record of iterative interaction research.

## License

This project is dual-licensed:

- **Source code** — [MIT License](LICENSE)
- **Original creative content** — [CC BY-NC-ND 4.0](ContentLicense.md)

Third-party libraries under `public/libs/`, referenced studies, and external
assets remain under their respective licenses.

© 2026 ZhuiYuYu.
