
// ============ 1. FIXED PRESETS ============
const PRESETS = {
  Sunset: {
    sunPosX: 0.0, sunPosY: 0.05, sunSize: 2.1, sunIntensity: 4.0,
    horizonColor: "#ff2200", enableClouds: true, cloudDensity: 0.6,
    cloudColor: "#ffaa00", waveHeight: 0.22, speed: 0.35,
    sssBaseColor: "#000000", sssTipColor: "#ff3300",
    reflectionStrength: 1.4, reflectionWidth: 0.05, haloStrength: 0.5,
    haloRadius: 0.3, haloSize: 0.02, vignetteStrength: 0.5,
    enableGrid: true, flareIntensity: 1.0, flareGhosting: 1.0,
    flareStreak: 2.0, flareAngle: 140
  },
  Sunny: { // <--- 这是我们的滚动终点
    sunPosX: 0.0, sunPosY: 0.1, sunSize: 0.9, sunIntensity: 4.0,
    horizonColor: "#00bbff", enableClouds: true, cloudDensity: 0.3,
    cloudColor: "#ffffff", waveHeight: 0.25, speed: 0.4,
    sssBaseColor: "#001a33", sssTipColor: "#0099ff",
    reflectionStrength: 3.0, reflectionWidth: 0.1, haloStrength: 0.2,
    haloRadius: 0.3, haloSize: 0.02, vignetteStrength: 0.2,
    enableGrid: false, flareIntensity: 0.3, flareGhosting: 0.5,
    flareStreak: 3.0, flareAngle: 140
  },
  Cloudy: {
    sunPosX: 0.0, sunPosY: 0.3, sunSize: 3.0, sunIntensity: 1.5,
    horizonColor: "#667788", enableClouds: true, cloudDensity: 1.5,
    cloudColor: "#556677", waveHeight: 0.45, speed: 0.5,
    sssBaseColor: "#111520", sssTipColor: "#4a5a6a",
    reflectionStrength: 0.8, reflectionWidth: 0.3, haloStrength: 0.1,
    haloRadius: 0.3, haloSize: 0.02, vignetteStrength: 0.4,
    enableGrid: true, flareIntensity: 0.2, flareGhosting: 0.3,
    flareStreak: 0.5, flareAngle: 140
  },
  Night: { // <--- 这是我们的滚动起点
    sunPosX: 0.0, sunPosY: 0.3, sunSize: 0.9, sunIntensity: 3.0,
    horizonColor: "#0a0a15", enableClouds: true, cloudDensity: 0.3,
    cloudColor: "#101018", waveHeight: 0.2, speed: 0.2,
    sssBaseColor: "#000005", sssTipColor: "#8888aa",
    reflectionStrength: 2.5, reflectionWidth: 0.015, haloStrength: 1.5,
    haloRadius: 0.3, haloSize: 0.02, vignetteStrength: 0.65,
    enableGrid: false, flareIntensity: 0.0, flareGhosting: 0.8,
    flareStreak: 1.0, flareAngle: 140
  },
  Twilight: {
    sunPosX: 0.0, sunPosY: -0.05, sunSize: 2.5, sunIntensity: 2.0,
    horizonColor: "#1a0a20", enableClouds: true, cloudDensity: 0.4,
    cloudColor: "#2a1a30", waveHeight: 0.3, speed: 0.25,
    sssBaseColor: "#050008", sssTipColor: "#6644aa",
    reflectionStrength: 1.8, reflectionWidth: 0.08, haloStrength: 0.8,
    haloRadius: 0.4, haloSize: 0.025, vignetteStrength: 0.55,
    enableGrid: true, flareIntensity: 1.2, flareGhosting: 1.0,
    flareStreak: 1.5, flareAngle: 140
  },
  Dark: {
    sunPosX: 0.0, sunPosY: 0.15, sunSize: 0.5, sunIntensity: 4.8,
    horizonColor: "#4476ff", enableClouds: true, cloudDensity: 0.15,
    cloudColor: "#080810", waveHeight: 0.35, speed: 0.15,
    sssBaseColor: "#000002", sssTipColor: "#222233",
    reflectionStrength: 8.2, reflectionWidth: 0.5, haloStrength: 0.6,
    haloRadius: 0.54, haloSize: 0.1, vignetteStrength: 0.75,
    enableGrid: true, flareIntensity: 0.8, flareGhosting: 0.4,
    flareStreak: 0.5, flareAngle: 140
  }
};

