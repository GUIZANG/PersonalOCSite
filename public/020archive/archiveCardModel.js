import * as THREE from "three";
import { GLTFLoader } from "../libs/three/loaders/GLTFLoader.js";
import { RoomEnvironment } from "../libs/three/environments/RoomEnvironment.js";

const MODEL_URL = "/assets/models/cardstream/cardstreamCarousel.glb";
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
    this.interacting = false;
    this.autoBlend = 1;
    this.autoStartedAt = 0;
    this.lastFrameTime = 0;
    this.screenMaterials = [];
    this.renderFrame = 0;

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
          gl_FragColor = vec4(max(color, vec3(0.0)), max(source.a, haloAlpha * 0.38));
        }
      `,
    });
    this.signalScene = new THREE.Scene();
    this.signalCamera = new THREE.Camera();
    this.signalQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.signalQuad.frustumCulled = false;
    this.signalScene.add(this.signalQuad);
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
      texture.repeat.set(1.15, 1.15);
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
      material.color.set(0x4b4d50);
      material.map = this.displayFrameTextures.color;
      material.normalMap = this.displayFrameTextures.normal;
      material.normalScale = new THREE.Vector2(0.2, 0.2);
      material.roughnessMap = this.displayFrameTextures.gloss;
      material.metalness = 0.58;
      material.roughness = 0.68;
      material.envMapIntensity = 1.18;
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

        for (let index = 1; index <= 4; index += 1) {
          const screenRoot = root.getObjectByName(
            `SCREEN_${String(index).padStart(2, "0")}_ROOT`
          );
          screenRoot?.scale.setScalar(1.16);
        }

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
        this.host.classList.add("is-loaded");
        this.host.querySelector(".archive-card-model__status")?.remove();
        this.setPosition(this.position);
        this.setTheme(this.themeIndex);
        this.render();
      },
      undefined,
      () => {
        this.host.classList.add("is-load-error");
        const status = this.host.querySelector(".archive-card-model__status");
        if (status) status.textContent = "3D SIGNAL / LOST";
      }
    );
  }

  resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    const drawingSize = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.signalTarget?.setSize(drawingSize.x, drawingSize.y);
    this.signalUniforms?.resolution.value.copy(drawingSize);
    this.camera.aspect = width / height;
    const portrait = this.camera.aspect < 0.85;
    this.camera.position.set(
      portrait ? 11.8 : 8.7,
      portrait ? 7.3 : 5.4,
      portrait ? 14.8 : 10.8
    );
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.render();
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

  setActive(active) {
    this.active = active;
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

    if (this.rig) {
      this.rig.rotation.y =
        this.baseRotation -
        this.position * Math.PI * 0.5 +
        autoRotation * this.autoBlend;
    }
    if (this.modelRoot) {
      this.modelRoot.position.y = this.rootBaseY;
    }

    this.renderer.setRenderTarget(this.signalTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.signalUniforms.time.value = time * 0.001;
    this.renderer.render(this.signalScene, this.signalCamera);
    const autoSettled = Math.abs(autoTarget - this.autoBlend) < 0.002;
    if (this.active || !autoSettled) {
      this.renderFrame = window.requestAnimationFrame((nextTime) =>
        this.tick(nextTime)
      );
    }
  }
}

let attached = false;

const attachModel = (streamOverride = null) => {
  if (attached) return;
  const host = document.getElementById("archiveCardModel");
  const stream = streamOverride || window.archiveCardStreamInstance;
  if (!host || !stream) return;
  attached = true;
  const view = new ArchiveCardModel(host);
  stream.attachModelView(view);
};

window.addEventListener(
  "archive-card-stream-ready",
  (event) => attachModel(event.detail),
  { once: true }
);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachModel, { once: true });
} else {
  attachModel();
}
