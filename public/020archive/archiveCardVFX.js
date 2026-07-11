import { VFX } from "/libs/vfx-js.min.js";

// Pixel-scan dissolve adapted from public/reference/reference.js.
// Instead of being driven by enter/leave time, the dissolve front is locked to
// a spatial boundary `progress` (the scanner position across the card, in card
// UV space). Card content stays intact to the RIGHT of the front, dissolves
// into colorful pixel cells at the front, and is gone (transparent) to the LEFT.
//
// The card front is an empty glass pane (no text), so only the dissolving
// pixel cells are rendered here, on a canvas above the glass layer (z 8 vs
// z 2, see archive.css) to keep the dissolve crisp on top of the refraction.
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

const MAX_LIQUID_CARDS = 16;
const liquidRects = new Float32Array(MAX_LIQUID_CARDS * 4);
const liquidOpacity = new Float32Array(MAX_LIQUID_CARDS);
const liquidSeeds = new Float32Array(MAX_LIQUID_CARDS);
const liquidClipLeft = new Float32Array(MAX_LIQUID_CARDS);
const liquidHover = new Float32Array(MAX_LIQUID_CARDS);
let liquidCardCount = 0;
let liquidProvider = null;
let liquidSource = null;
let liquidCompositeCanvas = null;
let liquidCompositeContext = null;
const liquidBackgroundSources = [];
let liquidRefreshFrame = 0;
let liquidLastRefresh = 0;

const BUBBLE_PARAMS = {
  count: 8,
  sphereR: 0.34,
  radiusMin: 0.35,
  radiusMax: 0.64,
  speed: 0.7,
  smooth: 0.12,
};
const bubbleData = new Float32Array(BUBBLE_PARAMS.count * 4);
const bubbleStartTime = performance.now() / 1000;

