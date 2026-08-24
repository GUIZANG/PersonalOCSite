// VFX-JS post effect on the "THE EYE" wordmark: most of the time it renders the
// text untouched, then at random intervals a short burst kicks in where a few
// random rectangular blocks jump around with an RGB split (chromatic box
// glitch). The burst window and cadence are randomised each time.
//
// Loaded as an ES module. The library is the locally bundled VFX-JS in
// /libs/vfx-js.min.js (self-contained ESM, three inlined) so it works offline.
// If the import fails the module simply does nothing and the wordmark stays as
// normal DOM text.
import { VFX } from "../libs/vfx-js.min.js";

// g (uGlitch) is 0 while idle and 1 during a burst. A single shared object so
// the per-frame uniform function can read the latest value cheaply.
const state = { glitch: 0, reveal: 0 };

// Random cadence + burst length (ms). Tweak here.
const GAP_MIN = 4000;
const GAP_RANDOM = 5000; // => 4-9s between bursts
const BURST_MIN = 150;
const BURST_RANDOM = 280; // => 150-430ms per burst

const SHADER = `
precision highp float;
uniform vec2 resolution;
uniform vec2 offset;
uniform float time;
uniform sampler2D src;
uniform float uGlitch;
uniform float uReveal;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// Sample the wordmark, but return transparent for any coordinate outside its own
// box. Without this the displaced / RGB-split samples clamp to the edge texels
// and smear the letters into bright lines along the left / bottom borders.
vec4 samp(vec2 p) {
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec4(0.0);
  return texture2D(src, p);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - offset) / resolution;
  float g = clamp(uGlitch, 0.0, 1.0);
  float reveal = clamp(uReveal, 0.0, 1.0);

  // Confine everything to the wordmark's own box. The VFX canvas has overflow
  // padding around the element; sampling there hits clamped edge texels which
  // smear the letters into tall vertical bars above/below. Keep the padding fully
  // transparent so the glitch only ever plays out ON the text itself.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Random rectangular blocks; the layout reshuffles a few times per second so
  // each burst is a different set of boxes.
  vec2 grid = vec2(9.0, 5.0);
  float seed = floor(time * 24.0);
  vec2 cell = floor(uv * grid);
  float r = hash21(cell + seed);

  // Only a minority of boxes are lit at any instant. ("active" is a reserved
  // word in GLSL, so this must not be named that.)
  float boxOn = step(0.76, r) * step(0.5, g);

  // Horizontal-only displacement of the lit boxes: no vertical shift means no
  // blocks poke out above/below the wordmark (kills the "tall bar" artifact).
  float dx = hash21(cell * 1.7 + seed) - 0.5;
  vec2 boxShift = vec2(dx, 0.0) * 0.26 * boxOn;

  // RGB split: a faint constant split across the whole word during a burst,
  // much stronger inside the lit boxes.
  float rgb = (0.006 + 0.022 * boxOn) * step(0.5, g);

  vec2 base = uv + boxShift;
  vec4 cr = samp(base + vec2(rgb, 0.0));
  vec4 cg = samp(base);
  vec4 cb = samp(base - vec2(rgb, 0.0));

  float a = max(max(cr.a, cg.a), cb.a);

  // Fade the outermost ~3px of the wordmark box. VFX rasterises the element into a
  // texture and leaves a faint bright seam along the border box (a white line on
  // the top/left edges). The whole colour (RGB *and* A) is multiplied by the mask
  // so the seam vanishes regardless of the canvas blend mode (additive / premult
  // alpha would otherwise still show the RGB even at alpha 0). The CSS padding
  // gutter keeps this fade away from the actual glyphs.
  vec2 pxUv = 1.0 / resolution;
  float fade = 6.0;
  float mask = smoothstep(0.0, pxUv.x * fade, uv.x)
             * smoothstep(0.0, pxUv.x * fade, 1.0 - uv.x)
             * smoothstep(0.0, pxUv.y * fade, uv.y)
             * smoothstep(0.0, pxUv.y * fade, 1.0 - uv.y);

  // Reveal the raster from left to right in softly staggered horizontal bands.
  float revealBand = floor(uv.y * 5.0);
  float bandOffset = (hash21(vec2(revealBand, 17.0)) - 0.5) * 0.075;
  float revealEdge = reveal * 1.24 - 0.12 + bandOffset;
  float revealMask = 1.0 - smoothstep(revealEdge, revealEdge + 0.075, uv.x);

  gl_FragColor = vec4(cr.r, cg.g, cb.b, a) * mask * revealMask;
}
`;

let stopped = false;
let glitchOffTimer = 0;
let revealRaf = 0;
let revealHost = null;

function setReveal(value) {
  state.reveal = Math.min(1, Math.max(0, value));
  if (revealHost) {
    revealHost.style.setProperty(
      "--eye-record-reveal",
      state.reveal.toFixed(4),
    );
  }
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function tweenReveal(active) {
  const target = active ? 1 : 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.cancelAnimationFrame(revealRaf);
    setReveal(target);
    return;
  }
  const start = state.reveal;
  const duration = active ? 560 : 320;
  const startedAt = performance.now();
  window.cancelAnimationFrame(revealRaf);

  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    setReveal(start + (target - start) * easeInOutCubic(progress));
    if (progress < 1 && !stopped) {
      revealRaf = window.requestAnimationFrame(tick);
    }
  };

  revealRaf = window.requestAnimationFrame(tick);
}

