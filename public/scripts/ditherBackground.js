// Native Three.js port of the React Bits "Dither" background.
// Original (React + @react-three/fiber + postprocessing):
//   https://reactbits.dev/backgrounds/dither
//
// Two-pass pipeline, no external deps beyond the globally loaded three.min.js:
//   1. Wave pass  -> Perlin/fbm flow field (black -> waveColor) rendered to a
//      render target, with an optional mouse "dent".
//   2. Dither pass -> pixelates the wave buffer and quantizes it to `colorNum`
//      levels using an 8x8 ordered (Bayer) dither matrix, then draws to screen.
//
// Uses the global `THREE` (same convention as horizonScene.js), so the host
// page must include /libs/three.min.js before importing this module.

const fullscreenVertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const waveFragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }
  vec3 col = mix(vec3(0.0), waveColor, f);
  gl_FragColor = vec4(col, 1.0);
}
`;

// GLSL1-compatible dither pass. The React Bits original indexes a const
// float[64] Bayer matrix (GLSL3 only); here we use the equivalent recursive
// Bayer function so it compiles on any three.js / WebGL target. Same 8x8
// ordered dithering, visually identical.
const ditherFragmentShader = `
precision highp float;
uniform sampler2D inputBuffer;
uniform vec2 resolution;
uniform float colorNum;
uniform float pixelSize;
varying vec2 vUv;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
#define Bayer4(a) (Bayer2(0.5 * (a)) * 0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(0.5 * (a)) * 0.25 + Bayer2(a))

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  float threshold = Bayer8(scaledCoord) - 0.25;
  float stepv = 1.0 / (colorNum - 1.0);
  color += threshold * stepv;
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color = texture2D(inputBuffer, uvPixel);
  color.rgb = dither(uv, color.rgb);
  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

const DEFAULTS = {
  waveSpeed: 0.05,
  waveFrequency: 3,
  waveAmplitude: 0.3,
  waveColor: [0.5, 0.5, 0.5],
  colorNum: 4,
  pixelSize: 2,
  disableAnimation: false,
  enableMouseInteraction: true,
  mouseRadius: 1,
};

export function createDitherBackground(options = {}) {
  const container = options.container || document.body;
  const opts = Object.assign({}, DEFAULTS, options);
  const pixelRatio =
    options.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(pixelRatio);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  const bufferSize = new THREE.Vector2(1, 1);
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });

  const waveUniforms = {
    time: { value: 0 },
    resolution: { value: bufferSize },
    waveSpeed: { value: opts.waveSpeed },
    waveFrequency: { value: opts.waveFrequency },
    waveAmplitude: { value: opts.waveAmplitude },
    waveColor: { value: new THREE.Color(...opts.waveColor) },
    mousePos: { value: new THREE.Vector2(0, 0) },
    enableMouseInteraction: { value: opts.enableMouseInteraction ? 1 : 0 },
    mouseRadius: { value: opts.mouseRadius },
  };

  const ditherUniforms = {
    inputBuffer: { value: renderTarget.texture },
    resolution: { value: bufferSize },
    colorNum: { value: opts.colorNum },
    pixelSize: { value: opts.pixelSize },
  };

  const waveScene = new THREE.Scene();
  waveScene.add(
    new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: fullscreenVertexShader,
        fragmentShader: waveFragmentShader,
        uniforms: waveUniforms,
        depthTest: false,
        depthWrite: false,
      })
    )
  );

  const ditherScene = new THREE.Scene();
  ditherScene.add(
    new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: fullscreenVertexShader,
        fragmentShader: ditherFragmentShader,
        uniforms: ditherUniforms,
        depthTest: false,
        depthWrite: false,
      })
    )
  );

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const bw = Math.max(1, Math.floor(w * pixelRatio));
    const bh = Math.max(1, Math.floor(h * pixelRatio));
    renderTarget.setSize(bw, bh);
    bufferSize.set(bw, bh);
  }

  function onPointerMove(e) {
    if (!waveUniforms.enableMouseInteraction.value) return;
    const rect = canvas.getBoundingClientRect();
    waveUniforms.mousePos.value.set(
      (e.clientX - rect.left) * pixelRatio,
      (e.clientY - rect.top) * pixelRatio
    );
  }

  window.addEventListener("resize", resize);
  container.addEventListener("pointermove", onPointerMove);
  resize();

  const clock = { start: performance.now() };
  let running = false;
  let frameId = null;

  function animate() {
    if (!opts.disableAnimation) {
      waveUniforms.time.value = (performance.now() - clock.start) / 1000;
    }
    renderer.setRenderTarget(renderTarget);
    renderer.render(waveScene, camera);
    renderer.setRenderTarget(null);
    renderer.render(ditherScene, camera);
    frameId = running ? requestAnimationFrame(animate) : null;
  }

  function start() {
    if (running) return;
    running = true;
    if (!frameId) frameId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function setOptions(next = {}) {
    if (next.waveSpeed !== undefined) waveUniforms.waveSpeed.value = next.waveSpeed;
    if (next.waveFrequency !== undefined) waveUniforms.waveFrequency.value = next.waveFrequency;
    if (next.waveAmplitude !== undefined) waveUniforms.waveAmplitude.value = next.waveAmplitude;
    if (next.waveColor !== undefined) waveUniforms.waveColor.value.setRGB(...next.waveColor);
    if (next.mouseRadius !== undefined) waveUniforms.mouseRadius.value = next.mouseRadius;
    if (next.enableMouseInteraction !== undefined)
      waveUniforms.enableMouseInteraction.value = next.enableMouseInteraction ? 1 : 0;
    if (next.colorNum !== undefined) ditherUniforms.colorNum.value = next.colorNum;
    if (next.pixelSize !== undefined) ditherUniforms.pixelSize.value = next.pixelSize;
    if (next.disableAnimation !== undefined) opts.disableAnimation = next.disableAnimation;
  }

  function destroy() {
    stop();
    window.removeEventListener("resize", resize);
    container.removeEventListener("pointermove", onPointerMove);
    renderTarget.dispose();
    geometry.dispose();
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  start();

  return { start, stop, setOptions, destroy, renderer, canvas };
}
