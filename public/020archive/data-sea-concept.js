import * as THREE from "../libs/three.module.min.js";

const host = document.getElementById("dataSeaCanvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const viewCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
viewCamera.position.set(0, 4.65, 8.7);
viewCamera.lookAt(0, -0.3, -2.5);
viewCamera.updateMatrixWorld(true);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const createGlyphAtlas = () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const atlasGrid = 8;
  const cellSize = 64;
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=?!";
  canvas.width = atlasGrid * cellSize;
  canvas.height = atlasGrid * cellSize;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.font = '700 43px "supplyMono", monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (let row = 0; row < atlasGrid; row += 1) {
    for (let column = 0; column < atlasGrid; column += 1) {
      const glyph = glyphs[(row * atlasGrid + column) % glyphs.length];
      context.fillText(
        glyph,
        column * cellSize + cellSize * 0.5,
        row * cellSize + cellSize * 0.52
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
};

const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
  viewCamera.quaternion
);
const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
  viewCamera.quaternion
);
const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
  viewCamera.quaternion
);
const uniforms = {
  time: { value: 0 },
  fieldSeed: { value: Math.random() * 1000 },
  glyphAtlas: { value: createGlyphAtlas() },
  aspect: { value: 1 },
  tanHalfFov: {
    value: Math.tan(THREE.MathUtils.degToRad(viewCamera.fov * 0.5)),
  },
  viewPosition: { value: viewCamera.position.clone() },
  viewRight: { value: cameraRight },
  viewUp: { value: cameraUp },
  viewForward: { value: cameraForward },
  groundY: { value: -1.25 },
};

