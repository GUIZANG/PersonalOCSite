import { VFX } from "/libs/vfx-js.min.js";

// Pixel-scan dissolve adapted from public/reference/reference.js.
// Instead of being driven by enter/leave time, the dissolve front is locked to
// a spatial boundary `progress` (the scanner position across the card, in card
// UV space). Card content stays intact to the RIGHT of the front, dissolves
// into colorful pixel cells at the front, and is gone (transparent) to the LEFT.
//
// The card front is an empty glass pane (no text), so only the dissolving
// pixel cells are rendered here, on a canvas above the glass layer (z 8 vs
// z 2, see Main.css) to keep the dissolve crisp on top of the refraction.
const shaderLib = `
precision highp float;
uniform sampler2D src;
uniform vec2 resolution;
uniform vec2 offset;
uniform float time;
uniform float enterTime;
uniform float leaveTime;

uniform float progress;
uniform float reveal;
uniform float width;
uniform float layers;
uniform float seed;

#define W width
// Vertical overflow so the effect slightly covers the card top/bottom edges.
#define VMARGIN 0.03
// Horizontal overflow so the dissolve cells can spill outside card edges.
#define HMARGIN 0.22

vec4 readTex(vec2 uv) {
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) {
    return vec4(0);
  }
  return texture2D(src, uv);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(4859., 3985.))) * 3984.);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float sdBox(vec2 p, float r) {
  vec2 q = abs(p) - r;
  return min(length(q), max(q.y, q.x));
}

// Normalized x position [0,1] across the card for a cell index.
float cellX(vec2 pi, float scale) {
  return pi.x / (scale * 2.) + .5;
}

vec4 cell(vec2 p, vec2 pi, float scale, float t, float edge) {
  vec2 pc = pi + .5;
  vec2 s = vec2(seed * 17.13, seed * 41.71);

  vec2 uvc = pc / scale;
  uvc.y /= resolution.y / resolution.x;
  uvc = uvc * 0.5 + 0.5;
  if (uvc.x < -HMARGIN || uvc.x > 1. + HMARGIN || uvc.y < -VMARGIN || uvc.y > 1. + VMARGIN) {
    return vec4(0);
  }
  // Keep vertical coverage fixed for the whole lifecycle.
  // Avoid sampling source alpha (rounded corners/clip states) so top/bottom
  // bounds do not fluctuate over time.
  float alphaTop = smoothstep(-VMARGIN, 0.0, uvc.y);
  float alphaBottom = 1.0 - smoothstep(1.0, 1.0 + VMARGIN, uvc.y);
  float alpha = alphaTop * alphaBottom;

  // Monochrome cells: per-cell gray (black / white / gray).
  float g = 0.35 + 0.65 * hash(pi + s + 7.);
  vec4 color = vec4(vec3(g), 1.);

  float x = cellX(pi, scale);
  // Straight left edge at the scanner (t); ragged right edge via per-cell reach.
  float reach = W * (0.6 + 1.8 * hash(pi + s + 3.0));
  float anim = smoothstep(reach, 0.0, x - t);

  // Random tiny blocks around BOTH card side bands (left/right), so edges feel
  // more fragmented instead of only following the scan front.
  float sideBand = max(
    1.0 - smoothstep(0.0, 0.12, x),
    smoothstep(0.88, 1.0, x)
  );
  float live = smoothstep(-0.03, 0.09, t) * (1.0 - smoothstep(1.02, 1.18, t));
  float sideSeed = hash(pi + s + vec2(floor(t * 48.0), 31.7));
  float smallOnly = smoothstep(11.0, 15.0, scale);
  float detachFront = smoothstep(0.10, 0.26, abs(x - t));
  float detachMain = 1.0 - smoothstep(0.05, 0.22, anim);
  float sideScatter = sideBand
    * smoothstep(0.90, 0.995, sideSeed)
    * live
    * smallOnly
    * detachFront
    * detachMain;

  color *= max(anim, sideScatter * 0.42);

  // Start reducing cell count slightly BEFORE the scanner reaches the right
  // edge (t ~= 1.0), then continue fading after crossing for a natural tail.
  float survive = 1.0 - smoothstep(0.86, 1.12, t);
  float keepSeed = hash(pi + s + vec2(17.3, 91.7));
  float keep = smoothstep(keepSeed - 0.12, keepSeed + 0.12, survive);
  color *= keep;

  color *= mix(
    1.,
    clamp(.3 / abs(sdBox(p - pc, .5)), 0., 10.),
    edge * pow(anim, 10.)
  );

  return color * alpha;
}

vec4 cellsColor(vec2 p, float scale, float t) {
  vec2 pi = floor(p);
  vec2 d = vec2(0, 1);
  vec2 s = vec2(seed * 17.13, seed * 41.71);

  vec4 cc = vec4(0);
  cc += cell(p, pi, scale, t, .2) * mix(4., 7., hash(pi + s + vec2(11.3, 2.1)));
  cc += cell(p, pi + d.xy, scale, t, .9) * mix(.4, 1., hash(pi + s + vec2(23.7, 5.9)));
  cc += cell(p, pi - d.xy, scale, t, .9) * mix(.3, .8, hash(pi + s + vec2(31.1, 7.4)));
  cc += cell(p, pi + d.yx, scale, t, .9) * mix(.2, .6, hash(pi + s + vec2(43.6, 13.2)));
  cc += cell(p, pi - d.yx, scale, t, .9) * mix(.1, .4, hash(pi + s + vec2(59.8, 17.5)));

  return cc / 8.;
}

`;

// Cells pass: only the dissolving pixel cells at the front.
const shaderCells = shaderLib + `
void main() {
  vec2 uv = (gl_FragCoord.xy - offset) / resolution;
  vec2 p = uv * 2. - 1.;
  p.y *= resolution.y / resolution.x;

  float t = progress;
  float act = smoothstep(-0.03, 0.09, t);

  vec4 col = vec4(0);
  for (float i = 0.; i < 10.; i++) {
    if (i >= layers) break;
    float scale = abs(cos(i) * 7.3 + 10.);
    col += cellsColor(p * scale, scale, t) * 1.2 * act;
  }
  col /= layers;

  col *= step(progress, uv.x);
  col *= clamp(reveal, 0., 1.);

  gl_FragColor = col;
}
`;

let vfxCells = null;
function getVFXCells() {
  if (!vfxCells) {
    vfxCells = new VFX({ zIndex: 80 });
  }
  return vfxCells;
}

window.MainCardVFX = {
  // Bind a `.main-card-normal` element to the pixel-scan dissolve.
  // getProgress(): scanner position across the card in UV space (can be <0 / >1).
  // getReveal():   stream activation fade amount [0,1].
  bind(element, getProgress, getReveal, getSeed) {
    getVFXCells().add(element, {
      shader: shaderCells,
      // Extra right overflow prevents clipping when the front reaches card edge.
      overflow: [40, 72, 40, 32],
      uniforms: {
        progress: () => getProgress(),
        reveal: () => getReveal(),
        width: 0.12,
        layers: 2,
        seed: () => getSeed(),
      },
    });
  },
};
