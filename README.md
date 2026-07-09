**PersonalOCSite**

A continuously evolving and iterative web visual project.

Repository: [https://github.com/GUIZANG/PersonalOCSite](https://github.com/GUIZANG/PersonalOCSite)

This project is an exploratory space, attempting to combine visuals, interaction, and design language. It is both an experiment and an exercise—a continual exploration of the expressive potential of the web. The project is still under development, with many design and technical elements constantly being refined and optimized.

🔹 **Requirements**

See [`requirements.txt`](requirements.txt) for runtime and dependency notes.

- Node.js >= 18
- npm >= 9

🔹 **Quick Start**

```bash
npm install
npm run dev
```

This project does not use a root `index.html`. After the dev server starts, open a specific page directly, for example:

- Awake homepage: `http://localhost:5173/010awake/awake.html`
- Archive scene: `http://localhost:5173/020archive/archive.html`
- Black Moon text: `http://localhost:5173/021blackMoon/010blackMoonText/blackMoonText.html`
- Black Moon main scene: `http://localhost:5173/021blackMoon/020blackMoonMain/blackMoon.html`
- Black Moon terminal: `http://localhost:5173/021blackMoon/030blackMoonTerminal/blackMoonTerminal.html`

Build and preview:

```bash
npm run build
npm run preview
```

🔹 **Project Structure**

- `public/` — main static multi-page site (HTML / CSS / JavaScript)
- `public/010awake/` — awake homepage (entry) with scroll-driven narrative, shader scene, custom cursor, and music
- `public/020archive/` — archive scene with a Three.js particle hypercube, full-screen particle expansion, scanning card stream, and custom cursor
- `public/021blackMoon/` — Black Moon narrative modules (`010blackMoonText` / `020blackMoonMain` / `030blackMoonTerminal`), a branch off the archive scene
- `public/reference/` — reference experiments used for visual interaction prototypes
- `public/libs/` — locally bundled third-party libraries loaded by static pages
- `src/` — leftover Vue scaffold files (currently unused by the live site)
- `public/assets/` — shared static assets (`images/`, `fonts/`, `audio/`)

🔹 **Recent Update (Main Scene)**

- Added a liquid-glass card material with background refraction, spectral scattering, thickness absorption, Fresnel response, specular highlights, softened internal bubble motion, and card-edge thickness cues
- Reworked the scanning archive cards so the scanned-left region reveals the Buddhist scripture ASCII text block while the unscanned-right region remains liquid glass
- Expanded selected-card background states with per-card color palettes, glitch-assisted palette switching, and a darker red-toned focused scene
- Refined hypercube and cursor feedback, including long-press cursor glitch behavior and press-progress color transition on the visible cursor ring
- Stabilized the looping card focus flow so finite DOM clones continue to read as an infinite sequence during repeated card switching

🔹 **Project Goal**

The project aims to explore the possibilities of the web as a medium for creation. Through experimental visual effects and interactive design, it seeks to present dynamic experiences that are difficult to achieve with traditional static interfaces. The goal is to convey an aesthetic feeling while maintaining simplicity and clarity, allowing users to experience immersion and a sense of discovery through interaction.

This project is not intended to achieve full functionality or commercialization; rather, it functions as a visual laboratory focused on:

* Exploration of visual style and color language
* Experimentation with dynamic interactions and responsive layouts
* Iteration of animation and visual effects
* Subtle tuning of user perception and experience

🔹 **Design Inspiration**

The overall style of the project is inspired by Fictional Universes such as *Disco Elysium*, the *SCP Foundation*, and *Cultist Simulator*. These influences contribute elements like surreal and immersive atmospheres, cryptic and mysterious aesthetics, and an experimental approach to narrative and interaction, combining moody, dystopian textures with abstract and symbolic visual motifs.

🔹 **Technical Direction**

To achieve these design goals, the project experiments with various web technologies and tools:

* **HTML / CSS / JavaScript** as foundational building blocks
* **WebGL / Three.js** for visual rendering and effects
* **Shader programming** for dynamic lighting, water surfaces, glows, and particle effects
* **Responsive layouts and event listeners** to enhance interactivity
* **Hybrid visual effects**, exploring layers, transparency, overlays, and blend-mode potentials

Technology choices prioritize experimentation and exploration, emphasizing adjustability, iterability, and alignment with the design inspirations.

🔹 **Future Direction (Conceptual)**

In the future, the project will continue to seek a balance between visual experimentation and interactive exploration:

* Delve deeper into the plasticity of contours, lines, and forms
* Explore subtle feedback between interaction and user perception
* Realize artistic experiments and visual storytelling within the web space
* Continuously refine visual language and design style to integrate with modern web technologies

This process is itself part of the project: constant experimentation, iteration, and adjustment, discovering unexpected effects and new possibilities along the way.

This project is a dynamically growing experimental space, both a technical and a visual experiment. Updates are welcome, and so are ideas or inspirations for the experimental process. Each adjustment may bring new surprises, and every iteration is a fresh exploration.

🔹 **License**

This project is dual-licensed:

- **Source code** (HTML / CSS / JavaScript / shaders / config) — [MIT License](LICENSE).
- **Original creative content** (OC, text, visual designs, artwork, images, audio) — [CC BY-NC-ND 4.0](ContentLicense.md): sharing with attribution is allowed, but commercial use and derivative works are not.

Third-party libraries under `public/libs/` and other dependencies remain under their own respective licenses.

© 2026 ZhuiYuYu.
