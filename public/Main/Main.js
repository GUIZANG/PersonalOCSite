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

    init() {
      const particlesPerEdge = 200;
      const sizeOut = 0.5;
      const sizeIn = 0.25;
      const cubeEdges = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      const unitCorners = [];
      const geo = new THREE.BufferGeometry();
      const totalParticles = cubeEdges.length * particlesPerEdge;
      const posStart = new Float32Array(totalParticles * 3);
      const posEnd = new Float32Array(totalParticles * 3);
      const squarePos = new Float32Array(totalParticles * 3);
      const burstPos = new Float32Array(totalParticles * 3);
      const offsets = new Float32Array(totalParticles);
      let pIdx = 0;

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

        for (let p = 0; p < particlesPerEdge; p++) {
          const t = p / particlesPerEdge;
          const edgePoint = new THREE.Vector3().lerpVectors(vA, vB, t);
          const start = edgePoint.clone().multiplyScalar(sizeOut);
          const end = edgePoint.clone().multiplyScalar(sizeIn);
          const inward = pIdx % 2 === 0;

          this.setParticleData(
            pIdx,
            inward ? start : end,
            inward ? end : start,
            posStart,
            posEnd,
            squarePos,
            burstPos,
            offsets
          );
          pIdx++;
        }
      });

      geo.setAttribute("position", new THREE.BufferAttribute(posStart, 3));
      geo.setAttribute("targetPos", new THREE.BufferAttribute(posEnd, 3));
      geo.setAttribute("squarePos", new THREE.BufferAttribute(squarePos, 3));
      geo.setAttribute("burstPos", new THREE.BufferAttribute(burstPos, 3));
      geo.setAttribute("offset", new THREE.BufferAttribute(offsets, 1));
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
            vec3 squareTarget = squarePos + vec3(0.0, 0.0, sin(uTime * 1.5 + offset * 6.2831853) * 0.015);
            vec3 collapsedPos = mix(cubePos, squareTarget, cubicBezierEase(uHover));

            float radius = length(burstPos.xy);
            float orbitSpeed = mix(0.05, 0.2, fract(offset * 19.73));
            orbitSpeed *= mix(1.35, 0.55, smoothstep(0.0, 6.5, radius));
            float angle = uTime * orbitSpeed + offset * 6.2831853;
            float ca = cos(angle);
            float sa = sin(angle);
            vec3 rotatedBurst = vec3(
              burstPos.x * ca - burstPos.y * sa,
              burstPos.x * sa + burstPos.y * ca,
              burstPos.z
            );
            float burstEase = cubicBezierEase(uBurst);
            vec3 currentPos = mix(collapsedPos, rotatedBurst, burstEase);

            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
            float dustScale = mix(1.0, 0.72, burstEase);
            gl_PointSize = (uResolution / 160.0) * dustScale * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;

          void main() {
            if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
            gl_FragColor = vec4(uColor, 1.0);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      this.tesseract = new THREE.Points(geo, this.mat);
      this.tesseract.rotation.x = this.baseRotationX;
      this.scene.add(this.tesseract);

      this.createTrails(burstPos, offsets);

      window.addEventListener("resize", this.onResize);
      this.container.addEventListener("pointermove", this.onPointerMove);
      this.container.addEventListener("pointerleave", this.onPointerLeave);
      this.container.addEventListener("pointerdown", this.onPointerDown);
      this.animate(0);
    }

    animate(time) {
      if (this.tesseract) {
        const msToSeconds = this.duration / 1000;
        const cubeRotationAmount = 1 - this.burstAmount;
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

      if (this.trailMat) {
        this.trailMat.uniforms.uTime.value = time / 1000;
        this.trailMat.uniforms.uBurst.value = this.burstAmount;
      }

      if (this.burstAmount > 0.02) {
        this.renderer.autoClear = false;
        this.fadeMaterial.opacity = THREE.MathUtils.lerp(0.34, 0.08, this.burstAmount);
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

      this.hoverTarget = 1;
      this.burstTarget = 1;
      this.container.classList.remove("is-hypercube-hovered");
      this.container.classList.add("is-hypercube-bursting");
      if (this.cardStream) {
        this.cardStream.activate();
      }
    }

    setParticleData(i, start, end, posStart, posEnd, squarePos, burstPos, offsets) {
      const index = i * 3;
      const square = this.getSquarePoint(i, offsets.length);
      const burst = this.getBurstPoint(i, offsets.length);

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

    createTrails(burstPos, offsets) {
      const total = offsets.length;
      const trailGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(total * 2 * 3);
      const trailBurstPos = new Float32Array(total * 2 * 3);
      const trailStep = new Float32Array(total * 2);
      const trailOffsets = new Float32Array(total * 2);

      for (let i = 0; i < total; i++) {
        const srcIndex = i * 3;
        const dstIndex = i * 6;
        const stepIndex = i * 2;

        for (let v = 0; v < 2; v++) {
          trailBurstPos[dstIndex + v * 3] = burstPos[srcIndex];
          trailBurstPos[dstIndex + v * 3 + 1] = burstPos[srcIndex + 1];
          trailBurstPos[dstIndex + v * 3 + 2] = burstPos[srcIndex + 2];
          trailOffsets[stepIndex + v] = offsets[i];
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

      const total = this.burstPositionAttribute.count;
      for (let i = 0; i < total; i++) {
        const point = this.getBurstPoint(i, total);
        this.burstPositionAttribute.setXYZ(i, point.x, point.y, point.z);
        if (this.trailBurstPositionAttribute) {
          this.trailBurstPositionAttribute.setXYZ(i * 2, point.x, point.y, point.z);
          this.trailBurstPositionAttribute.setXYZ(i * 2 + 1, point.x, point.y, point.z);
        }
      }
      this.burstPositionAttribute.needsUpdate = true;
      if (this.trailBurstPositionAttribute) {
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
})();
