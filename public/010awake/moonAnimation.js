// Full-page horizon background. Uses the shared horizon renderer and drives it
// from scroll: the scene interpolates from the Night preset to the Sunny preset
// as the page scrolls, with a matching camera move. All rendering, resize and
// pointer handling lives in horizonScene.js.
import { createHorizonScene } from "./horizonScene.js";

const smooth01 = (p) => p * p * (3 - 2 * p);

const horizon = createHorizonScene({ container: document.body });
horizon.applyPreset("Night");

// CRT scanline layer that fades in as the scene reaches the Sunny end state.
const scanlines = document.createElement("div");
scanlines.className = "awake-sunny-scanlines";
scanlines.setAttribute("aria-hidden", "true");
document.body.appendChild(scanlines);

window.addEventListener("scroll", () => {
  const range = document.documentElement.scrollHeight - window.innerHeight;
  const progress = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
  const eased = smooth01(progress);

  horizon.lerpPreset("Night", "Sunny", eased);
  horizon.setCamera(4.0 - (4.0 - 1.5) * eased, -0.1 + (2.5 - (-0.1)) * eased);

  // Only reveal scanlines in the last stretch of the scroll (Sunny state).
  const scanline = smooth01(Math.min(1, Math.max(0, (progress - 0.7) / 0.3)));
  document.body.style.setProperty("--sunny-scanline-opacity", scanline.toFixed(3));
}, { passive: true });