// ============ 2. PARAMS & STATE ============
const params = {
  activePreset: "Night",
  style: 2,
  enableGrid: false,
  sunPosX: 0.0, sunPosY: 0.3, sunSize: 0.9, sunIntensity: 0.3,
  horizonColor: "#0a0a15",
  enableClouds: true, cloudDensity: 0.25, cloudSpeed: 0.05, cloudColor: "#101018",
  horizonFade: 0.05,
  waveHeight: 0.25, waveChoppiness: 2.5, speed: 0.3,
  sssBaseColor: "#000005", sssTipColor: "#8888aa", sssStrength: 2.0,
  enableReflections: true, reflectionStrength: 3.5, reflectionWidth: 0.15,
  flySpeed: 0.3,
  enableFX: true, dustStrength: 1.0,
  flareIntensity: 0.25, flareGhosting: 0.5, flareStreak: 0.5, flareAngle: 140,
  haloStrength: 0.2, haloRadius: 0.3, haloSize: 0.02,
  grainAmount: 0.0, grainScale: 50.0, vignetteStrength: 0.65
};
// ============ 3. UTILS ============
const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (start, end, t) => {
  const c1 = new THREE.Color(start);
  const c2 = new THREE.Color(end);
  return c1.lerp(c2, t);
};

const mousePos = new THREE.Vector2(0, 0);


