import * as THREE from "three";
import { GLTFLoader } from "../libs/three/loaders/GLTFLoader.js";
import { RoomEnvironment } from "../libs/three/environments/RoomEnvironment.js";

// Cache-bust the hand-edited industrial detail pass. Keeping the revision in
// the asset URL prevents an older carousel from surviving a normal reload.
const MODEL_URL = "/assets/models/cardstream/cardstreamCarousel.glb?v=20260813-detail-stack-01";
const THEMES = [
  ["01", "SIGNAL", "FIELD TRACE", "LOCKED"],
  ["02", "VECTOR", "MOTION DATUM", "PROJECTED"],
  ["03", "ORACLE", "OCULAR RESIDUE", "OBSERVING"],
  ["04", "NOESIS", "MEMORY STRATA", "RECURSIVE"],
];

class ArchiveCardModel {
  constructor(host) {
    this.host = host;
    this.active = false;
    this.position = 0;
    this.themeIndex = 0;
    this.rig = null;
    this.modelRoot = null;
    this.baseRotation = 0;
    this.rootBaseY = 0;
    this.rootDisplayOffsetY = 0.28;
    this.cameraBasePosition = new THREE.Vector3();
    this.cameraOrbitRadius = 1;
    this.cameraOrbitAzimuth = 0;
    this.cameraBaseElevation = 0;
    this.targetCameraOrbit = 0;
    this.currentCameraOrbit = 0;
    this.cameraOrbitVelocity = 0;
    this.cameraOrbitReturning = false;
    this.interacting = false;
    this.autoBlend = 1;
    this.autoStartedAt = 0;
    this.lastFrameTime = 0;
    this.screenMaterials = [];
    this.cableDynamics = [];
    this.lastRigRotation = null;
    this.rigAngularVelocity = 0;
    this.renderFrame = 0;
    this.thermalEnabled = false;
    this.thermalAmount = 0;
    this.thermalGlitchSeed = Math.random() * 1000;
    this.dataSeaReveal = 0;
    this.dataSeaRevealTarget = 0;
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    // A restrained lower sampling density keeps the scene closer to degraded
    // broadcast footage than a clinically sharp product render.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.host.appendChild(this.renderer.domElement);
    this.setupDataSea();
    this.setupSignalPostProcess();

    this.target = new THREE.Vector3(0, 2.55, 0);
    this.metalNoise = this.createSurfaceNoise(47, 128, 0.44, 0.92);
    this.rubberNoise = this.createSurfaceNoise(113, 128, 0.34, 0.78);
    this.metalWear = this.createWearTexture(79, 256);
    this.displayFrameTextures = this.loadDisplayFrameTextures();
    this.screenMask = this.createScreenMask(256);
    this.setupEnvironment();
    this.addLights();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    this.load();
  }

  createDataSeaGlyphAtlas() {
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
  }