const shaderLiquidGlass = `
precision highp float;
uniform sampler2D src;
uniform vec2 resolution;
uniform vec2 offset;
uniform float time;
uniform int cardCount;
uniform vec4 liquidRects[${MAX_LIQUID_CARDS}];
uniform float liquidOpacity[${MAX_LIQUID_CARDS}];
uniform float liquidSeeds[${MAX_LIQUID_CARDS}];
uniform float liquidClipLeft[${MAX_LIQUID_CARDS}];
uniform float liquidHover[${MAX_LIQUID_CARDS}];
uniform float bubbleData[${BUBBLE_PARAMS.count * 4}];

const float DISP = 0.03;
const int DISP_STEPS = 12;
const float DISP_LO = 0.0;
const float DISP_HI = 1.0;
const float SCATTER = 0.03;
// Scaled down from reference (*3.0) because our blob is ~5x larger, so the
// accumulated thickness is ~5x; this keeps the same perceived tint/darkness.
const vec3 ABSORB = vec3(2.0, 1.2, 1.0) * 0.6;
const float SPHERE_R = 0.62;
const float PLANE_HALF = 0.72;
const int N_BUBBLES = ${BUBBLE_PARAMS.count};
const float BUBBLE_SMOOTH = ${BUBBLE_PARAMS.smooth.toFixed(4)};

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}

float hash11(float p) {
  return fract(sin(p * 127.1 + 311.7) * 43758.5453123);
}

vec3 spectrum(float x) {
  return clamp(vec3(
    1.5 - abs(4.0 * x - 1.0),
    1.5 - abs(4.0 * x - 2.0),
    1.5 - abs(4.0 * x - 3.0)
  ), 0.0, 1.0);
}

float roundedRectMask(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float aa = max(fwidth(d) * 1.5, 1.0);
  return 1.0 - smoothstep(-aa, aa, d);
}

vec4 getSrc(vec2 uv) {
  vec4 c = texture2D(src, clamp(uv, vec2(0.001), vec2(0.999)));
  return mix(vec4(1.0), c, c.a);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Card-shaped blob half-extents / corner radius, set per fragment in main()
// from the resolved card's aspect ratio.
vec3 gBoxHalf;
float gRound;

// Liquid-glass blob for one card: a rounded box matching the card shape/size.
// Small bubbles are intentionally NOT merged into this SDF. When they are real
// SDF surfaces, raymarching treats their rims as geometry and Fresnel/specular
// creates intermittent white outlines and clipping artifacts.
float mapBlob(vec3 p) {
  vec3 sp = p;
  sp.y += sin(sp.z * 6.0 + time * 2.0) * 0.02;
  sp.z += sin(sp.x * 5.0 + time * 1.7) * 0.02;
  return sdRoundBox(sp, gBoxHalf, gRound);
}

vec3 calcBlobNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    mapBlob(p + e.xyy) - mapBlob(p - e.xyy),
    mapBlob(p + e.yxy) - mapBlob(p - e.yxy),
    mapBlob(p + e.yyx) - mapBlob(p - e.yyx)
  ));
}

vec3 bubbleLens(vec3 p) {
  vec3 lens = vec3(0.0);
  for (int i = 0; i < N_BUBBLES; i++) {
    int b = i * 4;
    vec3 bPos = vec3(bubbleData[b], bubbleData[b + 1], bubbleData[b + 2]);
    float r = max(bubbleData[b + 3], 0.001);
    vec3 delta = p - bPos;
    float d = length(delta);
    // Very soft volumetric field: strong enough to bend/refocus the background,
    // but with no hard rim that can turn into a white outline.
    float field = pow(1.0 - smoothstep(0.0, r * 2.2, d), 2.0);
    lens += normalize(delta + vec3(0.0001)) * field;
  }

  return lens;
}

float bubbleDensity(vec3 p) {
  float density = 0.0;
  for (int i = 0; i < N_BUBBLES; i++) {
    int b = i * 4;
    vec3 bPos = vec3(bubbleData[b], bubbleData[b + 1], bubbleData[b + 2]);
    float r = max(bubbleData[b + 3], 0.001);
    float d = length(p - bPos);
    density += pow(1.0 - smoothstep(0.0, r * 1.8, d), 2.0);
  }

  return clamp(density, 0.0, 1.0);
}

bool resolveCard(vec2 frag, out vec4 rect, out vec2 local, out float opacity, out float seed, out float clipLeft, out float hover) {
  for (int i = 0; i < ${MAX_LIQUID_CARDS}; i++) {
    if (i >= cardCount) break;
    vec4 r = liquidRects[i];
    vec2 q = frag - r.xy;
    if (q.x >= 0.0 && q.y >= 0.0 && q.x <= r.z && q.y <= r.w) {
      rect = r;
      local = q / max(r.zw, vec2(1.0));
      opacity = liquidOpacity[i];
      seed = liquidSeeds[i];
      clipLeft = liquidClipLeft[i];
      hover = liquidHover[i];
      return true;
    }
  }

  return false;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec4 rect = vec4(0.0);
  vec2 local = vec2(0.0);
  float paneOpacity = 0.0;
  float cardSeed = 0.0;
  float glassClipLeft = 0.0;
  float cardHover = 0.0;

  if (!resolveCard(frag, rect, local, paneOpacity, cardSeed, glassClipLeft, cardHover)) {
    gl_FragColor = vec4(0.0);
    return;
  }
  if (paneOpacity <= 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }
  if (local.x * rect.z < glassClipLeft) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 uv = (frag - offset) / resolution;

  // Card-local plane coords with equal pixel scale on both axes so the blob
  // stays circular regardless of the card aspect ratio. The blob is centred
  // on the card and sized to the card's short dimension.
  vec2 centeredPx = local * rect.zw - rect.zw * 0.5;
  float minDim = min(rect.z, rect.w);
  vec2 p = (centeredPx / (0.5 * minDim)) * PLANE_HALF;
  float cornerPx = minDim * 0.045;
  float cardMask = roundedRectMask(centeredPx, rect.zw * 0.5, cornerPx);
  if (cardMask <= 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float rDisp = hash11(cardSeed + 1.0);
  float rScatter = hash11(cardSeed + 2.0);
  float rAbsorb = hash11(cardSeed + 3.0);
  float rShape = hash11(cardSeed + 4.0);
  float rFlow = hash11(cardSeed + 5.0);
  float rSpec = hash11(cardSeed + 6.0);

  // Rounded box matching the card's aspect ratio, sized to fill most of the
  // card with a small margin. A moderate z-thickness gives it glass depth.
  // The 3D rounding is deliberately large (limited by the z half-thickness):
  // it curves the flat front face into the side walls over a wide band, so the
  // raymarch naturally produces tipped-over normals near the rim -> real edge
  // refraction and grazing absorption, like the bubble silhouette.
  float fill = 0.9;
  gBoxHalf = vec3(rect.z / minDim, rect.w / minDim, 0.55) * PLANE_HALF * fill;
  gRound = gBoxHalf.z * 0.35;

  vec3 ro = vec3(0.0, 0.0, -2.0);
  float focal = 2.0;
  vec3 rd = normalize(vec3(p, focal));

  vec3 firstN = vec3(0.0);
  vec3 lastN = vec3(0.0);
  int hitCount = 0;
  float thickness = 0.0;
  float tEntry = 0.0;
  float t = 0.0;
  bool inside = false;
  for (int i = 0; i < 50; i++) {
    if (t > 10.0) break;

    vec3 pos = ro + rd * t;
    float d = mapBlob(pos);
    float stepd = inside ? -d : d;
    if (stepd < 3e-4) {
      vec3 n = calcBlobNormal(pos);
      if (hitCount == 0) firstN = n;
      lastN = n;
      if (!inside) {
        tEntry = t;
      } else {
        thickness += t - tEntry;
      }

      hitCount++;
      if (hitCount >= 4) break;

      inside = !inside;
      t += 0.01;
    } else {
      t += stepd;
    }
  }

  if (hitCount == 0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Drift the soft internal lens field around the card so the subtle "pull"
  // region flows instead of staying pinned to the centre.
  vec2 flowCenter = vec2(
    sin(time * mix(0.17, 0.27, rFlow) + cardSeed * 6.2831) * 0.55 +
      sin(time * mix(0.09, 0.16, rShape) + 1.7 + cardSeed * 3.1) * 0.25,
    cos(time * mix(0.13, 0.22, rScatter) + 0.6 + cardSeed * 5.2) * 0.50 +
      sin(time * mix(0.08, 0.14, rAbsorb) + 2.4 + cardSeed * 4.4) * 0.22
  ) * gBoxHalf.xy * mix(0.34, 0.48, rFlow);
  vec3 innerP = vec3(p - flowCenter, 0.0);
  vec3 bubbleWarp = bubbleLens(innerP);
  float bubbleSoft = bubbleDensity(innerP);
  vec2 boxUv = abs(p) / max(gBoxHalf.xy, vec2(0.001));
  float edgePos = max(boxUv.x, boxUv.y);
  float edgeRamp = smoothstep(0.12, 1.02, edgePos);
  edgeRamp = edgeRamp * edgeRamp * (3.0 - 2.0 * edgeRamp);
  // Shared rim field: one wide, smooth ramp. All edge layers derive from
  // powers of this single curve so they stay concentrated near the rim but
  // never introduce their own onset step.
  float rimField = smoothstep(0.4, 1.0, edgePos);
  rimField = rimField * rimField * (3.0 - 2.0 * rimField);
  float edgeFrost = rimField * rimField * rimField;
  float edgeWarp = mix(edgeRamp, edgeFrost, 0.45);
  float verticalEdge = pow(smoothstep(0.45, 0.96, boxUv.y), 1.25);
  vec2 edgeDir = normalize(p / max(gBoxHalf.xy, vec2(0.001)) + vec2(0.0001));
  vec2 edgeTangent = vec2(-edgeDir.y, edgeDir.x);
  float edgeFlow =
    sin(dot(p, vec2(7.1, 3.9)) + time * mix(0.55, 0.85, rFlow) + cardSeed * 9.0) * 0.55 +
    sin(dot(p, vec2(-4.2, 8.4)) - time * mix(0.35, 0.7, rScatter) + cardSeed * 5.0) * 0.45;
  float verticalToHorizontal = edgeDir.y * verticalEdge;
  vec2 edgeDirHorizontalized = vec2(
    edgeDir.x + verticalToHorizontal * 0.7,
    edgeDir.y * (1.0 - verticalEdge * 0.96)
  );
  vec2 edgeTangentHorizontalized = vec2(
    edgeTangent.x,
    edgeTangent.y * (1.0 - verticalEdge * 0.9)
  );
  vec2 edgeWarpVec = (edgeDirHorizontalized * 0.25 + edgeTangentHorizontalized * edgeFlow * 0.45) * edgeWarp;
  float dispAmount = DISP * mix(0.82, 1.22, rDisp);
  float scatterAmount = SCATTER * mix(0.72, 1.32, rScatter);
  vec3 absorbAmount = ABSORB * mix(
    vec3(0.9, 0.95, 1.03),
    vec3(1.16, 1.08, 0.92),
    rAbsorb
  );
  float bubbleWarpStrength = mix(0.0016, mix(0.0062, 0.0092, rFlow), edgeRamp);
  vec2 shapeDisp = -(firstN.xy + lastN.xy) * 0.5 * dispAmount;
  shapeDisp.x += shapeDisp.y * verticalEdge * 0.75;
  shapeDisp.y *= 1.0 - verticalEdge * 0.96;
  vec2 bubbleWarp2d = vec2(
    bubbleWarp.x + bubbleWarp.y * verticalEdge * 0.85,
    bubbleWarp.y * (1.0 - verticalEdge * 0.96)
  );
  // Bubble-silhouette rim, ported from the reference spheres: near a bubble's
  // outline the surface normal tips sideways, so baseDisp becomes a large
  // radially-inward sample offset and the refracted background visibly
  // disconnects from the background outside the glass. Our card's front face
  // is flat (normal towards camera), so we recreate that steep normal tip-over
  // in a narrow band along the card edge: a strong inward displacement that
  // ramps up sharply toward the rim, plus grazing absorption (below).
  // Halved strengths: the enlarged 3D bevel (gRound) now supplies most of the
  // natural edge refraction, this band only reinforces it.
  float rimBand = rimField * rimField;
  vec2 rimDisp = -edgeDir * rimBand * mix(0.020, 0.030, rDisp);
  vec2 baseDisp = shapeDisp +
    bubbleWarp2d * bubbleWarpStrength +
    edgeWarpVec * mix(0.0018, 0.0036, rDisp) +
    rimDisp;
  // Grazing-angle wall: extra glass thickness at the rim so absorption tints
  // and darkens the edge band, like the bubble's silhouette in the reference.
  thickness += rimBand * 0.55;
  float NdotR = max(dot(firstN, -rd), 0.0);
  float bubbleScatter = bubbleSoft * scatterAmount * mix(0.015, mix(0.07, 0.12, rScatter), edgeRamp);
  float edgeScatter = edgeFrost * scatterAmount * mix(0.035, 0.095, rScatter);
  float rimScatter = edgeFrost * edgeFrost * scatterAmount * 0.35;
  float scatter = pow(1.0 - NdotR, 6.0) * scatterAmount + bubbleScatter + edgeScatter + rimScatter;

  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < DISP_STEPS; i++) {
    float wl = float(i) / float(DISP_STEPS - 1);
    float k = mix(DISP_LO, DISP_HI, wl) * (1.3 + float(hitCount) * 0.2);
    vec2 h = hash22(uv * 1000.0 + float(i) * 7.13 + time + cardSeed * 23.0) * scatter;
    vec3 w = spectrum(wl);
    acc += getSrc(uv + baseDisp * k + h).rgb * w;
    wsum += w;
  }
  vec3 col = acc / wsum * 0.99;
  col -= float(hitCount) * 0.05;
  col += 0.1;

  float fres = pow(1.0 - NdotR, 5.0);
  col *= 1.0 + fres * 0.35;

  // Treat the rim band as grazing incidence (like the bubble silhouette),
  // otherwise the flat front face keeps f2 near zero and the rim absorption
  // would never show.
  float f2 = 1.0 - pow(NdotR, 3.0);
  f2 = max(f2, rimBand * 0.8);
  col *= mix(vec3(1.0), exp(-absorbAmount * thickness), f2);
  col *= 1.0 + f2 * 0.3;

  // Specular highlights are plain white by default. On hover the hovered card's
  // highlights take on a neon palette: electric cyan, hot magenta, acid yellow,
  // plus a hover-only signal orange lobe.
  vec3 acidYellow = vec3(0.792, 1.0, 0.0);
  vec3 electricCyan = vec3(0.0, 0.902, 1.0);
  vec3 hotMagenta = vec3(1.0, 0.0, 0.6);
  vec3 signalOrange = vec3(1.0, 0.349, 0.0);

  vec3 ld = normalize(vec3(0.5, 0.9, -0.3));
  float spec = pow(max(dot(reflect(-ld, firstN), -rd), 0.0), 200.0);
  col += spec * mix(22.0, 38.0, rSpec) * mix(vec3(1.0), electricCyan, cardHover);

  ld = normalize(vec3(-0.9, 0.4, -0.3));
  spec = pow(max(dot(reflect(-ld, firstN), -rd), 0.0), 300.0);
  col += spec * mix(2.0, 4.5, hash11(cardSeed + 6.7)) * mix(vec3(1.0), hotMagenta, cardHover);

  ld = normalize(vec3(-0.1, -0.9, -0.1));
  spec = pow(max(dot(reflect(-ld, firstN), -rd), 0.0), 30.0);
  col += spec * mix(0.35, 0.8, hash11(cardSeed + 7.3)) * mix(vec3(1.0), acidYellow, cardHover);

  ld = normalize(vec3(0.85, -0.3, -0.4));
  spec = pow(max(dot(reflect(-ld, firstN), -rd), 0.0), 120.0);
  col += spec * mix(6.0, 10.0, hash11(cardSeed + 8.1)) * signalOrange * cardHover;

  col = min(col, 1.0);
  col = 1.0 - abs(col + fres * 0.12 - 1.0);

  gl_FragColor = vec4(col, paneOpacity * cardMask);
}
`;