// ============ 4. SHADER SOURCE ============
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
      uniform float uFlareIntensity;
      uniform float uFlareGhosting;
      uniform float uFlareStreak;
      uniform float uFlareAngle;
      uniform float uCameraHeight;
      uniform float uCameraTilt;
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

      #define PI 3.14159265359

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float noise3D(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          float n = dot(i, vec3(1.0, 57.0, 113.0));
          return mix(mix(mix(hash(vec2(n+0.0)), hash(vec2(n+1.0)), f.x),
                         mix(hash(vec2(n+57.0)), hash(vec2(n+58.0)), f.x), f.y),
                     mix(mix(hash(vec2(n+113.0)), hash(vec2(n+114.0)), f.x),
                         mix(hash(vec2(n+170.0)), hash(vec2(n+171.0)), f.x), f.y), f.z);
      }
      float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for(int i=0; i<3; i++) { v += a * noise(p); p = rot * p * 2.0; a *= 0.5; }
          return v;
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
          for(int i=0; i<3; i++) {
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
              float ringR = smoothstep(uHaloSize, 0.0, abs(sunDot - baseR));
              float ringG = smoothstep(uHaloSize+0.005, 0.0, abs(sunDot - (baseR + 0.005)));
              float ringB = smoothstep(uHaloSize+0.010, 0.0, abs(sunDot - (baseR + 0.010)));
              skyCol += vec3(ringR, ringG, ringB) * uHaloStrength * 0.5 * (1.0 - occlusion * 0.5);
          }
          return skyCol;
      }
      vec4 lensflares(vec2 uv, vec2 pos, float ghostingScale, vec2 parallaxShift) {
          vec2 main = uv - pos;
          vec2 uvd = uv * (length(uv));
          float f0 = pow(1.0 / (length(uv - pos) * 25.0 + 1.0), 2.0);
          vec2 scaledPos = (pos * ghostingScale) + parallaxShift;
          float distanceFactor = 1.0 + length(scaledPos) * 0.5;
          float f2  = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.8 * scaledPos), 2.0)), 0.0) * 0.25;
          float f22 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.85 * scaledPos), 2.0)), 0.0) * 0.23;
          float f23 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.9 * scaledPos), 2.0)), 0.0) * 0.21;
          vec2 uvx = mix(uv, uvd, -0.5);
          float f4  = max(0.01 - pow(length(uvx + 0.4 * scaledPos), 2.4), 0.0) * 6.0;
          float f42 = max(0.01 - pow(length(uvx + 0.45 * scaledPos), 2.4), 0.0) * 5.0;
          float f43 = max(0.01 - pow(length(uvx + 0.5 * scaledPos), 2.4), 0.0) * 3.0;
          vec3 c = vec3(f2+f4, f22+f42, f23+f43) * distanceFactor;
          return vec4(max(vec3(0.0), c * 1.3 - vec3(length(uvd) * 0.05)), f0);
      }
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
      float dither4x4(vec2 p, float b) {
        int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
        float m[16]; m[0]=0.0625; m[1]=0.5625; m[2]=0.1875; m[3]=0.6875; m[4]=0.8125; m[5]=0.3125; m[6]=0.9375; m[7]=0.4375; m[8]=0.25; m[9]=0.75; m[10]=0.125; m[11]=0.625; m[12]=1.0; m[13]=0.5; m[14]=0.875; m[15]=0.375;
        return b < m[x + y * 4] ? 0.0 : 1.0;
      }
      vec3 renderScene(vec3 ro, vec3 rd, vec3 sunDir) {
          float t = 0.0; float d = 0.0; float maxDist = 150.0;
          for(int i=0; i<100; i++) { d = map(ro + rd*t); t += d * 0.75; if(d<0.01 || t>maxDist) break; }
          vec3 col = vec3(0.0);
          if(t < maxDist) {
              vec3 p = ro + rd*t; vec3 n = getNormal(p); vec3 ref = reflect(rd, n);
              float fresnel = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(n, -rd)), 5.0);
              col = uSssBaseColor * (0.002 + 0.1*max(0.0, dot(n, sunDir)));
              col = mix(col, getSky(ref, sunDir, false), fresnel * 0.95);
              float sss = pow(max(0.0, dot(n, -sunDir)), 2.0) * smoothstep(-0.2, uWaveHeight, p.y);
              col += uSssTipColor * sss * uSssStrength * 3.0;
              if (uEnableReflections > 0.5) {
                  float spec = pow(max(0.0, dot(ref, sunDir)), 1.0 / max(0.0001, uReflectionWidth * uReflectionWidth));
                  col += uSssTipColor * spec * uReflectionStrength;
              }
              if(uEnableGrid > 0.5) {
                  float grid = step(0.97, fract(p.x*0.5)) + step(0.97, fract(p.z*0.5));
                  col += uSssTipColor * grid * smoothstep(50.0, 0.0, t) * 2.0;
              }
              col = mix(col, getSky(rd, sunDir, true), smoothstep(maxDist * (1.0 - max(0.001, uHorizonFade)), maxDist, t));
          } else { col = getSky(rd, sunDir, true); }
          return col;
      }
      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
        vec3 ro = vec3(0.0, uCameraHeight, uTime * (uFlySpeed * 2.0 + 1.0));
        vec3 ta = ro + vec3(0.0, uCameraTilt, 10.0);
        vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = normalize(cross(uu, ww));
        vec3 sunDir = normalize(vec3(uSunPosX, uSunPosY, 1.0));
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
        vec3 col = renderScene(ro, rd, sunDir);
        if(uEnableFX > 0.5 && uDustStrength > 0.0) col += uSssTipColor * smoothstep(0.9, 1.0, noise3D(rd*8.0-vec3(0.0,uTime*0.3,0.0))) * uDustStrength;
        if (uEnableFX > 0.5 && uFlareIntensity > 0.0) {
            vec3 sunView = vec3(dot(sunDir, uu), dot(sunDir, vv), dot(sunDir, ww));
            if (sunView.z > 0.0) {
                vec2 sunSP = sunView.xy * 1.5;
                float sunRad = tan(acos(clamp(0.99 - uSunSize * 0.03, 0.0, 1.0))) * 1.5;
                vec2 flareSrc = sunSP + vec2(cos(uFlareAngle*PI/180.0), sin(uFlareAngle*PI/180.0)) * sunRad;
                vec4 fD = lensflares(uv, flareSrc, uFlareGhosting, uMousePos*0.15);
                vec3 finalF = (fD.rgb * uFlareGhosting + anflares_optimized(uv, flareSrc, uFlareStreak) + fD.a*0.5);
                col += max(vec3(0.0), finalF * uFlareIntensity * mix(vec3(0.64,0.49,0.87), uSssTipColor, 0.7));
            }
        }
        
        // --- 核心：始终执行 Retro Dither 效果 ---
        float brightness = dot(col, vec3(0.299, 0.587, 0.114));
        float d = dither4x4(gl_FragCoord.xy, brightness * 1.5);
        col = uSssTipColor * d;

        col = filmic(col);
        col *= 1.0 - length(uv * uVignetteStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

// ============ 5. ENGINE SETUP ============
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
document.body.appendChild(renderer.domElement);

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uMousePos: { value: mousePos },
  uCameraHeight: { value: 4.0 },
  uCameraTilt: { value: -0.1 }
};