  setupDataSea() {
    this.dataSeaScene = new THREE.Scene();
    this.dataSeaTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.dataSeaTarget.texture.name = "CARDSTREAM_DATA_SEA";
    this.dataSeaGlyphAtlas = this.createDataSeaGlyphAtlas();
    this.dataSeaUniforms = {
      time: { value: 0 },
      reveal: { value: 0 },
      fieldSeed: { value: Math.random() * 1000 },
      glyphAtlas: { value: this.dataSeaGlyphAtlas },
      aspect: { value: 1 },
      tanHalfFov: {
        value: Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)),
      },
      viewPosition: { value: this.camera.position.clone() },
      viewRight: { value: new THREE.Vector3(1, 0, 0) },
      viewUp: { value: new THREE.Vector3(0, 1, 0) },
      viewForward: { value: new THREE.Vector3(0, 0, -1) },
      flowDirection: { value: new THREE.Vector2(0.63, 0.78).normalize() },
      groundY: { value: -1.05 },
    };
    const material = new THREE.ShaderMaterial({
      name: "CARDSTREAM_DATA_SEA_MATERIAL",
      uniforms: this.dataSeaUniforms,
      transparent: true,
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
        uniform float reveal;
        uniform float fieldSeed;
        uniform float aspect;
        uniform float tanHalfFov;
        uniform float groundY;
        uniform sampler2D glyphAtlas;
        uniform vec3 viewPosition;
        uniform vec3 viewRight;
        uniform vec3 viewUp;
        uniform vec3 viewForward;
        uniform vec2 flowDirection;
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
          vec2 flowNormal = vec2(-flowDirection.y, flowDirection.x);
          vec2 directedDrift =
            -flowDirection * clock * 0.094 +
            flowNormal * clock * 0.006;
          vec2 broadPoint = point * 0.145 + directedDrift;
          vec2 warp = vec2(
            fbm(broadPoint + vec2(5.2, 1.7)),
            fbm(broadPoint + vec2(-3.8, 9.4))
          ) - 0.5;
          float broadField = fbm(broadPoint + warp * 1.85);
          float brokenField = fbm(
            point * 0.31 +
            warp * 0.82 +
            -flowDirection * clock * 0.128 +
            flowNormal * clock * 0.014
          );
          float detailField = fbm(
            point * 0.58 +
            -flowDirection * clock * 0.17 -
            flowNormal * clock * 0.026
          );
          return clamp(
            broadField * 0.68 + brokenField * 0.24 + detailField * 0.08,
            0.0,
            1.0
          );
        }

        void main() {
          float revealAlpha = smoothstep(0.015, 0.16, reveal);
          vec2 ndc = vUv * 2.0 - 1.0;
          vec3 rayDirection = normalize(
            viewForward +
            viewRight * ndc.x * aspect * tanHalfFov +
            viewUp * ndc.y * tanHalfFov
          );

          if (rayDirection.y >= -0.0001) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, revealAlpha * smoothstep(0.86, 1.0, reveal));
            return;
          }

          float rayDistance = (groundY - viewPosition.y) / rayDirection.y;
          if (rayDistance <= 0.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
          }

          vec3 groundPoint = viewPosition + rayDirection * rayDistance;
          vec2 ground = groundPoint.xz;
          vec2 seedOffset = vec2(fieldSeed * 0.071, -fieldSeed * 0.043);
          float heightField = dataHeight(ground, time);
          float edgeVariation = valueNoise(
            ground * 1.72 +
            seedOffset * 1.37 +
            -flowDirection * time * 0.16
          ) - 0.5;
          float redPresence = smoothstep(
            0.468,
            0.548,
            heightField + edgeVariation * 0.035
          );

          const float gridDensity = 3.15;
          vec2 characterFlow = -flowDirection * time * 0.72;
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
          float glyphPacket = glitchSlot * 5.0 + burstStep;
          float cellSeed = hash21(
            cellId +
            seedOffset * 0.83 +
            vec2(glyphPacket * 0.67, -glyphPacket * 1.09)
          );
          float glyphIndex = floor(cellSeed * 48.0);
          vec2 atlasCell = vec2(mod(glyphIndex, 8.0), 7.0 - floor(glyphIndex / 8.0));
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
          vec3 color = mix(
            surfaceColor,
            vec3(0.001, 0.0, 0.0005),
            glyph * 0.94
          );

          float distanceFade = 1.0 - smoothstep(34.0, 92.0, rayDistance);
          float redCoverage = smoothstep(0.006, 0.085, redPresence);
          color *= distanceFade * redCoverage;

          float revealDistance = length(vec2(ground.x * 0.72, ground.y));
          float revealNoise = (heightField - 0.5) * 1.4;
          float revealEdge = mix(-0.5, 15.5, reveal);
          float radialReveal = 1.0 - smoothstep(
            revealEdge - 0.75,
            revealEdge + 0.4,
            revealDistance + revealNoise
          );
          float revealMask = mix(
            radialReveal,
            1.0,
            smoothstep(0.86, 1.0, reveal)
          );
          gl_FragColor = vec4(
            max(color, vec3(0.0)),
            revealAlpha * revealMask
          );
        }
      `,
    });
    this.dataSea = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.dataSea.name = "CARDSTREAM_DATA_SEA";
    this.dataSea.frustumCulled = false;
    this.dataSeaScene.add(this.dataSea);
  }

  updateDataSeaViewUniforms() {
    if (!this.dataSeaUniforms) return;
    this.camera.updateMatrixWorld(true);
    this.dataSeaUniforms.aspect.value = this.camera.aspect;
    this.dataSeaUniforms.tanHalfFov.value = Math.tan(
      THREE.MathUtils.degToRad(this.camera.fov * 0.5)
    );
    this.dataSeaUniforms.viewPosition.value.copy(this.camera.position);
    this.dataSeaUniforms.viewRight.value
      .set(1, 0, 0)
      .applyQuaternion(this.camera.quaternion);
    this.dataSeaUniforms.viewUp.value
      .set(0, 1, 0)
      .applyQuaternion(this.camera.quaternion);
    this.dataSeaUniforms.viewForward.value
      .set(0, 0, -1)
      .applyQuaternion(this.camera.quaternion);
    this.dataSeaUniforms.flowDirection.value
      .set(
        this.camera.position.x - this.target.x,
        this.camera.position.z - this.target.z
      )
      .normalize();
  }

  setupSignalPostProcess() {
    this.signalTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.signalTarget.texture.name = "CARDSTREAM_SIGNAL_TARGET";
    this.signalUniforms = {
      tDiffuse: { value: this.signalTarget.texture },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      name: "CARDSTREAM_SIGNAL_HAZE",
      uniforms: this.signalUniforms,
      transparent: false,
      blending: THREE.NoBlending,
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
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float time;
        varying vec2 vUv;

        float signalNoise(vec2 point) {
          return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 pixel = 1.0 / max(resolution, vec2(1.0));
          float drift = sin(vUv.y * 212.0 + time * 1.7) * pixel.x * 0.32;
          vec2 uv = vUv + vec2(drift, 0.0);
          vec4 source = texture2D(tDiffuse, uv);

          vec4 leftNear = texture2D(tDiffuse, uv - vec2(pixel.x * 1.35, 0.0));
          vec4 rightNear = texture2D(tDiffuse, uv + vec2(pixel.x * 1.35, 0.0));
          vec4 upNear = texture2D(tDiffuse, uv + vec2(0.0, pixel.y * 1.2));
          vec4 downNear = texture2D(tDiffuse, uv - vec2(0.0, pixel.y * 1.2));
          vec3 soft = source.rgb * 0.48 +
            (leftNear.rgb + rightNear.rgb + upNear.rgb + downNear.rgb) * 0.13;

          vec3 separated = vec3(
            texture2D(tDiffuse, uv + vec2(pixel.x * 1.8, 0.0)).r,
            soft.g,
            texture2D(tDiffuse, uv - vec2(pixel.x * 1.55, 0.0)).b
          );
          vec3 color = mix(soft, separated, 0.48);

          vec4 ghostSample = texture2D(
            tDiffuse,
            uv + vec2(pixel.x * 3.2, pixel.y * 1.35)
          );
          color += ghostSample.rgb * vec3(0.18, 0.055, 0.075);

          vec3 halo = (
            texture2D(tDiffuse, uv + vec2(pixel.x * 9.0, 0.0)).rgb +
            texture2D(tDiffuse, uv - vec2(pixel.x * 9.0, 0.0)).rgb +
            texture2D(tDiffuse, uv + vec2(0.0, pixel.y * 7.5)).rgb +
            texture2D(tDiffuse, uv - vec2(0.0, pixel.y * 7.5)).rgb
          ) * 0.25;
          float bloom = smoothstep(0.11, 0.65, max(halo.r, max(halo.g, halo.b)));
          color += halo * bloom * vec3(0.78, 0.2, 0.25);

          // Lift information out of the middle shadows without flattening the
          // true black background. Haze should obscure edges, not erase them.
          color = pow(max(color, vec3(0.0)), vec3(0.78));

          float scanline = 0.925 + 0.075 * sin(vUv.y * resolution.y * 3.14159265);
          float coarseBand = 0.975 + 0.025 * sin(vUv.y * 104.0 - time * 0.52);
          color *= scanline * coarseBand;
          float vignette = 1.0 - smoothstep(0.24, 0.78, length((vUv - 0.5) * vec2(1.0, 0.82)));
          color *= mix(0.9, 1.0, vignette);
          float grain = signalNoise(floor(vUv * resolution * 0.54) + floor(time * 18.0));
          color += (grain - 0.5) * 0.022;
          color *= 1.06;

          float haloAlpha = max(
            max(leftNear.a, rightNear.a),
            max(upNear.a, downNear.a)
          );
          gl_FragColor = vec4(
            max(color, vec3(0.0)),
            max(source.a, haloAlpha * 0.38)
          );
        }
      `,
    });
    this.signalScene = new THREE.Scene();
    this.signalCamera = new THREE.Camera();
    this.signalQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.signalQuad.frustumCulled = false;
    this.signalScene.add(this.signalQuad);

    const createPostTarget = (name) => {
      const target = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      });
      target.texture.name = name;
      return target;
    };

    this.signalOutputTarget = createPostTarget("CARDSTREAM_SIGNAL_OUTPUT");
    this.sceneCompositeTarget = createPostTarget("CARDSTREAM_SCENE_COMPOSITE");
    this.historyTargets = [
      createPostTarget("CARDSTREAM_THERMAL_HISTORY_A"),
      createPostTarget("CARDSTREAM_THERMAL_HISTORY_B"),
    ];
    this.historyReadIndex = 0;
    this.historyUniforms = {
      tCurrent: { value: this.signalOutputTarget.texture },
      tHistory: { value: this.historyTargets[0].texture },
      damp: { value: 0 },
    };
    const historyMaterial = new THREE.ShaderMaterial({
      name: "CARDSTREAM_THERMAL_AFTERIMAGE",
      uniforms: this.historyUniforms,
      transparent: false,
      blending: THREE.NoBlending,
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
        uniform sampler2D tCurrent;
        uniform sampler2D tHistory;
        uniform float damp;
        varying vec2 vUv;

        void main() {
          vec4 currentFrame = texture2D(tCurrent, vUv);
          vec4 historyFrame = texture2D(tHistory, vUv);
          vec4 retainedHistory = historyFrame * damp * step(
            vec4(0.1),
            historyFrame
          );
          gl_FragColor = max(currentFrame, retainedHistory);
        }
      `,
    });
    this.historyScene = new THREE.Scene();
    this.historyCamera = new THREE.Camera();
    this.historyQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      historyMaterial
    );
    this.historyQuad.frustumCulled = false;
    this.historyScene.add(this.historyQuad);

    this.presentUniforms = {
      tDiffuse: { value: this.signalOutputTarget.texture },
      tBackground: { value: this.dataSeaTarget.texture },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      thermalAmount: { value: 0 },
      thermalGlitchSeed: { value: this.thermalGlitchSeed },
    };
    const presentMaterial = new THREE.ShaderMaterial({
      name: "CARDSTREAM_SIGNAL_PRESENT",
      uniforms: this.presentUniforms,
      transparent: true,
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
        uniform sampler2D tDiffuse;
        uniform sampler2D tBackground;
        uniform vec2 resolution;
        uniform float time;
        uniform float thermalAmount;
        uniform float thermalGlitchSeed;
        varying vec2 vUv;

        float thermalNoise(vec2 point) {
          return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
        }

        vec4 sampleScene(vec2 uv) {
          vec2 safeUv = clamp(uv, vec2(0.0), vec2(1.0));
          vec4 foreground = texture2D(tDiffuse, safeUv);
          vec4 background = texture2D(tBackground, safeUv);
          float alpha = foreground.a + background.a * (1.0 - foreground.a);
          vec3 premultiplied =
            foreground.rgb * foreground.a +
            background.rgb * background.a * (1.0 - foreground.a);
          vec3 color = alpha > 0.0001 ? premultiplied / alpha : vec3(0.0);
          return vec4(color, alpha);
        }

        void main() {
          vec4 scene = sampleScene(vUv);
          float transitionGate =
            smoothstep(0.015, 0.16, thermalAmount) *
            (1.0 - smoothstep(0.84, 0.985, thermalAmount));
          float bandCount = 8.0 + floor(
            thermalNoise(vec2(thermalGlitchSeed, 3.7)) * 5.0
          );
          float baseBand = floor(vUv.y * bandCount);
          float bandJitter = thermalNoise(
            vec2(baseBand + thermalGlitchSeed * 0.17, 17.4)
          );
          float bandId = floor(
            (vUv.y + (bandJitter - 0.5) * 0.032) * bandCount
          );
          float segmentCount = 3.0 + floor(
            thermalNoise(
              vec2(bandId, 29.1 + thermalGlitchSeed * 0.23)
            ) * 5.0
          );
          float segmentId = floor(vUv.x * segmentCount);
          float sliceSeed = thermalNoise(
            vec2(
              bandId * 13.7 + thermalGlitchSeed * 0.31,
              segmentId + 5.2
            )
          );
          float sliceDirection = step(0.5, sliceSeed) * 2.0 - 1.0;
          float slicePixels = mix(3.0, 12.0, sliceSeed) *
            sliceDirection * transitionGate;
          vec2 thermalUv = vUv + vec2(
            slicePixels / max(resolution.x, 1.0),
            0.0
          );
          vec4 thermalScene = sampleScene(thermalUv);

          float heat = clamp(
            max(
              max(
                thermalScene.r,
                max(thermalScene.g, thermalScene.b)
              ) * 0.95,
              dot(
                thermalScene.rgb,
                vec3(0.299, 0.587, 0.114)
              ) * 1.8
            ),
            0.0,
            1.0
          );
          vec3 thermal = vec3(0.0);
          thermal = mix(thermal, vec3(0.03, 0.00, 0.38), smoothstep(0.02, 0.14, heat));
          thermal = mix(thermal, vec3(0.48, 0.00, 0.80), smoothstep(0.14, 0.30, heat));
          thermal = mix(thermal, vec3(1.00, 0.05, 0.00), smoothstep(0.30, 0.50, heat));
          thermal = mix(thermal, vec3(1.00, 0.55, 0.00), smoothstep(0.50, 0.70, heat));
          thermal = mix(thermal, vec3(1.00, 0.95, 0.10), smoothstep(0.70, 0.86, heat));
          thermal = mix(thermal, vec3(1.00), smoothstep(0.86, 0.98, heat));

          float takeoverOrder = mix(
            0.08,
            0.92,
            thermalNoise(
              vec2(
                bandId + 41.3,
                segmentId * 7.9 + thermalGlitchSeed * 0.43
              )
            )
          );
          float faultTick = floor(time * 28.0);
          float faultValue = thermalNoise(
            vec2(
              bandId * 19.1 + segmentId + thermalGlitchSeed * 0.59,
              faultTick
            )
          );
          float faultProgress = thermalAmount +
            (faultValue - 0.5) * 0.26 * transitionGate;
          float thermalField = smoothstep(
            takeoverOrder - 0.055,
            takeoverOrder + 0.055,
            faultProgress
          );
          thermal = min(thermal * (1.0 + 0.30 * thermalField), vec3(1.0));
          vec3 color = mix(scene.rgb, thermal, thermalField);

          float splitPulse = transitionGate * step(0.82, faultValue);
          vec2 splitOffset = vec2(2.4 / max(resolution.x, 1.0), 0.0);
          vec3 separated = vec3(
            sampleScene(vUv + splitOffset).r,
            color.g,
            sampleScene(vUv - splitOffset).b
          );
          color = mix(color, separated, splitPulse * 0.34);
          gl_FragColor = vec4(color, scene.a);
        }
      `,
    });
    this.presentScene = new THREE.Scene();
    this.presentCamera = new THREE.Camera();
    this.presentQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      presentMaterial
    );
    this.presentQuad.frustumCulled = false;
    this.presentScene.add(this.presentQuad);

    this.displayUniforms = {
      tDiffuse: { value: this.historyTargets[0].texture },
    };
    const displayMaterial = new THREE.ShaderMaterial({
      name: "CARDSTREAM_SCENE_DISPLAY",
      uniforms: this.displayUniforms,
      transparent: true,
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
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
    });
    this.displayScene = new THREE.Scene();
    this.displayCamera = new THREE.Camera();
    this.displayQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      displayMaterial
    );
    this.displayQuad.frustumCulled = false;
    this.displayScene.add(this.displayQuad);
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight(0xa9abb2, 0x080001, 1.8));

    const key = new THREE.DirectionalLight(0xffe6e1, 6.8);
    key.position.set(6, 11, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.00035;
    this.scene.add(key);

  }

  setupEnvironment() {
    const generator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();

    // Long red emitters live only in the baked reflection environment. They
    // produce soft strip highlights on metal without tinting every diffuse
    // surface red like a point/spot light would.
    const reflectorMaterial = new THREE.MeshBasicMaterial({
      color: 0xff1028,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    reflectorMaterial.color.setRGB(2.8, 0.012, 0.028);
    const reflectorGeometry = new THREE.PlaneGeometry(5.8, 0.42);
    const leftReflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
    leftReflector.position.set(-3.8, 2.5, -2.8);
    leftReflector.lookAt(0, 2.3, 0);
    room.add(leftReflector);

    const lowerReflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
    lowerReflector.scale.set(0.72, 0.7, 1);
    lowerReflector.position.set(3.2, 0.65, 2.9);
    lowerReflector.lookAt(0, 1.8, 0);
    room.add(lowerReflector);

    this.scene.environment = generator.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 1.0;
    reflectorGeometry.dispose();
    reflectorMaterial.dispose();
    room.dispose();
    generator.dispose();
  }

  createSurfaceNoise(seed, size, minimum, maximum) {
    const data = new Uint8Array(size * size * 4);
    const range = maximum - minimum;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const fine = Math.sin((x * 12.9898 + y * 78.233 + seed) * 0.91) * 43758.5453;
        const broad = Math.sin((x * 0.19 + y * 0.27 + seed) * 1.73) * 0.5 + 0.5;
        const random = fine - Math.floor(fine);
        const value = Math.min(1, Math.max(0, minimum + range * (random * 0.58 + broad * 0.42)));
        const byte = Math.round(value * 255);
        const offset = (y * size + x) * 4;
        data[offset] = byte;
        data[offset + 1] = byte;
        data[offset + 2] = byte;
        data[offset + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.needsUpdate = true;
    return texture;
  }

  createWearTexture(seed, size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    let state = seed;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };

    context.fillStyle = "#d2d2d2";
    context.fillRect(0, 0, size, size);
    for (let stain = 0; stain < 46; stain += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 5 + random() * 42;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      const tone = random() > 0.42 ? 238 : 96;
      gradient.addColorStop(0, `rgba(${tone},${tone},${tone},${0.08 + random() * 0.18})`);
      gradient.addColorStop(1, `rgba(${tone},${tone},${tone},0)`);
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.lineCap = "round";
    for (let scratch = 0; scratch < 88; scratch += 1) {
      const x = random() * size;
      const y = random() * size;
      context.strokeStyle = `rgba(48,48,48,${0.05 + random() * 0.16})`;
      context.lineWidth = random() > 0.86 ? 1.2 : 0.45;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 5 + random() * 54, y + (random() - 0.5) * 4);
      context.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.4, 2.4);
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  }

  loadDisplayFrameTextures() {
    const loader = new THREE.TextureLoader();
    const load = (file, colorSpace = THREE.NoColorSpace) => {
      const texture = loader.load(`/assets/textures/cardstream/${file}`);
      texture.colorSpace = colorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(0.92, 0.92);
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
    return {
      color: load("displayFrameStainsColor.jpg", THREE.SRGBColorSpace),
      normal: load("displayFrameStainsNormal.jpg"),
      gloss: load("displayFrameStainsGloss.jpg"),
    };
  }

  createScreenMask(size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    const inset = 4;
    const edge = size - inset;
    const radius = 10;
    context.fillStyle = "#000";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#fff";
    context.beginPath();
    context.moveTo(inset + radius, inset);
    context.lineTo(edge - radius, inset);
    context.quadraticCurveTo(edge, inset, edge, inset + radius);
    context.lineTo(edge, edge - radius);
    context.quadraticCurveTo(edge, edge, edge - radius, edge);
    context.lineTo(inset + radius, edge);
    context.quadraticCurveTo(inset, edge, inset, edge - radius);
    context.lineTo(inset, inset + radius);
    context.quadraticCurveTo(inset, inset, inset + radius, inset);
    context.closePath();
    context.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  }

  configureIndustrialMaterial(material) {
    if (!material || material.userData.archiveMaterialReady) return;
    material.userData.archiveMaterialReady = true;
    const name = material.name || "";
    material.envMapIntensity = 1;

    if (name.includes("Display Frame Stained Metal")) {
      // The supplied stain atlas is nearly black; a neutral multiplier keeps
      // the fingerprints, abrasion and uneven gloss visible under dim light.
      material.color.set(0xaaa5a2);
      material.map = this.displayFrameTextures.color;
      material.normalMap = this.displayFrameTextures.normal;
      material.normalScale = new THREE.Vector2(0.3, 0.3);
      material.roughnessMap = this.displayFrameTextures.gloss;
      material.metalness = 0.62;
      material.roughness = 0.58;
      material.envMapIntensity = 1.3;
    } else if (name.includes("Chassis Black")) {
      material.color.set(0x0d0e11);
      material.metalness = 0.64;
      material.roughness = 0.44;
      material.map = this.metalWear;
      material.roughnessMap = this.metalWear;
      material.bumpMap = this.metalWear;
      material.bumpScale = 0.006;
      material.envMapIntensity = 1.18;
      material.clearcoat = 0.08;
      material.clearcoatRoughness = 0.4;
    } else if (name.includes("Worn Gunmetal")) {
      material.color.set(0x292a2e);
      material.metalness = 0.88;
      material.roughness = 0.38;
      material.map = this.metalWear;
      material.roughnessMap = this.metalWear;
      material.bumpMap = this.metalWear;
      material.bumpScale = 0.008;
      material.envMapIntensity = 1.42;
    } else if (name.includes("Armature Metal")) {
      material.color.set(0x17191d);
      material.metalness = 0.92;
      material.roughness = 0.36;
      material.map = this.metalWear;
      material.roughnessMap = this.metalWear;
      material.bumpMap = this.metalWear;
      material.bumpScale = 0.006;
      material.envMapIntensity = 1.34;
    } else if (name.includes("Rear Service Panel")) {
      material.color.set(0x302b2e);
      material.metalness = 0.7;
      material.roughness = 0.55;
      material.map = this.metalWear;
      material.roughnessMap = this.metalWear;
      material.bumpMap = this.metalWear;
      material.bumpScale = 0.009;
      material.envMapIntensity = 0.92;
    } else if (name.includes("Edge Steel")) {
      material.color.set(0x8e8986);
      material.metalness = 1;
      material.roughness = 0.24;
      material.roughnessMap = this.metalWear;
      material.bumpMap = this.metalWear;
      material.bumpScale = 0.004;
      material.envMapIntensity = 1.75;
    } else if (name.includes("Cable Rubber")) {
      material.color.set(0x08080a);
      material.metalness = 0.02;
      material.roughness = 0.8;
      material.roughnessMap = this.rubberNoise;
      material.bumpMap = this.rubberNoise;
      material.bumpScale = 0.006;
      material.envMapIntensity = 0.28;
    } else if (name.includes("Signal Red")) {
      material.color.set(0x69000d);
      material.metalness = 0.58;
      material.roughness = 0.32;
      material.roughnessMap = this.metalNoise;
      material.envMapIntensity = 1.3;
      material.emissive?.set(0x220003);
      material.emissiveIntensity = 0.32;
    }
    material.needsUpdate = true;
  }

  createScreenTexture(theme, index) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 768;
    const context = canvas.getContext("2d");
    const [number, title, code, state] = theme;

    context.fillStyle = "#060607";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(152, 12, 28, 0.26)";
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    context.fillStyle = index === 0 ? "#a20b20" : "#4c0711";
    context.fillRect(0, 0, 18, canvas.height);
    context.fillRect(0, 0, canvas.width, 12);
    context.fillStyle = "rgba(255,255,255,.76)";
    context.font = "24px monospace";
    context.fillText(`CHANNEL / ${number}`, 64, 72);
    context.fillStyle = "rgba(255,255,255,.34)";
    context.textAlign = "right";
    context.fillText(state, 958, 72);

    context.textAlign = "left";
    context.font = "700 142px Arial Narrow, sans-serif";
    // Misregistered phosphor ghosts stay subtle at rest but give bright type
    // the RGB edge separation of a photographed CRT.
    context.globalCompositeOperation = "screen";
    context.fillStyle = "rgba(0,115,255,.16)";
    context.fillText(title, 51, 390);
    context.fillStyle = "rgba(35,255,112,.1)";
    context.fillText(title, 56, 390);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = index === 0 ? "#ff263d" : "#d6d6d7";
    context.fillText(title, 54, 390);
    context.fillStyle = "rgba(255,255,255,.48)";
    context.font = "26px monospace";
    context.fillText(code, 62, 454);

    context.strokeStyle = "rgba(255,255,255,.42)";
    context.beginPath();
    context.moveTo(62, 628);
    context.lineTo(962, 628);
    context.stroke();
    context.fillStyle = "rgba(255,255,255,.42)";
    context.font = "20px monospace";
    context.fillText(`ARCHIVE OUTPUT / ${number}`, 62, 678);

    // CRT-like signal surface: fine scanlines, deterministic phosphor noise
    // and a restrained glass-edge vignette.
    context.fillStyle = "rgba(0,0,0,.07)";
    for (let y = 1; y < canvas.height; y += 4) {
      context.fillRect(0, y, canvas.width, 1);
    }
    let noiseSeed = 193 + index * 71;
    const random = () => {
      noiseSeed = (noiseSeed * 16807) % 2147483647;
      return (noiseSeed - 1) / 2147483646;
    };
    for (let dot = 0; dot < 420; dot += 1) {
      const alpha = 0.025 + random() * 0.055;
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.fillRect(
        Math.floor(random() * canvas.width),
        Math.floor(random() * canvas.height),
        random() > 0.88 ? 2 : 1,
        1
      );
    }
    context.globalCompositeOperation = "screen";
    for (let x = 0; x < canvas.width; x += 3) {
      context.fillStyle = "rgba(255,25,25,.045)";
      context.fillRect(x, 0, 1, canvas.height);
      context.fillStyle = "rgba(20,255,85,.032)";
      context.fillRect(x + 1, 0, 1, canvas.height);
      context.fillStyle = "rgba(45,90,255,.048)";
      context.fillRect(x + 2, 0, 1, canvas.height);
    }
    context.globalCompositeOperation = "source-over";
    for (let smear = 0; smear < 14; smear += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const radius = 18 + random() * 82;
      const stain = context.createRadialGradient(x, y, 0, x, y, radius);
      stain.addColorStop(0, `rgba(0,0,0,${0.025 + random() * 0.07})`);
      stain.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = stain;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const vignette = context.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.48,
      canvas.height * 0.16,
      canvas.width * 0.5,
      canvas.height * 0.48,
      canvas.width * 0.68
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,.08)");
    vignette.addColorStop(1, "rgba(0,0,0,.58)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  load() {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const root = gltf.scene;
        root.name = "CARDSTREAM_MODEL";
        this.modelRoot = root;
        this.rootBaseY = root.position.y;
        this.rig = root.getObjectByName("CARDSTREAM_ORBIT_RIG") || root;
        this.baseRotation = -Math.atan2(
          this.camera.position.z,
          this.camera.position.x
        );

        root.traverse((object) => {
          if (!object.isMesh) return;
          object.frustumCulled = true;
          object.castShadow = true;
          object.receiveShadow = true;
          const objectMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          objectMaterials.forEach((material) =>
            this.configureIndustrialMaterial(material)
          );
          const cableMatch = object.name.match(/SCREEN_(\d+)_CABLE_(\d+)/);
          if (cableMatch && object.morphTargetInfluences) {
            const dictionary = object.morphTargetDictionary || {};
            const positive = dictionary.CableSwayPositive;
            const negative = dictionary.CableSwayNegative;
            const settle = dictionary.CableSettle;
            if (
              Number.isInteger(positive) &&
              Number.isInteger(negative) &&
              Number.isInteger(settle)
            ) {
              object.frustumCulled = false;
              this.cableDynamics.push({
                mesh: object,
                positive,
                negative,
                settle,
                phase:
                  Number(cableMatch[1]) * 0.83 +
                  Number(cableMatch[2]) * 1.37,
                sway: 0,
                swayVelocity: 0,
              });
            }
          }
          const displayMatch = object.name.match(/SCREEN_(\d+)_DISPLAY/);
          if (!displayMatch) return;
          const screenIndex = Number(displayMatch[1]) - 1;
          const texture = this.createScreenTexture(THEMES[screenIndex], screenIndex);
          const sourceMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          sourceMaterials.forEach((material) => {
            material.color?.set(0x020203);
            material.emissive?.set(0x000000);
            material.emissiveIntensity = 0;
          });
          const screenMaterial = new THREE.MeshPhysicalMaterial({
            name: `SCREEN_${String(screenIndex + 1).padStart(2, "0")}_WEB`,
            color: 0xffffff,
            map: texture,
            alphaMap: this.screenMask,
            emissive: 0xffffff,
            emissiveMap: texture,
            emissiveIntensity: screenIndex === 0 ? 1.05 : 0.24,
            metalness: 0,
            roughness: 0.34,
            clearcoat: 0.7,
            clearcoatRoughness: 0.3,
            reflectivity: 0.68,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.01,
            opacity: screenIndex === 0 ? 1 : 0.58,
          });
          object.geometry.computeBoundingBox();
          const bounds = object.geometry.boundingBox;
          const size = bounds.getSize(new THREE.Vector3());
          const surfaceGeometry = new THREE.PlaneGeometry(
            size.x * 0.965,
            size.y * 0.965,
            24,
            18
          );
          const positions = surfaceGeometry.attributes.position;
          for (let vertex = 0; vertex < positions.count; vertex += 1) {
            const normalizedX = positions.getX(vertex) / (size.x * 0.4825);
            const normalizedY = positions.getY(vertex) / (size.y * 0.4825);
            const curve = Math.max(
              0,
              (1 - normalizedX * normalizedX) *
                (1 - normalizedY * normalizedY)
            );
            positions.setZ(vertex, -curve * 0.064);
          }
          positions.needsUpdate = true;
          surfaceGeometry.computeVertexNormals();
          const displaySurface = new THREE.Mesh(
            surfaceGeometry,
            screenMaterial
          );
          displaySurface.name = `SCREEN_${String(screenIndex + 1).padStart(2, "0")}_WEB_SURFACE`;
          displaySurface.position.z = bounds.min.z - 0.025;
          displaySurface.scale.x = -1;
          displaySurface.castShadow = false;
          displaySurface.receiveShadow = false;
          displaySurface.renderOrder = 4;
          object.add(displaySurface);
          this.screenMaterials[screenIndex] = screenMaterial;
        });

        this.scene.add(root);
        root.updateMatrixWorld(true);
        const modelBounds = new THREE.Box3().setFromObject(root);
        if (Number.isFinite(modelBounds.min.y)) {
          this.dataSeaUniforms.groundY.value = modelBounds.min.y - 0.18;
        }
        this.host.classList.add("is-loaded");
        this.host.querySelector(".archive-card-model__status")?.remove();
        this.setPosition(this.position);
        this.setTheme(this.themeIndex);
        this.render();
        window.dispatchEvent(new CustomEvent("archive:model-ready"));
      },
      (event) => {
        window.dispatchEvent(new CustomEvent("archive:model-progress", {
          detail: {
            loaded: event.loaded || 0,
            total: event.total || 0,
          },
        }));
      },
      () => {
        this.host.classList.add("is-load-error");
        const status = this.host.querySelector(".archive-card-model__status");
        if (status) status.textContent = "3D SIGNAL / LOST";
        window.dispatchEvent(new CustomEvent("archive:model-ready", {
          detail: { degraded: true },
        }));
      }
    );
  }

  resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    const drawingSize = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.signalTarget?.setSize(drawingSize.x, drawingSize.y);
    this.dataSeaTarget?.setSize(drawingSize.x, drawingSize.y);
    this.signalOutputTarget?.setSize(drawingSize.x, drawingSize.y);
    this.sceneCompositeTarget?.setSize(drawingSize.x, drawingSize.y);
    this.historyTargets?.forEach((target) =>
      target.setSize(drawingSize.x, drawingSize.y)
    );
    this.signalUniforms?.resolution.value.copy(drawingSize);
    this.presentUniforms?.resolution.value.copy(drawingSize);
    this.clearThermalHistory();
    this.camera.aspect = width / height;
    const portrait = this.camera.aspect < 0.85;
    this.camera.position.set(
      portrait ? 11.8 : 8.7,
      portrait ? 7.3 : 5.4,
      portrait ? 14.8 : 10.8
    );
    this.cameraBasePosition.copy(this.camera.position);
    const cameraOffset = this.cameraBasePosition.clone().sub(this.target);
    this.cameraOrbitRadius = Math.max(0.001, cameraOffset.length());
    this.cameraOrbitAzimuth = Math.atan2(cameraOffset.z, cameraOffset.x);
    this.cameraBaseElevation = Math.asin(
      THREE.MathUtils.clamp(cameraOffset.y / this.cameraOrbitRadius, -1, 1)
    );
    this.applyCameraOrbit();
    this.camera.updateProjectionMatrix();
    this.updateDataSeaViewUniforms();
    this.render();
  }

  applyCameraOrbit() {
    const elevation = this.cameraBaseElevation + this.currentCameraOrbit;
    const horizontalRadius = Math.cos(elevation) * this.cameraOrbitRadius;
    this.camera.position.set(
      this.target.x + Math.cos(this.cameraOrbitAzimuth) * horizontalRadius,
      this.target.y + Math.sin(elevation) * this.cameraOrbitRadius,
      this.target.z + Math.sin(this.cameraOrbitAzimuth) * horizontalRadius
    );
    this.camera.lookAt(this.target);
  }

  clearThermalHistory() {
    if (!this.historyTargets?.length) return;
    const previousTarget = this.renderer.getRenderTarget();
    this.historyTargets.forEach((target) => {
      this.renderer.setRenderTarget(target);
      this.renderer.clear(true, false, false);
    });
    this.renderer.setRenderTarget(previousTarget);
    this.historyReadIndex = 0;
  }

  setPosition(position) {
    this.position = Number.isFinite(position) ? position : 0;
    this.render();
  }

  setTheme(index) {
    this.themeIndex = index;
    this.screenMaterials.forEach((material, materialIndex) => {
      if (!material) return;
      const active = materialIndex === index;
      material.color.set(active ? 0xffffff : 0x8b6870);
      material.opacity = active ? 1 : 0.5;
      material.emissiveIntensity = active ? 1.05 : 0.22;
    });
    this.render();
  }

  setThermalEnabled(enabled) {
    const wasEnabled = this.thermalEnabled;
    this.thermalEnabled = Boolean(enabled);
    if (this.thermalEnabled && !wasEnabled) {
      this.thermalGlitchSeed = Math.random() * 1000;
      if (this.presentUniforms) {
        this.presentUniforms.thermalGlitchSeed.value = this.thermalGlitchSeed;
      }
    }
    if (!this.thermalEnabled) {
      if (this.historyUniforms) this.historyUniforms.damp.value = 0;
    }
    this.render();
  }

  setActive(active) {
    this.active = active;
    this.dataSeaRevealTarget = active ? 1 : 0;
    if (active && !this.autoStartedAt) {
      this.autoStartedAt = performance.now() + 2600;
    }
    this.render();
  }

  setHovered(hovered) {
    // Hover is intentionally visual-only at the cursor level. The suspended
    // rig must remain spatially fixed until the user actually drags it.
  }

  setInteracting(interacting) {
    this.interacting = Boolean(interacting);
    this.render();
  }

  adjustDragCameraOrbit(deltaY) {
    if (!Number.isFinite(deltaY)) return;
    const orbitLimit = THREE.MathUtils.degToRad(6);
    this.cameraOrbitReturning = false;
    this.cameraOrbitVelocity = 0;
    this.targetCameraOrbit = THREE.MathUtils.clamp(
      this.targetCameraOrbit + deltaY * 0.00045,
      -orbitLimit,
      orbitLimit
    );
    this.render();
  }

  releaseDragCameraOrbit() {
    this.targetCameraOrbit = 0;
    this.cameraOrbitReturning = true;
    this.render();
  }

  render() {
    if (this.renderFrame) return;
    this.renderFrame = window.requestAnimationFrame((time) => this.tick(time));
  }

  tick(time) {
    this.renderFrame = 0;
    const delta = Math.min(0.05, Math.max(0.001, (time - (this.lastFrameTime || time)) / 1000));
    this.lastFrameTime = time;

    const autoTarget = this.interacting ? 0 : 1;
    this.autoBlend +=
      (autoTarget - this.autoBlend) * (1 - Math.exp(-delta * 4.8));
    const autoTime = Math.max(0, time - (this.autoStartedAt || time));
    const autoRotation = Math.sin(autoTime / 7200) * Math.PI * 0.048;
    const thermalTarget = this.thermalEnabled ? 1 : 0;
    this.thermalAmount +=
      (thermalTarget - this.thermalAmount) * (1 - Math.exp(-delta * 8));
    if (Math.abs(thermalTarget - this.thermalAmount) < 0.001) {
      this.thermalAmount = thermalTarget;
    }
    const linkedBurstProgress = Number(window.archiveHypercubeBurstProgress);
    if (this.active && Number.isFinite(linkedBurstProgress)) {
      const normalizedSeaProgress = THREE.MathUtils.clamp(
        (linkedBurstProgress - 0.26) / 0.68,
        0,
        1
      );
      this.dataSeaReveal =
        normalizedSeaProgress *
        normalizedSeaProgress *
        (3 - 2 * normalizedSeaProgress);
    } else {
      this.dataSeaReveal +=
        (this.dataSeaRevealTarget - this.dataSeaReveal) *
        (1 - Math.exp(-delta * 2.9));
    }
    this.dataSeaUniforms.time.value = this.reducedMotion ? 0 : time * 0.001;
    this.dataSeaUniforms.reveal.value = this.dataSeaReveal;

    if (this.cameraOrbitReturning) {
      const orbitAcceleration =
        (this.targetCameraOrbit - this.currentCameraOrbit) * 12 -
        this.cameraOrbitVelocity * 5.8;
      this.cameraOrbitVelocity += orbitAcceleration * delta;
      this.currentCameraOrbit += this.cameraOrbitVelocity * delta;
      if (
        Math.abs(this.targetCameraOrbit - this.currentCameraOrbit) < 0.00025 &&
        Math.abs(this.cameraOrbitVelocity) < 0.0012
      ) {
        this.currentCameraOrbit = this.targetCameraOrbit;
        this.cameraOrbitVelocity = 0;
        this.cameraOrbitReturning = false;
      }
    } else {
      this.currentCameraOrbit +=
        (this.targetCameraOrbit - this.currentCameraOrbit) *
        (1 - Math.exp(-delta * 7));
    }
    this.applyCameraOrbit();
    this.updateDataSeaViewUniforms();

    if (this.rig) {
      const nextRotation =
        this.baseRotation -
        this.position * Math.PI * 0.5 +
        autoRotation * this.autoBlend;
      const previousRotation = this.lastRigRotation ?? nextRotation;
      const rotationDelta = Math.atan2(
        Math.sin(nextRotation - previousRotation),
        Math.cos(nextRotation - previousRotation)
      );
      const instantaneousVelocity = rotationDelta / delta;
      this.rigAngularVelocity +=
        (instantaneousVelocity - this.rigAngularVelocity) *
        (1 - Math.exp(-delta * 10));
      this.lastRigRotation = nextRotation;
      this.rig.rotation.y = nextRotation;

      this.cableDynamics.forEach((cableState) => {
        const ambient = Math.sin(time * 0.00105 + cableState.phase) * 0.035;
        const inertia = THREE.MathUtils.clamp(
          -this.rigAngularVelocity * 0.16,
          -0.82,
          0.82
        );
        const targetSway = inertia + ambient;
        // A lightly damped spring creates rotational lag and a small settling
        // overshoot while the pinned morph targets keep both sockets attached.
        cableState.swayVelocity +=
          ((targetSway - cableState.sway) * 18 -
            cableState.swayVelocity * 5.2) *
          delta;
        cableState.sway += cableState.swayVelocity * delta;
        cableState.sway = THREE.MathUtils.clamp(cableState.sway, -1, 1);

        const positiveAmount = Math.max(0, cableState.sway);
        const negativeAmount = Math.max(0, -cableState.sway);
        cableState.mesh.morphTargetInfluences[cableState.positive] = positiveAmount;
        cableState.mesh.morphTargetInfluences[cableState.negative] = negativeAmount;
        cableState.mesh.morphTargetInfluences[cableState.settle] =
          THREE.MathUtils.clamp(Math.abs(cableState.swayVelocity) * 0.055, 0, 0.32);
      });
    }
    if (this.modelRoot) {
      this.modelRoot.position.y = this.rootBaseY + this.rootDisplayOffsetY;
    }

    this.renderer.setRenderTarget(this.dataSeaTarget);
    this.renderer.render(this.dataSeaScene, this.camera);
    this.renderer.setRenderTarget(this.signalTarget);
    this.renderer.render(this.scene, this.camera);
    this.signalUniforms.time.value = time * 0.001;
    this.renderer.setRenderTarget(this.signalOutputTarget);
    this.renderer.render(this.signalScene, this.signalCamera);

    this.presentUniforms.time.value = time * 0.001;
    this.presentUniforms.thermalAmount.value = this.thermalAmount;
    this.renderer.setRenderTarget(this.sceneCompositeTarget);
    this.renderer.render(this.presentScene, this.presentCamera);

    const historyWriteIndex = 1 - this.historyReadIndex;
    const historyWriteTarget = this.historyTargets[historyWriteIndex];
    this.historyUniforms.tCurrent.value = this.sceneCompositeTarget.texture;
    this.historyUniforms.tHistory.value =
      this.historyTargets[this.historyReadIndex].texture;
    this.historyUniforms.damp.value = this.reducedMotion
      ? 0
      : 0.93 * this.thermalAmount;
    this.renderer.setRenderTarget(historyWriteTarget);
    this.renderer.render(this.historyScene, this.historyCamera);

    this.displayUniforms.tDiffuse.value = historyWriteTarget.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.displayCamera);
    this.historyReadIndex = historyWriteIndex;
    const autoSettled = Math.abs(autoTarget - this.autoBlend) < 0.002;
    const thermalSettled =
      Math.abs((this.thermalEnabled ? 1 : 0) - this.thermalAmount) < 0.002;
    const cameraOrbitSettled =
      !this.cameraOrbitReturning &&
      Math.abs(this.targetCameraOrbit - this.currentCameraOrbit) < 0.00025;
    if (
      this.active ||
      !autoSettled ||
      !thermalSettled ||
      !cameraOrbitSettled
    ) {
      this.renderFrame = window.requestAnimationFrame((nextTime) =>
        this.tick(nextTime)
      );
    }
  }
}