// Fire a short glitch burst on demand (used both by the ambient scheduler and by
// every wordmark text swap during the long-press).
function flashGlitch(duration) {
  state.glitch = 1;
  window.clearTimeout(glitchOffTimer);
  glitchOffTimer = window.setTimeout(() => {
    state.glitch = 0;
  }, duration);
}

window.addEventListener("archive:eye-glitch", (event) => {
  if (stopped) return;
  const requestedDuration = Number(event.detail?.duration);
  const duration = Number.isFinite(requestedDuration)
    ? Math.min(600, Math.max(80, requestedDuration))
    : 240;
  flashGlitch(duration);
});

window.addEventListener("archive:eye-record-visibility", (event) => {
  if (stopped) return;
  tweenReveal(Boolean(event.detail?.active));
});

function scheduleBurst() {
  const wait = GAP_MIN + Math.random() * GAP_RANDOM;
  window.setTimeout(() => {
    if (stopped) return;
    flashGlitch(BURST_MIN + Math.random() * BURST_RANDOM);
    scheduleBurst();
  }, wait);
}

// The wordmark font, so VFX's foreignObject capture renders it. An SVG loaded as
// an <img> can't see the page's @font-face, so we inline the font as a data: URL
// inside a <style> that lives *inside* the captured element.
const FONT_URL = "/assets/fonts/Formula/PPFormula-CondensedBlack.otf";
const FONT_STYLE_MARK = "data-eye-glitch-font";
let fontCss = null;

function base64FromBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontCss() {
  if (fontCss) return fontCss;
  const buf = await fetch(FONT_URL).then((r) => r.arrayBuffer());
  const b64 = base64FromBuffer(buf);
  fontCss =
    `@font-face{font-family:"Formula";` +
    `src:url(data:font/otf;base64,${b64}) format("opentype");}`;
  return fontCss;
}

// Insert the font <style> as a child of the element if it's missing. Returns true
// when it had to (re)insert.
function ensureFontStyle(el) {
  if (!fontCss) return false;
  if (el.querySelector(`style[${FONT_STYLE_MARK}]`)) return false;
  const style = document.createElement("style");
  style.setAttribute(FONT_STYLE_MARK, "");
  style.textContent = fontCss;
  el.insertBefore(style, el.firstChild);
  return true;
}

// The wordmark text, ignoring the injected font <style> so we can tell when the
// *visible* copy actually changed (press phases / release) vs. a style reinsert.
function visibleText(el) {
  let out = "";
  el.childNodes.forEach((node) => {
    if (node.nodeName !== "STYLE") out += node.textContent || "";
  });
  return out;
}

async function init() {
  const el = document.getElementById("archiveHudRecord");
  if (!el) return;
  revealHost = document.getElementById("archiveAmbientHud");

  // Embed the font (and wait for the page fonts) before the first capture so the
  // wordmark keeps its Formula typeface.
  try {
    await loadFontCss();
    ensureFontStyle(el);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (e) {
    // Offline / fetch failed: fall back to VFX's default (system) font.
  }

  const vfx = new VFX({ zIndex: 3 });
  vfx.add(el, {
    shader: SHADER,
    overflow: 80,
    uniforms: {
      uGlitch: () => state.glitch,
      uReveal: () => state.reveal,
    },
  });
  document.documentElement.classList.add("has-eye-vfx");
  setReveal(revealHost?.dataset.eyeRecord === "active" ? 1 : state.reveal);

  // Re-capture at most once per frame, so a text swap during the long-press or on
  // release re-renders smoothly instead of stalling.
  let queued = false;
  const recapture = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      vfx.update(el).catch(() => {});
    });
  };

  // The VFX source is kept fully rendered by CSS, so one frame-aligned capture
  // is enough for each word swap. Delayed captures used to replace the texture
  // once more at the end of the reveal, producing a visible pause and width pop.
  const recaptureAfterReveal = () => {
    recapture();
  };

  // The font is already awaited above, so one capture is sufficient. Delayed
  // refreshes would be able to resize a wordmark while it is already visible.
  recapture();

  // archive.js swaps the wordmark via textContent (press phases / release), which
  // also wipes the injected <style>. Re-insert the font, and only re-capture when
  // the *visible* text actually changed (not for the style reinsert itself).
  let lastText = visibleText(el);
  const observer = new MutationObserver(() => {
    ensureFontStyle(el);
    const text = visibleText(el);
    if (text !== lastText) {
      lastText = text;
      recaptureAfterReveal();
      // Every wordmark swap (each long-press phase, and the release reset) fires
      // the box glitch so the change punches in with the chromatic block effect.
      flashGlitch(240);
    }
  });
  observer.observe(el, { childList: true, characterData: true, subtree: true });

  // Once the card stream opens (burst), the wordmark must disappear. Remove it
  // from VFX so its canvas stops drawing it; the DOM node is already hidden by
  // the `.strata` burst rule.
  window.addEventListener(
    "archive:hypercube-burst",
    () => {
      stopped = true;
      window.cancelAnimationFrame(revealRaf);
      observer.disconnect();
      try {
        vfx.remove(el);
      } catch (e) {
        // ignore
      }
    },
    { once: true }
  );

  scheduleBurst();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