let vfxCells = null;
function getVFXCells() {
  if (!vfxCells) {
    vfxCells = new VFX({ zIndex: 80 });
  }
  return vfxCells;
}

let vfxLiquid = null;
function getVFXLiquid() {
  if (!vfxLiquid) {
    vfxLiquid = new VFX({ zIndex: 20 });
  }
  return vfxLiquid;
}

function updateLiquidCards() {
  liquidRects.fill(0);
  liquidOpacity.fill(0);
  liquidSeeds.fill(0);
  liquidClipLeft.fill(0);
  liquidHover.fill(0);
  liquidCardCount = 0;

  if (!liquidProvider) {
    return liquidRects;
  }

  const cards = liquidProvider() || [];
  liquidCardCount = Math.min(cards.length, MAX_LIQUID_CARDS);
  for (let i = 0; i < liquidCardCount; i++) {
    const card = cards[i];
    const rectIndex = i * 4;
    liquidRects[rectIndex] = card.left;
    liquidRects[rectIndex + 1] = card.bottom;
    liquidRects[rectIndex + 2] = card.width;
    liquidRects[rectIndex + 3] = card.height;
    liquidOpacity[i] = card.opacity;
    liquidSeeds[i] = typeof card.seed === "number" ? card.seed : 0;
    liquidClipLeft[i] = typeof card.clipLeft === "number" ? card.clipLeft : 0;
    liquidHover[i] = typeof card.hover === "number" ? card.hover : 0;
  }

  return liquidRects;
}

