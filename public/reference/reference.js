import * as THREE from "https://esm.sh/three";
import { Pane } from "https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js";
// ============ FIXED PRESETS ============
// Note: Presets only control scene settings, not visual effects (style)
const PRESETS = {
  Sunset: {
    sunPosX: 0.0,
    sunPosY: 0.05,
    sunSize: 2.1,
    sunIntensity: 4.0,
    horizonColor: "#ff2200",
    enableClouds: true,
    cloudDensity: 0.6,
    cloudColor: "#ffaa00",
    waveHeight: 0.22,
    speed: 0.35,
    sssBaseColor: "#000000",
    sssTipColor: "#ff3300",
    reflectionStrength: 1.4,
    reflectionWidth: 0.05,
    haloStrength: 0.5,
    haloRadius: 0.3,
    haloSize: 0.02,
    vignetteStrength: 0.5,
    enableGrid: false,
    flareIntensity: 1.0,
    flareGhosting: 1.0,
    flareStreak: 2.0,
    flareAngle: 140
  },
  Sunny: {
    sunPosX: 0.0,
    sunPosY: 0.6,
    sunSize: 1.0,
    sunIntensity: 6.0,
    horizonColor: "#00bbff",
    enableClouds: true,
    cloudDensity: 0.25,
    cloudColor: "#ffffff",
    waveHeight: 0.25,
    speed: 0.4,
    sssBaseColor: "#001a33",
    sssTipColor: "#0099ff",
    reflectionStrength: 3.0,
    reflectionWidth: 0.1,
    haloStrength: 0.2,
    haloRadius: 0.3,
    haloSize: 0.02,
    vignetteStrength: 0.2,
    enableGrid: false,
    flareIntensity: 0.8,
    flareGhosting: 0.5,
    flareStreak: 3.0,
    flareAngle: 140
  },
  Cloudy: {
    sunPosX: 0.0,
    sunPosY: 0.3,
    sunSize: 3.0,
    sunIntensity: 1.5,
    horizonColor: "#667788",
    enableClouds: true,
    cloudDensity: 1.5,
    cloudColor: "#556677",
    waveHeight: 0.45,
    speed: 0.5,
    sssBaseColor: "#111520",
    sssTipColor: "#4a5a6a",
    reflectionStrength: 0.8,
    reflectionWidth: 0.3,
    haloStrength: 0.1,
    haloRadius: 0.3,
    haloSize: 0.02,
    vignetteStrength: 0.4,
    enableGrid: false,
    flareIntensity: 0.2,
    flareGhosting: 0.3,
    flareStreak: 0.5,
    flareAngle: 140
  },
  Night: {
    sunPosX: 0.0,
    sunPosY: 0.3,
    sunSize: 0.9,
    sunIntensity: 3.0,
    horizonColor: "#0a0a15",
    enableClouds: true,
    cloudDensity: 0.3,
    cloudColor: "#101018",
    waveHeight: 0.2,
    speed: 0.2,
    sssBaseColor: "#000005",
    sssTipColor: "#8888aa",
    reflectionStrength: 2.5,
    reflectionWidth: 0.015,
    haloStrength: 1.5,
    haloRadius: 0.3,
    haloSize: 0.02,
    vignetteStrength: 0.65,
    enableGrid: false,
    flareIntensity: 1.5,
    flareGhosting: 0.8,
    flareStreak: 1.0,
    flareAngle: 140
  },
  Twilight: {
    sunPosX: 0.0,
    sunPosY: -0.05,
    sunSize: 2.5,
    sunIntensity: 2.0,
    horizonColor: "#1a0a20",
    enableClouds: true,
    cloudDensity: 0.4,
    cloudColor: "#2a1a30",
    waveHeight: 0.3,
    speed: 0.25,
    sssBaseColor: "#050008",
    sssTipColor: "#6644aa",
    reflectionStrength: 1.8,
    reflectionWidth: 0.08,
    haloStrength: 0.8,
    haloRadius: 0.4,
    haloSize: 0.025,
    vignetteStrength: 0.55,
    enableGrid: false,
    flareIntensity: 1.2,
    flareGhosting: 1.0,
    flareStreak: 1.5,
    flareAngle: 140
  },
  Dark: {
    sunPosX: 0.0,
    sunPosY: 0.15,
    sunSize: 0.5,
    sunIntensity: 4.8,
    horizonColor: "#4476ff",
    enableClouds: true,
    cloudDensity: 0.15,
    cloudColor: "#080810",
    waveHeight: 0.35,
    speed: 0.15,
    sssBaseColor: "#000002",
    sssTipColor: "#222233",
    reflectionStrength: 8.2,
    reflectionWidth: 0.5,
    haloStrength: 0.6,
    haloRadius: 0.54,
    haloSize: 0.1,
    vignetteStrength: 0.75,
    enableGrid: false,
    flareIntensity: 0.8,
    flareGhosting: 0.4,
    flareStreak: 0.5,
    flareAngle: 140
  }
};
// ============ PARAMS & STATE ============
const params = {
  activePreset: "Night",
  style: 2, // Retro Grid
  enableGrid: true,
  // Sun & Sky
  sunPosX: 0.0,
  sunPosY: 0.3,
  sunSize: 0.9,
  sunIntensity: 3.0,
  horizonColor: "#0a0a15",
  // Atmosphere
  enableClouds: true,
  cloudDensity: 0.3,
  cloudSpeed: 0.05,
  cloudColor: "#101018",
  horizonFade: 0.05,
  // Ocean
  waveHeight: 0.2,
  waveChoppiness: 2.5,
  speed: 0.2,
  sssBaseColor: "#000005",
  sssTipColor: "#8888aa",
  sssStrength: 4.0,
  // Reflections
  enableReflections: true,
  reflectionStrength: 2.5,
  reflectionWidth: 0.015,
  // Motion
  flySpeed: 0.5,
  // FX
  enableFX: true,
  dustStrength: 1.0,
  // Lens Flare Settings
  flareIntensity: 1.5,
  flareGhosting: 0.8,
  flareStreak: 1.0,
  flareAngle: 140, // Angle in degrees (0-360) for flare position on sun edge
  // Halo Settings
  haloStrength: 1.5,
  haloRadius: 0.3,
  haloSize: 0.02,
  // Grain Settings
  grainAmount: 0.0,
  grainScale: 50.0,
  vignetteStrength: 0.65
};
const mousePos = new THREE.Vector2(0, 0);
const paneContainer = document.getElementById("pane-container");
const pane = new Pane({
  title: "Ocean Controls",
  expanded: false, // Collapsed by default
  container: paneContainer
});
// Fix for color picker popup - Tweakpane appends popups to body
const popupObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.classList && node.classList.contains("tp-popv")) {
        // Move popup into pane container and fix positioning
        node.style.position = "fixed";
        node.style.right = "8px";
        node.style.left = "auto";
        node.style.width = "200px";
        node.style.transform = "none";
      }
    });
  });
});
popupObserver.observe(document.body, {
  childList: true
});
// 0. PRESETS
pane
  .addBinding(params, "activePreset", {
    options: {
      Sunset: "Sunset",
      Sunny: "Sunny",
      Cloudy: "Cloudy",
      Night: "Night",
      Twilight: "Twilight",
      Dark: "Dark"
    }
  })
  .on("change", (ev) => {
    const p = PRESETS[ev.value];
    // Only copy scene settings, preserve current style
    const currentStyle = params.style;
    Object.assign(params, p);
    params.style = currentStyle; // Keep the effect
    pane.refresh();
    updateAllUniforms();
  });
