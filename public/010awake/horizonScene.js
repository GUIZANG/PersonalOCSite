// Shared raymarched horizon renderer. A single WebGL scene whose final image is
// quantized to an ordered-dither, single-tint frame. Reused by:
//   - moonAnimation.js : full-page background, scroll-driven Night -> Sunny.
//   - awakeOverlay.js : overlay background, static Synthwave preset.
// The shader source lives here once so it is not duplicated across features.

export const HORIZON_PRESETS = {
  Night: {
    sunPosX: 0.0, sunPosY: 0.3, sunSize: 0.9, sunIntensity: 3.0,
    horizonColor: "#0a0a15", cloudDensity: 0.3, cloudColor: "#101018",
    waveHeight: 0.2, speed: 0.2,
    sssBaseColor: "#000005", sssTipColor: "#8888aa",
    reflectionStrength: 2.5, reflectionWidth: 0.015,
    haloStrength: 1.5, haloRadius: 0.3, haloSize: 0.02, vignetteStrength: 0.65,
    flareIntensity: 0.0, flareGhosting: 0.8, flareStreak: 1.0, flareAngle: 140,
    enableGrid: 0.0,
  },
  Sunny: {
    sunPosX: 0.0, sunPosY: 0.1, sunSize: 0.9, sunIntensity: 4.0,
    horizonColor: "#00bbff", cloudDensity: 0.3, cloudColor: "#ffffff",
    waveHeight: 0.25, speed: 0.4,
    sssBaseColor: "#001a33", sssTipColor: "#0099ff",
    reflectionStrength: 3.0, reflectionWidth: 0.1,
    haloStrength: 0.2, haloRadius: 0.3, haloSize: 0.02, vignetteStrength: 0.2,
    flareIntensity: 0.3, flareGhosting: 0.5, flareStreak: 3.0, flareAngle: 140,
    enableGrid: 0.0,
  },
  Twilight: {
    sunPosX: 0.0, sunPosY: -0.05, sunSize: 2.5, sunIntensity: 2.0,
    horizonColor: "#1a0a20", cloudDensity: 0.4, cloudColor: "#2a1a30",
    waveHeight: 0.3, speed: 0.25,
    sssBaseColor: "#050008", sssTipColor: "#6644aa",
    reflectionStrength: 1.8, reflectionWidth: 0.08,
    haloStrength: 0.8, haloRadius: 0.4, haloSize: 0.025, vignetteStrength: 0.55,
    flareIntensity: 1.2, flareGhosting: 1.0, flareStreak: 1.5, flareAngle: 140,
    enableGrid: 1.0,
  },
  Synthwave: {
    sunPosX: 0.0, sunPosY: -0.04, sunSize: 0.6, sunIntensity: 3.5,
    horizonColor: "#2b1055", cloudDensity: 0.12, cloudColor: "#5a1a8a",
    waveHeight: 0.22, speed: 0.38,
    sssBaseColor: "#08001a", sssTipColor: "#ff2a6d",
    reflectionStrength: 3.2, reflectionWidth: 0.05,
    haloStrength: 1.1, haloRadius: 0.38, haloSize: 0.018, vignetteStrength: 0.48,
    flareIntensity: 1.4, flareGhosting: 1.3, flareStreak: 0.0, flareAngle: 140,
    enableGrid: 1.0,
  },
};