const material = new THREE.ShaderMaterial({
  name: "DATA_SEA_INFINITE_FIELD_STUDY",
  uniforms,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform float fieldSeed;
    uniform float aspect;
    uniform float tanHalfFov;
    uniform float groundY;
    uniform sampler2D glyphAtlas;
    uniform vec3 viewPosition;
    uniform vec3 viewRight;
    uniform vec3 viewUp;
    uniform vec3 viewForward;
    varying vec2 vUv;

    float hash21(vec2 point) {
      return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
    }

    float valueNoise(vec2 point) {
      vec2 cell = floor(point);
      vec2 local = fract(point);
      local = local * local * (3.0 - 2.0 * local);
      float a = hash21(cell);
      float b = hash21(cell + vec2(1.0, 0.0));
      float c = hash21(cell + vec2(0.0, 1.0));
      float d = hash21(cell + vec2(1.0, 1.0));
      return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
    }

    float fbm(vec2 point) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int octave = 0; octave < 5; octave++) {
        value += valueNoise(point) * amplitude;
        point = mat2(1.72, 1.08, -1.08, 1.72) * point + vec2(4.7, 8.3);
        amplitude *= 0.5;
      }
      return value;
    }

    float dataHeight(vec2 point, float clock) {
      vec2 seedOffset = vec2(fieldSeed * 0.071, -fieldSeed * 0.043);
      point += seedOffset;
      vec2 directedDrift = vec2(-clock * 0.018, -clock * 0.092);
      vec2 broadPoint = point * 0.145 + directedDrift;
      vec2 warp = vec2(
        fbm(broadPoint + vec2(5.2, 1.7)),
        fbm(broadPoint + vec2(-3.8, 9.4))
      ) - 0.5;
      float broadField = fbm(broadPoint + warp * 1.85);
      float brokenField = fbm(
        point * 0.31 +
        warp * 0.82 +
        vec2(clock * 0.014, -clock * 0.128)
      );
      float detailField = fbm(
        point * 0.58 +
        vec2(-clock * 0.026, -clock * 0.17)
      );
      return clamp(
        broadField * 0.68 + brokenField * 0.24 + detailField * 0.08,
        0.0,
        1.0
      );
    }

    void main() {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec3 rayDirection = normalize(
        viewForward +
        viewRight * ndc.x * aspect * tanHalfFov +
        viewUp * ndc.y * tanHalfFov
      );

      if (rayDirection.y >= -0.0001) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      float rayDistance = (groundY - viewPosition.y) / rayDirection.y;
      if (rayDistance <= 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec3 groundPoint = viewPosition + rayDirection * rayDistance;
      vec2 ground = groundPoint.xz;
      vec2 seedOffset = vec2(fieldSeed * 0.071, -fieldSeed * 0.043);
      float heightField = dataHeight(ground, time);
      float edgeVariation = valueNoise(
        ground * 1.72 +
        seedOffset * 1.37 +
        vec2(time * 0.025, -time * 0.16)
      ) - 0.5;
      float redPresence = smoothstep(
        0.468,
        0.548,
        heightField + edgeVariation * 0.035
      );

      if (redPresence < 0.006) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      const float gridDensity = 3.15;
      vec2 characterFlow = vec2(-time * 0.24, -time * 0.68);
      vec2 gridPosition = ground * gridDensity + characterFlow;
      vec2 cellId = floor(gridPosition);
      vec2 cellUv = fract(gridPosition);
      float cellPhase = hash21(cellId + seedOffset * 1.37);
      float glitchRate = mix(
        0.24,
        0.72,
        hash21(cellId * 0.41 + seedOffset * 2.11)
      );
      float glitchTime = time * glitchRate + cellPhase * 6.0;
      float glitchSlot = floor(glitchTime);
      float glitchProgress = fract(glitchTime);
      float burstChance = hash21(
        vec2(glitchSlot + fieldSeed, cellPhase * 31.0)
      );
      float burstStep = step(0.78, burstChance) *
        floor(glitchProgress * 4.0);
      float packet = glitchSlot * 5.0 + burstStep;
      float glyphSeed = hash21(
        cellId +
        seedOffset * 0.83 +
        vec2(packet * 0.67, -packet * 1.09)
      );
      float glyphIndex = floor(glyphSeed * 48.0);
      vec2 atlasCell = vec2(
        mod(glyphIndex, 8.0),
        7.0 - floor(glyphIndex / 8.0)
      );
      float glyph = texture2D(
        glyphAtlas,
        (atlasCell + vec2(cellUv.x, 1.0 - cellUv.y)) / 8.0
      ).r;

      float crest = smoothstep(0.61, 0.86, heightField);
      vec3 deepRed = vec3(0.24, 0.0015, 0.018);
      vec3 bloodRed = vec3(0.78, 0.006, 0.045);
      vec3 peakRed = vec3(1.0, 0.018, 0.072);
      vec3 surfaceColor = mix(deepRed, bloodRed, redPresence);
      surfaceColor = mix(surfaceColor, peakRed, crest);
      float redFront = smoothstep(0.015, 0.12, redPresence) *
        (1.0 - smoothstep(0.12, 0.34, redPresence));
      surfaceColor = mix(surfaceColor, peakRed, redFront * 0.58);

      float cellEdge = min(
        min(cellUv.x, 1.0 - cellUv.x),
        min(cellUv.y, 1.0 - cellUv.y)
      );
      float cellBody = smoothstep(0.008, 0.03, cellEdge);
      surfaceColor *= mix(0.56, 1.0, cellBody);
      vec3 color = mix(surfaceColor, vec3(0.001, 0.0, 0.0005), glyph * 0.94);

      float distanceFade = 1.0 - smoothstep(34.0, 92.0, rayDistance);
      float redCoverage = smoothstep(0.006, 0.085, redPresence);
      color *= distanceFade * redCoverage;
      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `,
});

const scene = new THREE.Scene();
const screenCamera = new THREE.Camera();
const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
screen.frustumCulled = false;
scene.add(screen);

const resize = () => {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  renderer.setSize(width, height, false);
  uniforms.aspect.value = width / height;
};

const clock = new THREE.Clock();
const animate = () => {
  uniforms.time.value = reducedMotion ? 0 : clock.getElapsedTime();
  renderer.render(scene, screenCamera);
  window.requestAnimationFrame(animate);
};

window.addEventListener("resize", resize, { passive: true });
resize();
animate();