pane.addBlade({
  view: "separator"
});
// 1. VISUAL FILTERS
const fStyle = pane.addFolder({
  title: "Visual Overlay",
  expanded: true
});
fStyle.addBinding(params, "style", {
  options: {
    "Standard (Real)": 0,
    "Noir Film": 1,
    "Retro Grid": 2,
    Synthwave: 3,
    Dream: 4
  }
});
fStyle.addBinding(params, "enableGrid", {
  label: "Active: Holo-Grid"
});
const fGrain = fStyle.addFolder({
  title: "Grain Settings (Noir)",
  expanded: false
});
fGrain.addBinding(params, "grainAmount", {
  min: 0.0,
  max: 0.5,
  step: 0.01
});
fGrain.addBinding(params, "grainScale", {
  min: 10.0,
  max: 200.0
});
// 2. Sun & Sky (Restored)
const f1 = pane.addFolder({
  title: "Sun & Sky",
  expanded: false
});
f1.addBinding(params, "sunPosX", {
  min: -1.5,
  max: 1.5
});
f1.addBinding(params, "sunPosY", {
  min: -0.5,
  max: 1.0
});
f1.addBinding(params, "sunSize", {
  min: 0.0,
  max: 5.0
});
f1.addBinding(params, "sunIntensity", {
  min: 0.0,
  max: 10.0
});
f1.addBinding(params, "horizonColor");
// 3. Atmosphere (Restored)
const f2 = pane.addFolder({
  title: "Atmosphere",
  expanded: false
});
f2.addBinding(params, "enableClouds");
f2.addBinding(params, "cloudDensity", {
  min: 0.0,
  max: 3.0
});
f2.addBinding(params, "cloudSpeed", {
  min: 0.0,
  max: 1.0
});
f2.addBinding(params, "cloudColor");
f2.addBinding(params, "horizonFade", {
  min: 0.0,
  max: 0.2
});
// 4. Ocean (Restored)
const f3 = pane.addFolder({
  title: "Ocean Surface",
  expanded: false
});
f3.addBinding(params, "waveHeight", {
  min: 0.0,
  max: 2.5
});
f3.addBinding(params, "waveChoppiness", {
  min: 0.0,
  max: 3.0
});
f3.addBinding(params, "speed", {
  min: 0.0,
  max: 1.0
});
f3.addBinding(params, "sssBaseColor");
f3.addBinding(params, "sssTipColor");
f3.addBinding(params, "sssStrength", {
  min: 0.0,
  max: 10.0
});
// 5. Reflections (Restored)
const f4 = pane.addFolder({
  title: "Reflections",
  expanded: false
});
f4.addBinding(params, "enableReflections");
f4.addBinding(params, "reflectionStrength", {
  min: 0.0,
  max: 10.0
});
f4.addBinding(params, "reflectionWidth", {
  min: 0.001,
  max: 0.5
});
// 6. FX (Restored)
const f5 = pane.addFolder({
  title: "FX & Post-Process",
  expanded: true
});
f5.addBinding(params, "flySpeed", {
  min: 0.0,
  max: 5.0
});
f5.addBlade({
  view: "separator"
});
f5.addBinding(params, "enableFX");
f5.addBinding(params, "dustStrength", {
  min: 0.0,
  max: 5.0
});
// Lens Flare Controls
const fFlare = f5.addFolder({
  title: "Lens Flare Settings",
  expanded: true
});
fFlare.addBinding(params, "flareIntensity", {
  min: 0.0,
  max: 5.0,
  label: "Intensity"
});
fFlare.addBinding(params, "flareGhosting", {
  min: 0.0,
  max: 5.0,
  label: "Ghosting Scale"
});
fFlare.addBinding(params, "flareStreak", {
  min: 0.0,
  max: 5.0,
  label: "Streak Intensity"
});
fFlare.addBinding(params, "flareAngle", {
  min: 0,
  max: 360,
  step: 1,
  label: "Edge Angle (°)"
});
// Halo Controls
const fHalo = f5.addFolder({
  title: "Atmosphere Halo",
  expanded: false
});
fHalo.addBinding(params, "haloStrength", {
  min: 0.0,
  max: 2.0
});
fHalo.addBinding(params, "haloRadius", {
  min: 0.0,
  max: 1.0,
  label: "Distance"
});
fHalo.addBinding(params, "haloSize", {
  min: 0.0,
  max: 0.1,
  label: "Thickness"
});
f5.addBinding(params, "vignetteStrength", {
  min: 0.0,
  max: 1.0
});
// --- Mouse Handling for Parallax ---
document.addEventListener("mousemove", (event) => {
  mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
  mousePos.y = (event.clientY / window.innerHeight) * 2 - 1;
});
// ============ SHADER & THREE.JS SETUP ============
const fragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMousePos;

      uniform float uStyle;      
      uniform float uEnableGrid; 
      uniform float uEnableClouds;
      uniform float uEnableReflections;
      uniform float uEnableFX;

      // Flare Uniforms
      uniform float uFlareIntensity;
      uniform float uFlareGhosting;
      uniform float uFlareStreak;
      uniform float uFlareAngle; // Angle in degrees
      uniform float uCameraHeight; // Camera Y position for scroll animation
      uniform float uCameraTilt; // Camera tilt for looking up towards sun

      // ... other uniforms ...
      uniform float uWaveHeight;
      uniform float uWaveChoppiness;
      uniform float uSpeed;
      uniform float uFlySpeed;
      
      uniform float uSssStrength;
      uniform vec3 uSssBaseColor;
      uniform vec3 uSssTipColor;
      
      uniform float uSunSize;
      uniform float uSunIntensity;
      uniform float uSunPosX;
      uniform float uSunPosY;
      
      uniform float uReflectionStrength;
      uniform float uReflectionWidth;
      
      uniform float uCloudDensity;
      uniform float uCloudSpeed;
      uniform vec3 uCloudColor;
      uniform vec3 uHorizonColor;
      
      uniform float uHaloStrength;
      uniform float uHaloRadius;
      uniform float uHaloSize;
      
      uniform float uDustStrength;
      uniform float uHorizonFade;
      uniform float uVignetteStrength;
      
      uniform float uGrainAmount;
      uniform float uGrainScale;

      #define PI 3.14159265359

      // --- UTILS ---
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      
      float rand(vec2 uv, float t) {
          return fract(sin(dot(uv, vec2(1225.6548, 321.8942))) * 4251.4865 + t);
      }
      
      // --- FILM GRAIN FUNCTIONS ---
      float gaussian(float z, float u, float o) {
          return (1.0 / (o * sqrt(2.0 * PI))) * exp(-(((z - u) * (z - u)) / (2.0 * (o * o))));
      }
      
      vec3 grainScreen(vec3 a, vec3 b, float w) {
          return mix(a, vec3(1.0) - (vec3(1.0) - a) * (vec3(1.0) - b), w);
      }
      
      vec3 grainOverlay(vec3 a, vec3 b, float w) {
          vec3 mixed = mix(
              2.0 * a * b,
              vec3(1.0) - 2.0 * (vec3(1.0) - a) * (vec3(1.0) - b),
              step(vec3(0.5), a)
          );
          return mix(a, mixed, w);
      }
      
      float fbm(vec2 p) {
          float v = 0.0; float a = 0.5; 
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for(int i=0; i<3; i++) { v += a * noise(p); p = rot * p * 2.0; a *= 0.5; }
          return v;
      }
      
      float noise3D(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          float n = dot(i, vec3(1.0, 57.0, 113.0));
          return mix(mix(mix(hash(vec2(n+0.0)), hash(vec2(n+1.0)), f.x),
                         mix(hash(vec2(n+57.0)), hash(vec2(n+58.0)), f.x), f.y),
                     mix(mix(hash(vec2(n+113.0)), hash(vec2(n+114.0)), f.x),
                         mix(hash(vec2(n+170.0)), hash(vec2(n+171.0)), f.x), f.y), f.z);
      }
      
      float cloudNoise(vec2 p) {
          float f = 0.0;
          f += 0.50000 * noise(p); p = p * 2.02;
          f += 0.25000 * noise(p); p = p * 2.03;
          f += 0.12500 * noise(p);
          return f;
      }

      float map(vec3 p) {
          vec2 q = p.xz * 0.35; 
          float h = 0.0;
          float a = 0.6 * uWaveHeight;
          if(uWaveChoppiness > 0.1) q += vec2(fbm(q + uTime * 0.05), fbm(q)) * uWaveChoppiness;
          for(int i=0; i<4; i++) {
              float ang = float(i) * 0.6;
              vec2 dir = vec2(sin(ang), cos(ang) * 1.5); dir = normalize(dir);
              float wave = 1.0 - abs(sin(dot(q, dir) - uTime * uSpeed + float(i)));
              wave = pow(wave, 3.0); h += a * wave;
              a *= 0.5; q *= 1.8; q.x += 1.0; 
          }
          return p.y - h;
      }

      vec3 getNormal(vec3 p) {
          float eps = 0.01 + uWaveHeight * 0.02;
          vec2 e = vec2(eps, 0.0);
          return normalize(vec3(map(p+e.xyy) - map(p-e.xyy), e.x * 2.0, map(p+e.yyx) - map(p-e.yyx)));
      }

      vec3 getSky(vec3 rd, vec3 sunDir, bool renderSun) {
          float sunDot = max(0.0, dot(rd, sunDir));
          vec3 zenithCol = vec3(0.0, 0.0, 0.02); 
          vec3 skyCol = mix(uHorizonColor, zenithCol, pow(max(0.0,rd.y + 0.05), 0.5));

          float occlusion = 0.0;
          if (uEnableClouds > 0.5) {
              if (uCloudDensity > 0.0 && rd.y > 0.0 && rd.y < 0.45) {
                 vec2 skyUV = rd.xz / max(0.05, rd.y); 
                 skyUV.x += uTime * uCloudSpeed;
                 float cl = cloudNoise(skyUV * 0.15); 
                 float heightMask = smoothstep(0.0, 0.1, rd.y) * smoothstep(0.45, 0.1, rd.y);
                 float cloudIntensity = smoothstep(0.3, 0.7, cl) * heightMask * uCloudDensity;
                 skyCol = mix(skyCol, uCloudColor, cloudIntensity);
                 occlusion = cloudIntensity;
              }
          }
          
          float sunRadiusThreshold = 0.99 - (uSunSize * 0.03); 
          float sun = (uSunSize < 0.1) ? 0.0 : smoothstep(sunRadiusThreshold, sunRadiusThreshold + 0.002, sunDot);
          float glow = (uSunSize < 0.1) ? 0.0 : pow(sunDot, 12.0 / uSunSize);
          float sunVis = 1.0 - clamp(occlusion * 1.5, 0.0, 0.9);

          vec3 sunCol = uSssTipColor * uSunIntensity * sunVis;
          skyCol += glow * sunCol * 1.5; 

          if (renderSun) { skyCol += sun * sunCol * 8.0; }
          
          if (uEnableFX > 0.5 && uHaloStrength > 0.0) {
              float baseR = 1.0 - uHaloRadius * 0.2; 
              float sizeR = uHaloSize; 
              float sizeG = uHaloSize + 0.005;
              float sizeB = uHaloSize + 0.010;

              float ringR = smoothstep(sizeR, 0.0, abs(sunDot - baseR));
              float ringG = smoothstep(sizeG, 0.0, abs(sunDot - (baseR + 0.005)));
              float ringB = smoothstep(sizeB, 0.0, abs(sunDot - (baseR + 0.010)));

              vec3 haloCol = vec3(ringR, ringG, ringB);
              skyCol += haloCol * uHaloStrength * 0.5 * (1.0 - occlusion * 0.5);
          }
          
          return skyCol;
      }

      // --- LENS FLARE CORE ---
      // Returns vec4: rgb = ghost color, a = core brightness (separate for intensity control)
      vec4 lensflares(vec2 uv, vec2 pos, float ghostingScale, vec2 parallaxShift) {
          vec2 main = uv - pos;
          vec2 uvd = uv * (length(uv));
          
          float ang = atan(main.y, main.x);
          float dist = length(main); 
          dist = pow(dist, 0.1);
          
          // Core flare (f0) - kept separate for independent intensity control
          float f0 = 1.0 / (length(uv - pos) * 25.0 + 1.0); 
          f0 = pow(f0, 2.0); 
          float star = sin(noise(vec2(sin(ang*2.0+pos.x)*4.0, cos(ang*3.0+pos.y)))*16.0);
          f0 = f0 + f0 * (star * 0.1 + dist * 0.1 + 0.8);
          
          // Apply Ghosting Scale factor and Directional Parallax Shift to ghost positions
          vec2 scaledPos = (pos * ghostingScale) + parallaxShift;
          
          // Distance from center - ghosts get stronger further from center
          float centerDist = length(scaledPos);
          float distanceFactor = 1.0 + centerDist * 0.5;

          float f2  = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.8 * scaledPos), 2.0)), 0.0) * 0.25;
          float f22 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.85 * scaledPos), 2.0)), 0.0) * 0.23;
          float f23 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.9 * scaledPos), 2.0)), 0.0) * 0.21;
          
          vec2 uvx = mix(uv, uvd, -0.5);
          
          float f4  = max(0.01 - pow(length(uvx + 0.4 * scaledPos), 2.4), 0.0) * 6.0;
          float f42 = max(0.01 - pow(length(uvx + 0.45 * scaledPos), 2.4), 0.0) * 5.0;
          float f43 = max(0.01 - pow(length(uvx + 0.5 * scaledPos), 2.4), 0.0) * 3.0;
          
          uvx = mix(uv, uvd, -0.4);
          
          float f5  = max(0.01 - pow(length(uvx + 0.2 * scaledPos), 5.5), 0.0) * 2.0;
          float f52 = max(0.01 - pow(length(uvx + 0.4 * scaledPos), 5.5), 0.0) * 2.0;
          float f53 = max(0.01 - pow(length(uvx + 0.6 * scaledPos), 5.5), 0.0) * 2.0;
          
          uvx = mix(uv, uvd, -0.5);
          
          float f6  = max(0.01 - pow(length(uvx - 0.3 * scaledPos), 1.6), 0.0) * 6.0;
          float f62 = max(0.01 - pow(length(uvx - 0.325 * scaledPos), 1.6), 0.0) * 3.0;
          float f63 = max(0.01 - pow(length(uvx - 0.35 * scaledPos), 1.6), 0.0) * 5.0;
          
          vec3 c = vec3(0.0);
          
          // Apply distance factor to ghosts
          c.r += (f2 + f4 + f5 + f6) * distanceFactor; 
          c.g += (f22 + f42 + f52 + f62) * distanceFactor; 
          c.b += (f23 + f43 + f53 + f63) * distanceFactor;
          c = max(vec3(0.0), c * 1.3 - vec3(length(uvd) * 0.05)); // Clamp to prevent negative values
          
          // Return ghosts in rgb, core in alpha (separate)
          return vec4(c, f0);
      }
      
      // --- ANAMORPHIC STREAK (Optimized & Controllable) ---
      vec3 anflares_optimized(vec2 uv, vec2 pos, float streakIntensity) {
          vec2 main = uv - pos;
          float v = smoothstep(0.02, 0.0, abs(main.y));
          float h = smoothstep(1.0, 0.0, abs(main.x) / 1.5); 
          return vec3(v * h) * streakIntensity * 0.8;
      }

      vec3 filmic(vec3 x) {
        vec3 a = max(vec3(0.0), x - vec3(0.004));
        return (a * (6.2 * a + 0.5)) / (a * (6.2 * a + 1.7) + 0.06);
      }
      
      float dither4x4(vec2 position, float brightness) {
        int x = int(mod(position.x, 4.0)); int y = int(mod(position.y, 4.0));
        int index = x + y * 4; float limit = 0.0;
        if (x < 8) {
          if (index == 0) limit = 0.0625; if (index == 1) limit = 0.5625; if (index == 2) limit = 0.1875; if (index == 3) limit = 0.6875;
          if (index == 4) limit = 0.8125; if (index == 5) limit = 0.3125; if (index == 6) limit = 0.9375; if (index == 7) limit = 0.4375;
          if (index == 8) limit = 0.25;   if (index == 9) limit = 0.75;   if (index == 10) limit = 0.125; if (index == 11) limit = 0.625;
          if (index == 12) limit = 1.0;   if (index == 13) limit = 0.5;   if (index == 14) limit = 0.875; if (index == 15) limit = 0.375;
        }
        return brightness < limit ? 0.0 : 1.0;
      }

      // --- MAIN RENDER ---
      vec3 renderScene(vec3 ro, vec3 rd, vec3 sunDir) {
          float t = 0.0; float d = 0.0; float maxDist = 150.0;
          for(int i=0; i<100; i++) { d = map(ro + rd*t); t += d * 0.6; if(d<0.01 || t>maxDist) break; }
          vec3 col = vec3(0.0);
          
          if(t < maxDist) {
              vec3 p = ro + rd*t; 
              vec3 n = getNormal(p); 
              vec3 ref = reflect(rd, n);
              float fresnel = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(n, -rd)), 5.0); 
              
              col = uSssBaseColor * (0.002 + 0.1*max(0.0, dot(n, sunDir)));
              col = mix(col, getSky(ref, sunDir, false), fresnel * 0.95); 
              
              float sss = pow(max(0.0, dot(n, -sunDir)), 2.0) * smoothstep(-0.2, uWaveHeight, p.y);
              col += uSssTipColor * sss * uSssStrength * 3.0; 
              
              if (uEnableReflections > 0.5) {
                  float refDot = dot(ref, sunDir);
                  float specPower = 1.0 / max(0.0001, uReflectionWidth * uReflectionWidth);
                  float specular = pow(max(0.0, refDot), specPower);
                  col += uSssTipColor * specular * uReflectionStrength;
              }
              // Grid
              if(uEnableGrid > 0.5) {
                  vec2 gridUV = p.xz * 0.5;
                  float grid = step(0.97, fract(gridUV.x)) + step(0.97, fract(gridUV.y));
                  float fade = smoothstep(50.0, 0.0, t);
                  col += uSssTipColor * grid * fade * 2.0;
              }
              float hBlend = smoothstep(maxDist * (1.0 - max(0.001, uHorizonFade)), maxDist, t);
              col = mix(col, getSky(rd, sunDir, true), hBlend);
          } else {
              col = getSky(rd, sunDir, true);
          }
          return col;
      }

      void main() {
        vec2 coord = gl_FragCoord.xy;
        vec2 uv = (coord * 2.0 - uResolution.xy) / uResolution.y;
        
        // Camera position - height controlled by scroll
        vec3 ro = vec3(0.0, uCameraHeight, uTime * (uFlySpeed * 2.0 + 1.0));
        
        // Camera setup - tilt controlled by scroll (looks up towards sun as we approach)
        vec3 ta = ro + vec3(0.0, uCameraTilt, 10.0); 
        vec3 ww = normalize(ta - ro);
        vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
        vec3 vv = normalize(cross(uu, ww));
        vec3 sunDir = normalize(vec3(uSunPosX, uSunPosY, 1.0)); 
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
        
        vec3 col = renderScene(ro, rd, sunDir);
        
        // --- DUST ---
        if(uEnableFX > 0.5 && uDustStrength > 0.0) {
            vec3 pDust = rd * 8.0; pDust.y -= uTime * 0.3; 
            float specks = smoothstep(0.90, 1.0, noise3D(pDust));
            col += uSssTipColor * specks * uDustStrength;
        }

        // --- DYNAMIC SUN-BOUND LENS FLARE ---
        if (uEnableFX > 0.5 && uFlareIntensity > 0.0) {
            vec3 sunView = vec3(dot(sunDir, uu), dot(sunDir, vv), dot(sunDir, ww));
            
            if (sunView.z > 0.0) { 
                // 1. Calculate Sun Screen Position (Center)
                float focalLength = 1.5;
                vec2 sunScreenPos = sunView.xy * focalLength; 
                
                // 2. Calculate ACTUAL sun radius on screen
                // The sun is rendered where dot(rd, sunDir) > threshold
                // threshold = 0.99 - uSunSize * 0.03
                // Angular radius = acos(threshold), screen radius = tan(angularRadius) * focalLength
                float sunThreshold = 0.99 - uSunSize * 0.03;
                float angularRadius = acos(clamp(sunThreshold, 0.0, 1.0));
                float sunRadiusScreen = tan(angularRadius) * focalLength;
                
                // 3. Calculate edge offset using flareAngle
                // Convert degrees to radians
                // 0° = right, 90° = top, 180° = left, 270° = bottom
                float angleRad = uFlareAngle * PI / 180.0;
                
                vec2 edgeDirection = vec2(cos(angleRad), sin(angleRad));
                vec2 edgeOffset = edgeDirection * sunRadiusScreen;
                
                vec2 flareSource = sunScreenPos + edgeOffset; // Flare core is anchored to the edge

                // 4. Parallax Shift - subtle movement on ghosts only
                vec2 parallaxShift = uMousePos * 0.15;
                
                // 5. Render Flare (returns vec4: rgb=ghosts, a=core)
                vec4 flareData = lensflares(uv, flareSource, uFlareGhosting, parallaxShift);
                vec3 ghosts = flareData.rgb;
                float core = flareData.a;
                
                vec3 streak = anflares_optimized(uv, flareSource, uFlareStreak);
                
                // 6. Combine and Blend Color
                vec3 flareColorBase = vec3(0.643, 0.494, 0.867); 
                vec3 finalFlareColor = mix(flareColorBase, uSssTipColor, 0.7); 

                // Separate control: ghosts use ghosting scale, core uses intensity only
                vec3 finalFlare = max(vec3(0.0), ghosts) * uFlareGhosting + streak;
                finalFlare += vec3(core) * 0.5; // Core at reduced brightness
                
                // Style-based flare boost (boost for Standard, Synthwave, Dream - not Noir/Retro)
                float flareBoost = 1.0;
                if (uStyle < 0.5 || uStyle > 2.5) {
                    flareBoost = 1.8; // Boost for non-Noir/Retro styles
                }
                if (uStyle > 3.5) {
                    flareBoost = 2.5; // Extra boost for Dream mode
                }
                
                col += max(vec3(0.0), finalFlare * uFlareIntensity * flareBoost * finalFlareColor);
            }
        }

        // --- STYLES ---
        
        // STYLE: NOIR FILM 
        if (uStyle > 0.5 && uStyle < 1.5) {
             float lum = dot(col, vec3(0.299, 0.587, 0.114));
             vec3 mono = vec3(lum);
             mono = smoothstep(0.1, 0.9, mono);
             vec3 tint = mix(vec3(1.0), uHorizonColor, 0.2);
             col = mono * tint;
             
             // Film grain - gaussian noise
             float grainSpeed = 2.0;
             float grainIntensity = 0.08;
             float grainMean = 0.0;
             float grainVariance = 0.5;
             
             vec2 grainUV = coord / uResolution.xy;
             float t = uTime * grainSpeed;
             float seed = dot(grainUV, vec2(12.9898, 78.233));
             float filmNoise = fract(sin(seed) * 43758.5453 + t);
             filmNoise = gaussian(filmNoise, grainMean, grainVariance * grainVariance);
             
             vec3 grain = vec3(filmNoise) * (1.0 - col);
             col = grainOverlay(col, grain, grainIntensity);
        }
        
        // STYLE: RETRO
        if (uStyle > 1.5 && uStyle < 2.5) {
            float brightness = dot(col, vec3(0.299, 0.587, 0.114));
            float d = dither4x4(gl_FragCoord.xy, brightness * 1.5);
            col = uSssTipColor * d;
        }
        
        // STYLE: SYNTHWAVE
        if (uStyle > 2.5 && uStyle < 3.5) {
            // Boost contrast
            col = pow(col, vec3(1.2));
            
            // Color grading - push towards pink/cyan
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            vec3 pink = vec3(1.0, 0.44, 0.81);    // #ff71ce
            vec3 cyan = vec3(0.0, 0.8, 1.0);      // #01cdfe
            vec3 purple = vec3(0.69, 0.49, 0.97); // #b967ff
            
            // Map luminance to synthwave colors
            vec3 synthColor = mix(purple, pink, smoothstep(0.0, 0.5, lum));
            synthColor = mix(synthColor, cyan, smoothstep(0.5, 1.0, lum));
            col = mix(col, synthColor * (lum + 0.2), 0.6);
            
            // Scan lines
            float scanline = sin(coord.y * 2.0) * 0.5 + 0.5;
            scanline = pow(scanline, 1.5) * 0.15;
            col -= scanline;
            
            // Chromatic aberration
            vec2 uvNorm = coord / uResolution.xy;
            float aberration = 0.002;
            vec2 dir = uvNorm - 0.5;
            float dist = length(dir);
            col.r = col.r + dist * aberration * 10.0;
            col.b = col.b - dist * aberration * 10.0;
            
            // Subtle glow
            col += lum * pink * 0.1;
        }
        
        // STYLE: DREAM / SOFT FOCUS
        if (uStyle > 3.5) {
            vec2 uvNorm = coord / uResolution.xy;
            
            // Bloom / glow effect
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            float bloom = smoothstep(0.3, 1.0, lum);
            col += col * bloom * 0.6;
            
            // Soft dreamy color grading
            vec3 warmTint = vec3(1.05, 1.0, 0.95);
            vec3 coolShadows = vec3(0.95, 0.97, 1.05);
            col *= mix(coolShadows, warmTint, lum);
            
            // Ethereal glow - slight desaturation in highlights
            vec3 glowColor = vec3(1.0, 0.98, 0.95);
            col = mix(col, glowColor * lum, bloom * 0.3);
            
            // Soft vignette with light falloff
            vec2 vigUV = uvNorm - 0.5;
            float softVig = 1.0 - dot(vigUV, vigUV) * 0.5;
            softVig = smoothstep(0.0, 1.0, softVig);
            col *= softVig;
            
            // Subtle light leaks
            float leak1 = smoothstep(0.7, 0.0, length(uvNorm - vec2(0.1, 0.9)));
            float leak2 = smoothstep(0.6, 0.0, length(uvNorm - vec2(0.9, 0.1)));
            col += vec3(1.0, 0.9, 0.7) * leak1 * 0.15;
            col += vec3(0.9, 0.8, 1.0) * leak2 * 0.1;
            
            // Dreamy haze
            float haze = smoothstep(0.0, 0.6, lum);
            col = mix(col, col + vec3(0.1, 0.08, 0.12), haze * 0.2);
            
            // Soft pulsing glow
            float pulse = sin(uTime * 0.5) * 0.5 + 0.5;
            col += col * pulse * 0.05;
            
            // Reduce contrast slightly for dreamy feel
            col = mix(vec3(0.5), col, 0.9);
        }

        col = filmic(col);
        col *= 1.0 - length(uv * uVignetteStrength); 

        gl_FragColor = vec4(col, 1.0);
      }
    `;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer({
  antialias: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
document.body.appendChild(renderer.domElement);
const uniforms = {
  uTime: {
    value: 0
  },
  uResolution: {
    value: new THREE.Vector2(window.innerWidth, window.innerHeight)
  },
  uMousePos: {
    value: mousePos
  },
  ...Object.fromEntries(
    Object.entries(params)
      .map(([k, v]) => {
        if (k === "activePreset") return undefined;
        let val = v;
        if (k.includes("Color")) val = new THREE.Color(v);
        return [
          `u${k.charAt(0).toUpperCase() + k.slice(1)}`,
          {
            value: val
          }
        ];
      })
      .filter((x) => x)
  ),
  uStyle: {
    value: params.style
  },
  uEnableGrid: {
    value: params.enableGrid ? 1.0 : 0.0
  },
  uEnableClouds: {
    value: params.enableClouds ? 1.0 : 0.0
  },
  uEnableReflections: {
    value: params.enableReflections ? 1.0 : 0.0
  },
  uEnableFX: {
    value: params.enableFX ? 1.0 : 0.0
  },
  uGrainAmount: {
    value: params.grainAmount
  },
  uGrainScale: {
    value: params.grainScale
  },
  uFlareIntensity: {
    value: params.flareIntensity
  },
  uFlareGhosting: {
    value: params.flareGhosting
  },
  uFlareStreak: {
    value: params.flareStreak
  },
  uFlareAngle: {
    value: params.flareAngle
  },
  uCameraHeight: {
    value: 4.0
  }, // Camera height for scroll animation
  uCameraTilt: {
    value: -0.1
  }, // Camera tilt for scroll animation
  uHaloSize: {
    value: params.haloSize
  }
};
scene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
      fragmentShader,
      uniforms
    })
  )
);
window.addEventListener("resize", (e) => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

function updateAllUniforms() {
  Object.entries(params).forEach(([k, v]) => {
    if (k === "activePreset") return;
    const uName = `u${k.charAt(0).toUpperCase() + k.slice(1)}`;
    if (!uniforms[uName]) return;
    if (k.includes("Color")) uniforms[uName].value.set(v);
    else if (k.startsWith("enable")) uniforms[uName].value = v ? 1.0 : 0.0;
    else uniforms[uName].value = v;
  });
  // Update body class for style-specific subtitle colors
  document.body.classList.remove(
    "style-noir",
    "style-retro",
    "style-synthwave",
    "style-dream",
    "style-standard"
  );
  if (params.style === 1) {
    document.body.classList.add("style-noir");
  } else if (params.style === 2) {
    document.body.classList.add("style-retro");
  } else if (params.style === 3) {
    document.body.classList.add("style-synthwave");
  } else if (params.style === 4) {
    document.body.classList.add("style-dream");
  } else {
    document.body.classList.add("style-standard");
  }
}
pane.on("change", (e) => {
  updateAllUniforms();
});
updateAllUniforms();
// ============ CINEMATIC SUBTITLE SYSTEM WITH GSAP ============
const subtitles = [
  {
    text: "The past doesn't exist",
    delay: 4000
  },
  {
    text: "",
    delay: 2500
  },
  {
    text: "It never did",
    delay: 3500
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "Only in your mind",
    delay: 3500
  },
  {
    text: "Your memories",
    delay: 3500
  },
  {
    text: "",
    delay: 2500
  },
  {
    text: "No more real than a daydream",
    delay: 4500
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "What you remember",
    delay: 3500
  },
  {
    text: "is colored by what you felt",
    delay: 4500
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "Your mind exaggerates",
    delay: 3500
  },
  {
    text: "forgets",
    delay: 3000
  },
  {
    text: "rewrites",
    delay: 3500
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "Someone else was there",
    delay: 4000
  },
  {
    text: "They remember it differently",
    delay: 4500
  },
  {
    text: "",
    delay: 3500
  },
  {
    text: "Memories cannot be trusted",
    delay: 4500
  },
  {
    text: "",
    delay: 3500
  },
  {
    text: "But here's the thing",
    delay: 4000
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "We become who we are",
    delay: 4000
  },
  {
    text: "because of what we remember",
    delay: 4500
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "We write a story about our life",
    delay: 4500
  },
  {
    text: "and tell it to ourselves",
    delay: 4500
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "That story becomes us",
    delay: 4500
  },
  {
    text: "",
    delay: 4000
  },
  {
    text: "But the past",
    delay: 3500
  },
  {
    text: "doesn't exist anymore",
    delay: 4000
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "What you remember",
    delay: 3500
  },
  {
    text: "probably didn't happen",
    delay: 4000
  },
  {
    text: "the way you remember it",
    delay: 4500
  },
  {
    text: "",
    delay: 4000
  },
  {
    text: "So rewrite it",
    delay: 4000
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "Rewrite the story",
    delay: 4000
  },
  {
    text: "you tell yourself",
    delay: 4000
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "Rewrite your past",
    delay: 4000
  },
  {
    text: "",
    delay: 3000
  },
  {
    text: "and you rewrite yourself",
    delay: 5000
  },
  {
    text: "",
    delay: 4000
  },
  {
    text: "Because in the end",
    delay: 4000
  },
  {
    text: "",
    delay: 3000
  }
  // Loops back to "The past doesn't exist"
];
const subtitleEl = document.getElementById("subtitle");
let subtitleIndex = 0;
let currentSplit = null;
let subtitleTimeoutId = null;

function cleanupSplit() {
  if (currentSplit) {
    currentSplit.revert();
    currentSplit = null;
  }
  // Clear text to prevent flash when revert restores original content
  document.getElementById("subtitle").textContent = "";
}

function animateSubtitleIn(text) {
  const el = document.getElementById("subtitle");

  // Clean up previous split first
  cleanupSplit();

  if (!text) {
    el.textContent = "";
    return;
  }

  el.textContent = text;

  currentSplit = new SplitText(el, { type: "chars" });
  const chars = currentSplit.chars;

  gsap.fromTo(
    chars,
    { opacity: 0, filter: "blur(10px)" },
    {
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.6,
      ease: "power2.out",
      stagger: { each: 0.05, from: "start" }
    }
  );
}

function animateSubtitleOut() {
  return new Promise((resolve) => {
    if (
      !currentSplit ||
      !currentSplit.chars ||
      currentSplit.chars.length === 0
    ) {
      resolve();
      return;
    }

    const chars = currentSplit.chars;

    gsap.to(chars, {
      opacity: 0,
      filter: "blur(10px)",
      duration: 0.4,
      ease: "power2.in",
      stagger: { each: 0.03, from: "start" },
      onComplete: () => {
        cleanupSplit();
        resolve();
      }
    });
  });
}

async function showNextSubtitle() {
  // Clear any pending timeout
  if (subtitleTimeoutId) {
    clearTimeout(subtitleTimeoutId);
    subtitleTimeoutId = null;
  }

  // Wait if paused
  while (typeof subtitlesPaused !== "undefined" && subtitlesPaused) {
    await new Promise((r) => setTimeout(r, 500));
  }

  if (subtitleIndex >= subtitles.length) {
    subtitleIndex = 0;
  }

  const current = subtitles[subtitleIndex];

  await animateSubtitleOut();
  await new Promise((r) => setTimeout(r, 200));

  animateSubtitleIn(current.text);

  subtitleIndex++;
  subtitleTimeoutId = setTimeout(showNextSubtitle, current.delay);
}

// Start subtitles
subtitleTimeoutId = setTimeout(showNextSubtitle, 2000);
// ============ AUDIO TOGGLE ============
const audioToggle = document.getElementById("audioToggle");
const bgMusic = document.getElementById("bgMusic");
bgMusic.volume = 0.4;
let isPlaying = false;
audioToggle.addEventListener("click", () => {
  if (isPlaying) {
    bgMusic.pause();
    audioToggle.classList.remove("playing");
    audioToggle.title = "Click to play music";
  } else {
    bgMusic.play().catch((e) => console.log("Audio play failed:", e));
    audioToggle.classList.add("playing");
    audioToggle.title = "Click to pause music";
  }
  isPlaying = !isPlaying;
});
animate(0);
// ============ SCROLL-BASED ANIMATIONS ============
let scrollProgress = 0;
const cameraStartHeight = 4.0; // Starting high above water
const cameraEndHeight = 1.5; // Closer to water surface
const cameraTiltStart = -0.1; // Looking slightly down
const cameraTiltEnd = 2.5; // Looking up towards the sun
function updateScrollAnimations() {
  const scrollHeight =
    document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = Math.min(1, window.scrollY / scrollHeight);
  // Update scroll progress indicator
  const scrollFill = document.getElementById("scrollFill");
  if (scrollFill) {
    scrollFill.style.height = scrollProgress * 100 + "%";
  }
  // Update scroll markers - highlight based on position
  const pastMarker = document.querySelector(".scroll-marker.past");
  const presentMarker = document.querySelector(".scroll-marker.present");
  const futureMarker = document.querySelector(".scroll-marker.future");
  if (pastMarker && presentMarker && futureMarker) {
    pastMarker.classList.remove("active");
    presentMarker.classList.remove("active");
    futureMarker.classList.remove("active");
    if (scrollProgress < 0.33) {
      pastMarker.classList.add("active");
    } else if (scrollProgress < 0.66) {
      presentMarker.classList.add("active");
    } else {
      futureMarker.classList.add("active");
    }
  }
  // Ease the progress for smoother feel
  const easedProgress =
    scrollProgress * scrollProgress * (3 - 2 * scrollProgress); // smoothstep
  // Camera descends towards the water
  const cameraHeight =
    cameraStartHeight - (cameraStartHeight - cameraEndHeight) * easedProgress;
  uniforms.uCameraHeight.value = cameraHeight;
  // Camera tilts up towards the sun as we scroll
  const cameraTilt =
    cameraTiltStart + (cameraTiltEnd - cameraTiltStart) * easedProgress;
  uniforms.uCameraTilt.value = cameraTilt;
}
window.addEventListener("scroll", updateScrollAnimations, {
  passive: true
});
updateScrollAnimations(); // Initial call
// ============ STORY & CREDITS TOGGLES ============
const storyToggle = document.getElementById("storyToggle");
const storyPanel = document.getElementById("storyPanel");
const creditsToggle = document.getElementById("creditsToggle");
const creditsPanel = document.getElementById("creditsPanel");
const subtitleContainer = document.querySelector(".subtitle-container");
let subtitlesPaused = false;
storyToggle.addEventListener("click", () => {
  const isOpening = !storyPanel.classList.contains("visible");
  storyPanel.classList.toggle("visible");
  storyToggle.classList.toggle("active");
  subtitlesPaused = isOpening;
  if (subtitleContainer) {
    subtitleContainer.style.opacity = isOpening ? "0" : "1";
    subtitleContainer.style.visibility = isOpening ? "hidden" : "visible";
  }
});
storyPanel.addEventListener("click", () => {
  storyPanel.classList.remove("visible");
  storyToggle.classList.remove("active");
  subtitlesPaused = false;
  if (subtitleContainer) {
    subtitleContainer.style.opacity = "1";
    subtitleContainer.style.visibility = "visible";
  }
});
creditsToggle.addEventListener("click", () => {
  creditsPanel.classList.toggle("visible");
  creditsToggle.classList.toggle("active");
});
// ============ KEYBOARD SHORTCUTS ============
document.addEventListener("keydown", (e) => {
  // Skip if typing in an input
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  // 'H' to toggle pane
  if (e.key === "h" || e.key === "H") {
    e.preventDefault();
    pane.hidden = !pane.hidden;
  }
  // Escape to close panels
  if (e.key === "Escape") {
    storyPanel.classList.remove("visible");
    storyToggle.classList.remove("active");
    creditsPanel.classList.remove("visible");
    creditsToggle.classList.remove("active");
    subtitlesPaused = false;
    if (subtitleContainer) {
      subtitleContainer.style.opacity = "1";
      subtitleContainer.style.visibility = "visible";
    }
  }
});

function animate(t) {
  const time = t * 0.001;
  uniforms.uTime.value = time;
  uniforms.uMousePos.value.set(mousePos.x, mousePos.y);

  // CONSTANT forward speed – no oscillation
  const forwardSpeed = params.flySpeed; // or params.flySpeed * 2.0, tweak as needed
  uniforms.uFlySpeed.value = forwardSpeed;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