export const horizonFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMousePos;
      uniform float uCameraHeight;
      uniform float uCameraTilt;
      uniform float uWaveHeight;
      uniform float uSpeed;
      uniform vec3 uSssBaseColor;
      uniform vec3 uSssTipColor;
      uniform float uSunSize;
      uniform float uSunIntensity;
      uniform float uSunPosX;
      uniform float uSunPosY;
      uniform float uReflectionStrength;
      uniform float uReflectionWidth;
      uniform float uCloudDensity;
      uniform vec3 uCloudColor;
      uniform vec3 uHorizonColor;
      uniform float uHaloStrength;
      uniform float uHaloRadius;
      uniform float uHaloSize;
      uniform float uVignetteStrength;
      uniform float uFlareIntensity;
      uniform float uFlareGhosting;
      uniform float uFlareStreak;
      uniform float uFlareAngle;
      uniform float uEnableGrid;

      #define PI 3.14159265359

      const float FLY_SPEED = 0.3;
      const float CHOPPINESS = 2.5;
      const float SSS_STRENGTH = 2.0;
      const float CLOUD_SPEED = 0.05;
      const float HORIZON_FADE = 0.05;
      const float DUST = 1.0;

      float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i+vec2(0,0)), h21(i+vec2(1,0)), f.x),
                     mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
      }

      float vnoise3(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          float n = dot(i, vec3(1.0, 57.0, 113.0));
          return mix(mix(mix(h21(vec2(n+0.0)), h21(vec2(n+1.0)), f.x),
                         mix(h21(vec2(n+57.0)), h21(vec2(n+58.0)), f.x), f.y),
                     mix(mix(h21(vec2(n+113.0)), h21(vec2(n+114.0)), f.x),
                         mix(h21(vec2(n+170.0)), h21(vec2(n+171.0)), f.x), f.y), f.z);
      }

      float terrainFbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for(int i=0; i<3; i++) { v += a * vnoise(p); p = rot * p * 2.0; a *= 0.5; }
          return v;
      }

      float cloudFbm(vec2 p) {
          float f = 0.0;
          f += 0.50000 * vnoise(p); p = p * 2.02;
          f += 0.25000 * vnoise(p); p = p * 2.03;
          f += 0.12500 * vnoise(p);
          return f;
      }

      float surfaceSDF(vec3 p) {
          vec2 q = p.xz * 0.35;
          float h = 0.0;
          float a = 0.6 * uWaveHeight;
          q += vec2(terrainFbm(q + uTime * 0.05), terrainFbm(q)) * CHOPPINESS;
          for(int i=0; i<3; i++) {
              float ang = float(i) * 0.6;
              vec2 dir = normalize(vec2(sin(ang), cos(ang) * 1.5));
              float wave = 1.0 - abs(sin(dot(q, dir) - uTime * uSpeed + float(i)));
              wave = pow(wave, 3.0); h += a * wave;
              a *= 0.5; q *= 1.8; q.x += 1.0;
          }
          return p.y - h;
      }

      vec3 surfaceNormal(vec3 p) {
          float eps = 0.01 + uWaveHeight * 0.02;
          vec2 e = vec2(eps, 0.0);
          return normalize(vec3(surfaceSDF(p+e.xyy) - surfaceSDF(p-e.xyy), e.x * 2.0, surfaceSDF(p+e.yyx) - surfaceSDF(p-e.yyx)));
      }

      vec3 sampleSky(vec3 rd, vec3 sunDir, bool renderSun) {
          float sunDot = max(0.0, dot(rd, sunDir));
          vec3 zenithCol = vec3(0.0, 0.0, 0.02);
          vec3 skyCol = mix(uHorizonColor, zenithCol, pow(max(0.0, rd.y + 0.05), 0.5));
          float occlusion = 0.0;
          if (uCloudDensity > 0.0 && rd.y > 0.0 && rd.y < 0.45) {
             vec2 skyUV = rd.xz / max(0.05, rd.y);
             skyUV.x += uTime * CLOUD_SPEED;
             float cl = cloudFbm(skyUV * 0.15);
             float heightMask = smoothstep(0.0, 0.1, rd.y) * smoothstep(0.45, 0.1, rd.y);
             float cloudIntensity = smoothstep(0.3, 0.7, cl) * heightMask * uCloudDensity;
             skyCol = mix(skyCol, uCloudColor, cloudIntensity);
             occlusion = cloudIntensity;
          }
          float sunRadiusThreshold = 0.99 - (uSunSize * 0.03);
          float sun = (uSunSize < 0.1) ? 0.0 : smoothstep(sunRadiusThreshold, sunRadiusThreshold + 0.002, sunDot);
          float glow = (uSunSize < 0.1) ? 0.0 : pow(sunDot, 12.0 / uSunSize);
          float sunVis = 1.0 - clamp(occlusion * 1.5, 0.0, 0.9);
          vec3 sunCol = uSssTipColor * uSunIntensity * sunVis;
          skyCol += glow * sunCol * 1.5;
          if (renderSun) { skyCol += sun * sunCol * 8.0; }
          if (uHaloStrength > 0.0) {
              float baseR = 1.0 - uHaloRadius * 0.2;
              float ringR = smoothstep(uHaloSize, 0.0, abs(sunDot - baseR));
              float ringG = smoothstep(uHaloSize+0.005, 0.0, abs(sunDot - (baseR + 0.005)));
              float ringB = smoothstep(uHaloSize+0.010, 0.0, abs(sunDot - (baseR + 0.010)));
              skyCol += vec3(ringR, ringG, ringB) * uHaloStrength * 0.5 * (1.0 - occlusion * 0.5);
          }
          return skyCol;
      }

      vec4 lensFlare(vec2 uv, vec2 pos, float ghostingScale, vec2 parallaxShift) {
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

      vec3 anamorphic(vec2 uv, vec2 pos, float streakIntensity) {
          vec2 d = uv - pos;
          float v = smoothstep(0.02, 0.0, abs(d.y));
          float hb = smoothstep(1.0, 0.0, abs(d.x) / 1.5);
          return vec3(v * hb) * streakIntensity * 0.8;
      }

      vec3 tonemap(vec3 x) {
        vec3 a = max(vec3(0.0), x - vec3(0.004));
        return (a * (6.2 * a + 0.5)) / (a * (6.2 * a + 1.7) + 0.06);
      }

      float bayer4(vec2 p, float b) {
        int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
        float m[16]; m[0]=0.0625; m[1]=0.5625; m[2]=0.1875; m[3]=0.6875; m[4]=0.8125; m[5]=0.3125; m[6]=0.9375; m[7]=0.4375; m[8]=0.25; m[9]=0.75; m[10]=0.125; m[11]=0.625; m[12]=1.0; m[13]=0.5; m[14]=0.875; m[15]=0.375;
        return b < m[x + y * 4] ? 0.0 : 1.0;
      }

      vec3 march(vec3 ro, vec3 rd, vec3 sunDir) {
          float t = 0.0; float d = 0.0; float maxDist = 150.0;
          for(int i=0; i<100; i++) { d = surfaceSDF(ro + rd*t); t += d * 0.75; if(d<0.01 || t>maxDist) break; }
          vec3 col = vec3(0.0);
          if(t < maxDist) {
              vec3 p = ro + rd*t; vec3 n = surfaceNormal(p); vec3 ref = reflect(rd, n);
              float fresnel = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(n, -rd)), 5.0);
              col = uSssBaseColor * (0.002 + 0.1*max(0.0, dot(n, sunDir)));
              col = mix(col, sampleSky(ref, sunDir, false), fresnel * 0.95);
              float sss = pow(max(0.0, dot(n, -sunDir)), 2.0) * smoothstep(-0.2, uWaveHeight, p.y);
              col += uSssTipColor * sss * SSS_STRENGTH * 3.0;
              float spec = pow(max(0.0, dot(ref, sunDir)), 1.0 / max(0.0001, uReflectionWidth * uReflectionWidth));
              col += uSssTipColor * spec * uReflectionStrength;
              if (uEnableGrid > 0.5) {
                  float grid = step(0.97, fract(p.x*0.5)) + step(0.97, fract(p.z*0.5));
                  col += uSssTipColor * grid * smoothstep(50.0, 0.0, t) * 2.0;
              }
              col = mix(col, sampleSky(rd, sunDir, true), smoothstep(maxDist * (1.0 - max(0.001, HORIZON_FADE)), maxDist, t));
          } else { col = sampleSky(rd, sunDir, true); }
          return col;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
        vec3 ro = vec3(0.0, uCameraHeight, uTime * (FLY_SPEED * 2.0 + 1.0));
        vec3 ta = ro + vec3(0.0, uCameraTilt, 10.0);
        vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = normalize(cross(uu, ww));
        vec3 sunDir = normalize(vec3(uSunPosX, uSunPosY, 1.0));
        vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
        vec3 col = march(ro, rd, sunDir);
        col += uSssTipColor * smoothstep(0.9, 1.0, vnoise3(rd*8.0-vec3(0.0,uTime*0.3,0.0))) * DUST;
        if (uFlareIntensity > 0.0) {
            vec3 sunView = vec3(dot(sunDir, uu), dot(sunDir, vv), dot(sunDir, ww));
            if (sunView.z > 0.0) {
                vec2 sunSP = sunView.xy * 1.5;
                float sunRad = tan(acos(clamp(0.99 - uSunSize * 0.03, 0.0, 1.0))) * 1.5;
                vec2 flareSrc = sunSP + vec2(cos(uFlareAngle*PI/180.0), sin(uFlareAngle*PI/180.0)) * sunRad;
                vec4 fD = lensFlare(uv, flareSrc, uFlareGhosting, uMousePos*0.15);
                vec3 finalF = (fD.rgb * uFlareGhosting + anamorphic(uv, flareSrc, uFlareStreak) + fD.a*0.5);
                col += max(vec3(0.0), finalF * uFlareIntensity * mix(vec3(0.64,0.49,0.87), uSssTipColor, 0.7));
            }
        }

        float brightness = dot(col, vec3(0.299, 0.587, 0.114));
        float dth = bayer4(gl_FragCoord.xy, brightness * 1.5);
        col = uSssTipColor * dth;

        col = tonemap(col);
        col *= 1.0 - length(uv * uVignetteStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

const toUniformName = (key) => `u${key.charAt(0).toUpperCase()}${key.slice(1)}`;

// Build a self-contained renderer inside `container`. It owns its own time
// loop, resize and pointer handling; callers only drive the preset/camera.
export function createHorizonScene({ container = document.body } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
  container.appendChild(renderer.domElement);

  const pointer = new THREE.Vector2(0, 0);
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMousePos: { value: pointer },
    uCameraHeight: { value: 4.0 },
    uCameraTilt: { value: -0.1 },
  };

  for (const [key, val] of Object.entries(HORIZON_PRESETS.Night)) {
    uniforms[toUniformName(key)] = {
      value: key.includes("Color") ? new THREE.Color(val) : val,
    };
  }

  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ fragmentShader: horizonFragmentShader, uniforms })
  ));

  function applyPreset(name) {
    const preset = HORIZON_PRESETS[name];
    if (!preset) return;
    for (const [key, val] of Object.entries(preset)) {
      const target = uniforms[toUniformName(key)];
      if (!target) continue;
      target.value = key.includes("Color") ? new THREE.Color(val) : val;
    }
  }

  function lerpPreset(startName, endName, t) {
    const start = HORIZON_PRESETS[startName];
    const end = HORIZON_PRESETS[endName];
    if (!start || !end) return;
    for (const key of Object.keys(start)) {
      const target = uniforms[toUniformName(key)];
      if (!target) continue;
      if (typeof start[key] === "number") {
        target.value = start[key] + (end[key] - start[key]) * t;
      } else if (typeof start[key] === "string" && start[key].startsWith("#")) {
        target.value.copy(new THREE.Color(start[key]).lerp(new THREE.Color(end[key]), t));
      }
    }
  }

  function setCamera(height, tilt) {
    uniforms.uCameraHeight.value = height;
    uniforms.uCameraTilt.value = tilt;
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  function onMouse(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("mousemove", onMouse);

  let running = true;
  let frameId = null;

  function animate(t) {
    uniforms.uTime.value = t * 0.001;
    renderer.render(scene, camera);
    frameId = running ? requestAnimationFrame(animate) : null;
  }

  function start() {
    if (running && frameId) return;
    running = true;
    if (!frameId) frameId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
  }

  frameId = requestAnimationFrame(animate);

  return { uniforms, applyPreset, lerpPreset, setCamera, start, stop, renderer, canvas: renderer.domElement };
}