function fract(value) {
  return value - Math.floor(value);
}

function rot2d(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return [x * c - y * s, x * s + y * c];
}

function updateBubbleData() {
  const time = performance.now() / 1000 - bubbleStartTime;
  const { count, sphereR, radiusMin, radiusMax, speed } = BUBBLE_PARAMS;
  const range = radiusMax - radiusMin;

  for (let i = 0; i < count; i++) {
    // Continuous (non-looping) motion so bubbles only drift, never pop or
    // resize. Radius is fixed per bubble.
    const phase = i * 1.256;
    const orbitAngle = time * (0.8 + fract(i * 0.618) * 0.7) * speed + phase;
    const orbitR = sphereR * (0.55 + 0.35 * Math.sin(time * (0.5 + fract(i * 0.37) * 0.4) + phase));
    let bx = Math.cos(orbitAngle) * orbitR;
    let by = 0;
    let bz = Math.sin(orbitAngle) * orbitR;

    [bx, by] = rot2d(bx, by, i * 2.3);
    [by, bz] = rot2d(by, bz, i * 1.8);

    by += 0.16 * Math.sin(time * (0.6 + fract(i * 0.27) * 0.5) + phase * 1.7);
    bx += Math.sin(time * 2.7 + i * 4.1) * 0.02;
    bz += Math.cos(time * 3.1 + i * 3.7) * 0.02;

    const r = radiusMin + range * fract(i * 0.618);
    const j = i * 4;
    bubbleData[j] = bx;
    bubbleData[j + 1] = by;
    bubbleData[j + 2] = bz;
    bubbleData[j + 3] = r;
  }

  return bubbleData;
}