Object.entries(params).forEach(([key, val]) => {
  if (key === "activePreset") return;
  const uName = `u${key.charAt(0).toUpperCase() + key.slice(1)}`;
  uniforms[uName] = { value: key.includes("Color") ? new THREE.Color(val) : val };
});

const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ fragmentShader, uniforms }));
scene.add(mesh);

// ============ 6. PRESET APPLY (INIT NIGHT) ============
function applyPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  Object.assign(params, p);
  // 强制锁定视觉模式
  params.style = 2;
  params.enableGrid = true;
  
  Object.entries(p).forEach(([k, v]) => {
    const uN = `u${k.charAt(0).toUpperCase() + k.slice(1)}`;
    if (uniforms[uN]) uniforms[uN].value = k.includes("Color") ? new THREE.Color(v) : v;
  });
}

applyPreset("Night"); // 初始状态严格设为 Night

// ============ 7. SCROLL INTERPOLATION (NIGHT -> SUNNY) ============
window.addEventListener("scroll", () => {
  const sH = document.documentElement.scrollHeight - window.innerHeight;
  const progress = Math.min(1, Math.max(0, window.scrollY / sH));
  const eased = progress * progress * (3 - 2 * progress);

  const start = PRESETS.Night;
  const end = PRESETS.Sunny;

  Object.keys(start).forEach(key => {
    const uN = `u${key.charAt(0).toUpperCase() + key.slice(1)}`;
    if (uniforms[uN]) {
      if (typeof start[key] === "number") {
        // 直接更新 Uniform，不要更新 params
        uniforms[uN].value = lerp(start[key], end[key], eased);
      } else if (typeof start[key] === "string" && start[key].startsWith("#")) {
        // 直接更新颜色
        uniforms[uN].value.copy(lerpColor(start[key], end[key], eased));
      }
    }
  });

  // 相机动画也直接操作 uniforms
  uniforms.uCameraHeight.value = 4.0 - (4.0 - 1.5) * eased;
  uniforms.uCameraTilt.value = -0.1 + (2.5 - (-0.1)) * eased;
}, { passive: true });

window.addEventListener("mousemove", e => {
  mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
  mousePos.y = (e.clientY / window.innerHeight) * 2 - 1;
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

function animate(t) {
  uniforms.uTime.value = t * 0.001;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate(0);