let attached = false;
let attachScheduled = false;
let streamInstance = window.archiveCardStreamInstance || null;

const attachModel = (streamOverride = null) => {
  if (attached) return;
  const host = document.getElementById("archiveCardModel");
  const stream = streamOverride || streamInstance || window.archiveCardStreamInstance;
  if (!host || !stream) return;
  attached = true;
  const view = new ArchiveCardModel(host);
  stream.attachModelView(view);
};

const scheduleModelAttach = () => {
  if (attached || attachScheduled) return;
  attachScheduled = true;
  const run = () => {
    attachScheduled = false;
    attachModel();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 350 });
  } else {
    window.setTimeout(run, 0);
  }
};

window.addEventListener(
  "archive-card-stream-ready",
  (event) => {
    streamInstance = event.detail;
  },
  { once: true }
);

// The preloader starts the expensive secondary WebGL scene only after the main
// hypercube has yielded its first frame. This keeps startup responsive while
// moving shader compilation and GLB parsing out of the user's first long-press.
window.addEventListener("archive:preload-card-model", scheduleModelAttach, { once: true });

// Retain the interaction fallback in case the preloader is bypassed.
window.addEventListener("archive:hypercube-long-press", (event) => {
  if (event.detail?.active) scheduleModelAttach();
});

// Fallback for keyboard/programmatic activation paths that skip the hold event.
window.addEventListener("archive:hypercube-burst", () => attachModel(), { once: true });