function ensureLiquidCompositeCanvas() {
  if (liquidCompositeCanvas) return liquidCompositeCanvas;

  liquidCompositeCanvas = document.createElement("canvas");
  liquidCompositeCanvas.setAttribute("aria-hidden", "true");
  liquidCompositeCanvas.style.position = "fixed";
  liquidCompositeCanvas.style.inset = "0";
  liquidCompositeCanvas.style.width = "100vw";
  liquidCompositeCanvas.style.height = "100vh";
  liquidCompositeCanvas.style.opacity = "0";
  liquidCompositeCanvas.style.pointerEvents = "none";
  liquidCompositeCanvas.style.zIndex = "-1";
  document.body.appendChild(liquidCompositeCanvas);
  liquidCompositeContext = liquidCompositeCanvas.getContext("2d");

  return liquidCompositeCanvas;
}

function resizeLiquidComposite() {
  const canvas = ensureLiquidCompositeCanvas();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(Math.ceil(window.innerWidth * pixelRatio), 1);
  const height = Math.max(Math.ceil(window.innerHeight * pixelRatio), 1);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return pixelRatio;
}

function drawLiquidBackground() {
  const pixelRatio = resizeLiquidComposite();
  const ctx = liquidCompositeContext;
  if (!ctx) return;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const orderedSources = liquidBackgroundSources.slice().sort((a, b) => {
    const az = Number.parseInt(window.getComputedStyle(a).zIndex, 10);
    const bz = Number.parseInt(window.getComputedStyle(b).zIndex, 10);
    return (Number.isFinite(az) ? az : 0) - (Number.isFinite(bz) ? bz : 0);
  });

  orderedSources.forEach((source) => {
    if (!source || source.width <= 0 || source.height <= 0) return;

    const rect = source.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) return;

    const style = window.getComputedStyle(source);
    const opacity = Number.parseFloat(style.opacity || "1");
    if (opacity <= 0.001 || style.visibility === "hidden" || style.display === "none") return;

    ctx.save();
    ctx.globalAlpha = Math.min(Math.max(opacity, 0), 1);
    ctx.drawImage(source, rect.left, rect.top, rect.width, rect.height);
    ctx.restore();
  });
}

