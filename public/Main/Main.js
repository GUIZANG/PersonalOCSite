(function () {
  window.addEventListener("DOMContentLoaded", () => {
    const stage = document.getElementById("hypercube-stage");
    const cardStream = new window.MainCardStream();
    new Hypercube(stage, cardStream).init();
  });

  class Hypercube {
    constructor(container = document.body, cardStream = null) {
      this.container = container;
      this.cardStream = cardStream;
      this.background = 0x000000;
      this.foreground = 0xffffff;
      this.duration = 16000;
      this.hoverAmount = 0;
      this.hoverTarget = 0;
      this.burstAmount = 0;
      this.burstTarget = 0;
      this.baseRotationX = Math.sin(45 * Math.PI / 180);
      this.tesseract = null;
      this.mat = null;
      this.trails = null;
      this.trailMat = null;
      this.burstPositionAttribute = null;
      this.trailBurstPositionAttribute = null;
      this.burstSourceIndices = [];
      this.trailSourceIndices = [];
      this.hoverTargetPoints = [];

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(this.background);
      this.fadeScene = new THREE.Scene();
      this.fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.fadeMaterial = new THREE.MeshBasicMaterial({
        color: this.background,
        transparent: true,
        opacity: 0.16,
        depthTest: false,
        depthWrite: false,
      });
      this.fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMaterial));

      this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
      this.camera.position.set(0, 0, 6);

      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(this.background, 1);

      this.container.insertBefore(this.renderer.domElement, this.container.firstChild);

      this.animate = this.animate.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
    }

    async init() {
      const cubeParticlesPerEdge = 400;
      const burstParticlesPerEdge = 200;
      const hoverParticlesPerEdge = 2400;
      const sizeOut = 0.5;
      const sizeIn = 0.25;
      const cubeEdges = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      const unitCorners = [];
      const geo = new THREE.BufferGeometry();
      const totalParticles = cubeEdges.length * hoverParticlesPerEdge;
      const posStart = new Float32Array(totalParticles * 3);
      const posEnd = new Float32Array(totalParticles * 3);
      const squarePos = new Float32Array(totalParticles * 3);
      const burstPos = new Float32Array(totalParticles * 3);
      const offsets = new Float32Array(totalParticles);
      const cubeMask = new Float32Array(totalParticles);
      const burstMask = new Float32Array(totalParticles);
      let pIdx = 0;
      let burstVisibleIndex = 0;

      this.hoverTargetPoints = await this.loadHoverTargetPoints(totalParticles);

      for (let x = -1; x <= 1; x += 2) {
        for (let y = -1; y <= 1; y += 2) {
          for (let z = -1; z <= 1; z += 2) {
            unitCorners.push(new THREE.Vector3(x, y, z));
          }
        }
      }

      cubeEdges.forEach((edge) => {
        const [cornerA, cornerB] = edge;
        const vA = unitCorners[cornerA];
        const vB = unitCorners[cornerB];
        const cubeStep = hoverParticlesPerEdge / cubeParticlesPerEdge;
        const burstStep = hoverParticlesPerEdge / burstParticlesPerEdge;

        for (let p = 0; p < hoverParticlesPerEdge; p++) {
          const t = p / hoverParticlesPerEdge;
          const edgePoint = new THREE.Vector3().lerpVectors(vA, vB, t);
          const start = edgePoint.clone().multiplyScalar(sizeOut);
          const end = edgePoint.clone().multiplyScalar(sizeIn);
          const cubeVisibleIndex = Math.floor(p / cubeStep);
          const inward = cubeVisibleIndex % 2 === 0;
          const isCubeVisible = p % cubeStep === 0;
          const isBurstVisible = p % burstStep === 0;
          const burst = isBurstVisible
            ? this.getBurstPoint(burstVisibleIndex++, cubeEdges.length * burstParticlesPerEdge)
            : this.getBurstPoint(pIdx, totalParticles);

          this.setParticleData(
            pIdx,
            inward ? start : end,
            inward ? end : start,
            posStart,
            posEnd,
            squarePos,
            burstPos,
            offsets,
            burst
          );
          cubeMask[pIdx] = isCubeVisible ? 1 : 0;
          burstMask[pIdx] = isBurstVisible ? 1 : 0;
          pIdx++;
        }
      });

      geo.setAttribute("position", new THREE.BufferAttribute(posStart, 3));
      geo.setAttribute("targetPos", new THREE.BufferAttribute(posEnd, 3));
      geo.setAttribute("squarePos", new THREE.BufferAttribute(squarePos, 3));
      geo.setAttribute("burstPos", new THREE.BufferAttribute(burstPos, 3));
      geo.setAttribute("offset", new THREE.BufferAttribute(offsets, 1));
      geo.setAttribute("cubeMask", new THREE.BufferAttribute(cubeMask, 1));
      geo.setAttribute("burstMask", new THREE.BufferAttribute(burstMask, 1));
      this.burstPositionAttribute = geo.getAttribute("burstPos");

      this.mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uBurst: { value: 0 },
          uColor: { value: new THREE.Color(this.foreground) },
          uResolution: { value: window.innerHeight * Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uHover;
          uniform float uBurst;
          uniform float uResolution;
          attribute vec3 targetPos;
          attribute vec3 squarePos;
          attribute vec3 burstPos;
          attribute float offset;
          attribute float cubeMask;
          attribute float burstMask;
          varying float vAlpha;

          float cubicBezierX(float t, float x1, float x2) {
            return 3.0 * (1.0 - t) * (1.0 - t) * t * x1 + 3.0 * (1.0 - t) * t * t * x2 + t * t * t;
          }

          float cubicBezierDX(float t, float x1, float x2) {
            return 3.0 * (1.0 - t) * (1.0 - t) * x1 + 6.0 * (1.0 - t) * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2);
          }

          float cubicBezierEase(float x) {
            float x1 = 0.37;
            float y1 = 0.0;
            float x2 = 0.63;
            float y2 = 1.0;
            float t = x;

            for (int i = 0; i < 8; i++) {
              float err = cubicBezierX(t, x1, x2) - x;
              float dt = cubicBezierDX(t, x1, x2);
              if (abs(dt) < 1e-6) break;
              t -= err / dt;
              t = clamp(t, 0.0, 1.0);
            }

            return 3.0 * (1.0 - t) * (1.0 - t) * t * y1 + 3.0 * (1.0 - t) * t * t * y2 + t * t * t;
          }

          void main() {
            float raw = mod(uTime * 0.5 + offset, 2.0);
            float leg = raw < 1.0 ? cubicBezierEase(raw) : 1.0 - cubicBezierEase(raw - 1.0);
            float easedProgress = leg;
            vec3 midDir = normalize(position + targetPos);
            float bulge = sin(easedProgress * 3.14159265) * 0.1;
            vec3 cubePos = mix(position, targetPos, easedProgress) + midDir * bulge;
            mat3 worldRotation = mat3(modelMatrix);
            vec3 hoverTarget = vec3(
              dot(worldRotation[0], squarePos),
              dot(worldRotation[1], squarePos),
              dot(worldRotation[2], squarePos)
            );
            vec3 collapsedPos = mix(cubePos, hoverTarget, cubicBezierEase(uHover));

            float radius = length(burstPos.xy);
            float orbitSpeed = mix(0.05, 0.2, fract(offset * 19.73));
            orbitSpeed *= mix(1.35, 0.55, smoothstep(0.0, 6.5, radius));
            float angle = uTime * orbitSpeed + offset * 6.2831853;
            float ca = cos(angle);
            float sa = sin(angle);
            vec3 orbitBurst = vec3(
              burstPos.x * ca - burstPos.y * sa,
              burstPos.x * sa + burstPos.y * ca,
              burstPos.z
            );
            float burstEase = cubicBezierEase(uBurst);
            float orbitEase = smoothstep(0.96, 1.0, burstEase);
            vec3 burstTarget = mix(burstPos, orbitBurst, orbitEase);
            vec3 currentPos = mix(collapsedPos, burstTarget, burstEase);
            float hoverEase = cubicBezierEase(uHover);
            float stageAlpha = mix(cubeMask, 1.0, hoverEase);
            vAlpha = mix(stageAlpha, burstMask, burstEase);

            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
            float dustScale = mix(1.0, 0.72, burstEase);
            gl_PointSize = (uResolution / 160.0) * dustScale * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;

          void main() {
            if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
            if (vAlpha <= 0.001) discard;
            gl_FragColor = vec4(uColor, vAlpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      this.tesseract = new THREE.Points(geo, this.mat);
      this.tesseract.rotation.x = this.baseRotationX;
      this.scene.add(this.tesseract);

      this.createTrails(burstPos, offsets, burstMask);

      window.addEventListener("resize", this.onResize);
      this.container.addEventListener("pointermove", this.onPointerMove);
      this.container.addEventListener("pointerleave", this.onPointerLeave);
      this.container.addEventListener("pointerdown", this.onPointerDown);
      this.animate(0);
    }

    animate(time) {
      if (this.tesseract) {
        const msToSeconds = this.duration / 1000;
        const cubeRotationAmount = this.burstTarget > 0 ? 0 : 1;
        this.tesseract.rotation.x = this.baseRotationX * cubeRotationAmount;
        this.tesseract.rotation.y = (time / 1000) * (Math.PI * 2 / msToSeconds) * cubeRotationAmount;
        this.tesseract.rotation.y %= Math.PI * 2;
      }

      this.hoverAmount += (this.hoverTarget - this.hoverAmount) * 0.08;
      this.burstAmount += (this.burstTarget - this.burstAmount) * 0.025;

      if (this.mat) {
        this.mat.uniforms.uTime.value = time / 1000;
        this.mat.uniforms.uHover.value = this.hoverAmount;
        this.mat.uniforms.uBurst.value = this.burstAmount;
      }

      const trailAmount = smoothstep(0.82, 0.96, this.burstAmount);

      if (this.trailMat) {
        this.trailMat.uniforms.uTime.value = time / 1000;
        this.trailMat.uniforms.uBurst.value = trailAmount;
      }

      if (trailAmount > 0.001) {
        this.renderer.autoClear = false;
        this.fadeMaterial.opacity = THREE.MathUtils.lerp(0.34, 0.08, trailAmount);
        this.renderer.render(this.fadeScene, this.fadeCamera);
        this.renderer.render(this.scene, this.camera);
      } else {
        this.renderer.autoClear = true;
        this.renderer.render(this.scene, this.camera);
      }

      window.requestAnimationFrame(this.animate);
    }

    onResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);

      if (this.mat) {
        this.mat.uniforms.uResolution.value = window.innerHeight * Math.min(window.devicePixelRatio, 2);
      }
      this.updateBurstPositions();
    }

    onPointerMove(event) {
      if (this.burstTarget > 0) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const distance = Math.hypot(x, y);
      const hitRadius = Math.min(rect.width, rect.height) * 0.16;
      this.hoverTarget = distance < hitRadius ? 1 : 0;
      this.container.classList.toggle("is-hypercube-hovered", this.hoverTarget === 1);
    }

    onPointerLeave() {
      if (this.burstTarget > 0) return;

      this.hoverTarget = 0;
      this.container.classList.remove("is-hypercube-hovered");
    }

    onPointerDown() {
      if (this.hoverAmount < 0.18 || this.burstTarget > 0) return;

      this.renderer.autoClear = true;
      this.renderer.clear();
      this.hoverTarget = 1;
      this.burstTarget = 1;
      this.container.classList.remove("is-hypercube-hovered");
      this.container.classList.add("is-hypercube-bursting");
      if (this.cardStream) {
        this.cardStream.activate();
      }
    }

    setParticleData(i, start, end, posStart, posEnd, squarePos, burstPos, offsets, burst) {
      const index = i * 3;
      const square = this.getHoverTargetPoint(i, offsets.length);

      posStart[index] = start.x;
      posStart[index + 1] = start.y;
      posStart[index + 2] = start.z;
      posEnd[index] = end.x;
      posEnd[index + 1] = end.y;
      posEnd[index + 2] = end.z;
      squarePos[index] = square.x;
      squarePos[index + 1] = square.y;
      squarePos[index + 2] = square.z;
      burstPos[index] = burst.x;
      burstPos[index + 1] = burst.y;
      burstPos[index + 2] = burst.z;
      offsets[i] = Utils.random();
    }

    createTrails(burstPos, offsets, burstMask) {
      const sourceIndices = [];
      for (let i = 0; i < offsets.length; i++) {
        if (burstMask[i] > 0) {
          sourceIndices.push(i);
        }
      }
      this.burstSourceIndices = sourceIndices;
      this.trailSourceIndices = sourceIndices;
      const total = sourceIndices.length;
      const trailGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(total * 2 * 3);
      const trailBurstPos = new Float32Array(total * 2 * 3);
      const trailStep = new Float32Array(total * 2);
      const trailOffsets = new Float32Array(total * 2);

      for (let i = 0; i < total; i++) {
        const sourceIndex = sourceIndices[i];
        const srcIndex = sourceIndex * 3;
        const dstIndex = i * 6;
        const stepIndex = i * 2;

        for (let v = 0; v < 2; v++) {
          trailBurstPos[dstIndex + v * 3] = burstPos[srcIndex];
          trailBurstPos[dstIndex + v * 3 + 1] = burstPos[srcIndex + 1];
          trailBurstPos[dstIndex + v * 3 + 2] = burstPos[srcIndex + 2];
          trailOffsets[stepIndex + v] = offsets[sourceIndex];
        }

        trailStep[stepIndex] = 0;
        trailStep[stepIndex + 1] = 1;
      }

      trailGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      trailGeo.setAttribute("burstPos", new THREE.BufferAttribute(trailBurstPos, 3));
      trailGeo.setAttribute("trailStep", new THREE.BufferAttribute(trailStep, 1));
      trailGeo.setAttribute("offset", new THREE.BufferAttribute(trailOffsets, 1));
      this.trailBurstPositionAttribute = trailGeo.getAttribute("burstPos");

      this.trailMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBurst: { value: 0 },
          uColor: { value: new THREE.Color(this.foreground) },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uBurst;
          attribute vec3 burstPos;
          attribute float trailStep;
          attribute float offset;
          varying float vAlpha;

          void main() {
            float radius = length(burstPos.xy);
            float orbitSpeed = mix(0.05, 0.2, fract(offset * 19.73));
            orbitSpeed *= mix(1.35, 0.55, smoothstep(0.0, 6.5, radius));
            float trailLength = mix(0.0, 0.18, uBurst);
            float angle = uTime * orbitSpeed + offset * 6.2831853 - trailStep * trailLength;
            float ca = cos(angle);
            float sa = sin(angle);
            vec3 currentPos = vec3(
              burstPos.x * ca - burstPos.y * sa,
              burstPos.x * sa + burstPos.y * ca,
              0.0
            );

            vAlpha = uBurst * mix(0.34, 0.0, trailStep);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(currentPos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;

          void main() {
            gl_FragColor = vec4(uColor, vAlpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });

      this.trails = new THREE.LineSegments(trailGeo, this.trailMat);
      this.scene.add(this.trails);
    }

    getHoverTargetPoint(i, total) {
      if (this.hoverTargetPoints.length) {
        return this.hoverTargetPoints[i % this.hoverTargetPoints.length];
      }

      return this.getSquarePoint(i, total);
    }

    async loadHoverTargetPoints(total) {
      try {
        const image = await this.loadImage("/assets/images/fullEye.svg");
        const maxCanvasSide = 360;
        const scale = maxCanvasSide / Math.max(image.naturalWidth, image.naturalHeight);
        const width = Math.max(Math.round(image.naturalWidth * scale), 1);
        const height = Math.max(Math.round(image.naturalHeight * scale), 1);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height).data;
        const samples = [];
        let totalWeight = 0;
        let totalDarkWeight = 0;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const alpha = imageData[idx + 3] / 255;
            const brightness = (
              imageData[idx] * 0.2126 +
              imageData[idx + 1] * 0.7152 +
              imageData[idx + 2] * 0.0722
            ) / 255;
            const weight = brightness * alpha;
            const darkWeight = (1 - brightness) * alpha;

            totalWeight += weight * weight;
            totalDarkWeight += darkWeight * darkWeight;
            samples.push({ x, y, weight, darkWeight });
          }
        }

        const useDarkWeight = totalWeight <= 0.001 && totalDarkWeight > 0.001;
        const cumulative = [];
        const weightedPixels = [];
        let activeWeight = 0;

        samples.forEach((sample) => {
          const weight = useDarkWeight ? sample.darkWeight : sample.weight;

          if (weight <= 0.03) return;

          activeWeight += weight * weight;
          weightedPixels.push(sample);
          cumulative.push(activeWeight);
        });

        if (!weightedPixels.length || activeWeight <= 0) {
          return [];
        }

        const targetSize = 0.92 * 4.0;
        const aspect = width / height;
        const targetWidth = aspect >= 1 ? targetSize : targetSize * aspect;
        const targetHeight = aspect >= 1 ? targetSize / aspect : targetSize;
        const points = [];

        for (let i = 0; i < total; i++) {
          const pick = Utils.hash(i * 19.73 + 3.17) * activeWeight;
          const pixelIndex = this.findWeightedPixel(cumulative, pick);
          const pixel = weightedPixels[pixelIndex];
          const jitterX = Utils.hash(i * 31.11 + 7.91) - 0.5;
          const jitterY = Utils.hash(i * 43.87 + 11.29) - 0.5;
          const u = (pixel.x + 0.5 + jitterX) / width;
          const v = (pixel.y + 0.5 + jitterY) / height;
          const x = (u - 0.5) * targetWidth;
          const y = (0.5 - v) * targetHeight;

          points.push(new THREE.Vector3(x, y, 0));
        }

        return points;
      } catch (error) {
        console.warn("Failed to load hover target image", error);
        return [];
      }
    }

    loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }

    findWeightedPixel(cumulative, value) {
      let low = 0;
      let high = cumulative.length - 1;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);

        if (cumulative[mid] < value) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      return low;
    }

    getSquarePoint(i, total) {
      const squareSize = 0.92;
      const side = Math.floor((i / total) * 4);
      const t = ((i / total) * 4) % 1;
      const half = squareSize / 2;

      if (side === 0) return new THREE.Vector3(THREE.MathUtils.lerp(-half, half, t), half, 0);
      if (side === 1) return new THREE.Vector3(half, THREE.MathUtils.lerp(half, -half, t), 0);
      if (side === 2) return new THREE.Vector3(THREE.MathUtils.lerp(half, -half, t), -half, 0);
      return new THREE.Vector3(-half, THREE.MathUtils.lerp(-half, half, t), 0);
    }

    getBurstPoint(i, total) {
      const side = this.getBurstSideLength();
      const cols = Math.ceil(Math.sqrt(total));
      const rows = Math.ceil(total / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = side / Math.max(cols - 1, 1);
      const cellY = side / Math.max(rows - 1, 1);
      const jitterX = (Utils.hash(i * 2) - 0.5) * cellX * 0.55;
      const jitterY = (Utils.hash(i * 2 + 1) - 0.5) * cellY * 0.55;
      const x = THREE.MathUtils.lerp(-side / 2, side / 2, col / Math.max(cols - 1, 1)) + jitterX;
      const y = THREE.MathUtils.lerp(-side / 2, side / 2, row / Math.max(rows - 1, 1)) + jitterY;

      return new THREE.Vector3(x, y, 0);
    }

    getBurstSideLength() {
      const distance = this.camera.position.z;
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * distance;
      const visibleWidth = visibleHeight * this.camera.aspect;

      return Math.hypot(visibleWidth, visibleHeight) * 1.18;
    }

    updateBurstPositions() {
      if (!this.burstPositionAttribute) return;

      const visibleTotal = this.burstSourceIndices.length;
      this.burstSourceIndices.forEach((sourceIndex, visibleIndex) => {
        const point = this.getBurstPoint(visibleIndex, visibleTotal);
        this.burstPositionAttribute.setXYZ(sourceIndex, point.x, point.y, point.z);
      });
      this.burstPositionAttribute.needsUpdate = true;
      if (this.trailBurstPositionAttribute) {
        this.trailSourceIndices.forEach((_, trailIndex) => {
          const point = this.getBurstPoint(trailIndex, visibleTotal);
          this.trailBurstPositionAttribute.setXYZ(trailIndex * 2, point.x, point.y, point.z);
          this.trailBurstPositionAttribute.setXYZ(trailIndex * 2 + 1, point.x, point.y, point.z);
        });
        this.trailBurstPositionAttribute.needsUpdate = true;
      }
    }
  }

  class Utils {
    static random() {
      return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    }

    static hash(value) {
      const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;

      return x - Math.floor(x);
    }
  }

  function smoothstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);

    return t * t * (3 - 2 * t);
  }
})();
