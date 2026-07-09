// Full-page horizon background. Uses the shared horizon renderer and drives it
// from scroll: the scene interpolates from the Night preset to the Sunny preset
// as the page scrolls, with a matching camera move. All rendering, resize and
// pointer handling lives in horizonScene.js.
import { createHorizonScene } from "./horizonScene.js";

const smooth01 = (p) => p * p * (3 - 2 * p);

const horizon = createHorizonScene({ container: document.body });
horizon.applyPreset("Night");

window.addEventListener("scroll", () => {
  const range = document.documentElement.scrollHeight - window.innerHeight;
  const progress = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
  const eased = smooth01(progress);

  horizon.lerpPreset("Night", "Sunny", eased);
  horizon.setCamera(4.0 - (4.0 - 1.5) * eased, -0.1 + (2.5 - (-0.1)) * eased);
}, { passive: true });