function refreshLiquidSource(now = performance.now()) {
  if (!liquidSource || !vfxLiquid) return;

  drawLiquidBackground();
  if (now - liquidLastRefresh > 16) {
    getVFXLiquid().update(liquidSource);
    liquidLastRefresh = now;
  }

  liquidRefreshFrame = requestAnimationFrame(refreshLiquidSource);
}

function bindLiquidSource() {
  const sourceCanvas = ensureLiquidCompositeCanvas();
  if (sourceCanvas === liquidSource) return;

  if (liquidSource && vfxLiquid) {
    getVFXLiquid().remove(liquidSource);
  }

  liquidSource = sourceCanvas;
  getVFXLiquid().add(sourceCanvas, {
    shader: shaderLiquidGlass,
    overlay: true,
    overflow: true,
    uniforms: {
      liquidRects: () => updateLiquidCards(),
      liquidOpacity: () => liquidOpacity,
      liquidSeeds: () => liquidSeeds,
      liquidClipLeft: () => liquidClipLeft,
      liquidHover: () => liquidHover,
      cardCount: () => liquidCardCount,
      bubbleData: () => updateBubbleData(),
    },
  });

  if (!liquidRefreshFrame) {
    liquidRefreshFrame = requestAnimationFrame(refreshLiquidSource);
  }
}

window.ArchiveCardVFX = {
  // Bind a `.archive-card-normal` element to the pixel-scan dissolve.
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

  setLiquidCardProvider(provider) {
    liquidProvider = provider;
  },

  attachLiquidSource(sourceCanvas) {
    this.addLiquidBackgroundSource(sourceCanvas);
    bindLiquidSource();
  },

  addLiquidBackgroundSource(sourceCanvas) {
    if (!sourceCanvas || liquidBackgroundSources.includes(sourceCanvas)) return;
    liquidBackgroundSources.push(sourceCanvas);
    bindLiquidSource();
  },

  removeLiquidBackgroundSource(sourceCanvas) {
    const index = liquidBackgroundSources.indexOf(sourceCanvas);
    if (index !== -1) {
      liquidBackgroundSources.splice(index, 1);
    }
  },
};
