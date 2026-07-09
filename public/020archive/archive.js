(function () {
  window.addEventListener("DOMContentLoaded", () => {
    const stage = document.getElementById("hypercube-stage");
    const cardStream = new window.ArchiveCardStream();
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
      this.hoverDustAmount = 0;
      this.hoverDustTarget = 0;
      this.isHoverDustExiting = false;
      this.burstAmount = 0;
      this.burstTarget = 0;
      this.pressAmount = 0;
      this.pressStartTime = 0;
      this.pressPointerId = null;
      this.longPressDuration = 3000;
      this.hoverEnterRadiusRatio = 0.16;
      this.hoverExitRadiusRatio = 0.4;
      this.pressRadiusRatio = 0.06;
      this.pressOffsetXRatio = -0.015;
      this.pressOffsetYRatio = 0.015;
      this.baseRotationX = Math.sin(45 * Math.PI / 180);
      this.cubeCloud = null;
      this.mat = null;
      this.hoverDustGroup = null;
      this.hoverDust = null;
      this.hoverDustMat = null;
      this.hoverDustRays = null;
      this.hoverDustRayMat = null;
      this.hoverCenterDotEl = null;
      this.cursorSnapActive = false;
      this.hoverLookTarget = new THREE.Vector2();
      this.hoverLookCurrent = new THREE.Vector2();
      this.hoverLookMaxTilt = 0.42;
      this.hoverCenterSnapRadius = 10;
      this.hoverTiltEuler = new THREE.Euler();
      this.hoverTiltMatrix4 = new THREE.Matrix4();
      this.hoverTiltMatrix3 = new THREE.Matrix3();
      this.trails = null;
      this.trailMat = null;
      this.burstPositionAttribute = null;
      this.trailBurstPositionAttribute = null;
      this.burstSourceIndices = [];
      this.trailSourceIndices = [];
      this.hoverTargetPoints = [];
      this.scanRaycaster = new THREE.Raycaster();
      this.scanPointer = new THREE.Vector2();
      this.scanJitterPointer = new THREE.Vector2();
      this.scanHitTarget = null;
      this.scanProbes = [];
      this.scanProbeCount = 6;
      this.scanMinProbeCount = 2;
      this.scanFadeDelay = 140;
      this.scanLastMoveTime = -Infinity;
      this.scanLastRefreshTime = -Infinity;
      this.scanLastPointer = null;
      this.scanAnchorPoints = [];
      this.scanAnchorDots = [];
      this.scanAnchorSignature = "";
      this.scanActiveAnchors = [];
      this.scanAttractRadius = 430;
      this.scanAvoidPointerRadius = 76;
      this.scanMaxOverlapRatio = 0.5;
      this.scanAnchorDeadRadiusRatio = 0.22;
      this.scanAnchorMinDistance = 12;
      this.scanWordBank = Array.isArray(window.ArchiveScanLexicon) && window.ArchiveScanLexicon.length
        ? window.ArchiveScanLexicon
        : [
            "SUBCONSCIOUS TRACE",
            "MNEMONIC ECHO",
            "ENTITY RECORD",
            "COGNITIVE HAZARD",
            "THE LANTERN EATER",
            "EYELESS CURATOR",
          ];

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

      // The liquid-glass pass samples this WebGL canvas via drawImage(). Keep
      // the presented frame available so the card refraction can see the main
      // cardstream starfield/hypercube background instead of a cleared buffer.
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(this.background, 1);

      this.container.insertBefore(this.renderer.domElement, this.container.firstChild);
      window.ArchiveCardVFX?.attachLiquidSource?.(this.renderer.domElement);
      this.pressTargetGuide = document.createElement("div");
      this.pressTargetGuide.className = "hypercube-press-target-guide";
      this.container.appendChild(this.pressTargetGuide);
      this.initThoughtScannerOverlay();

      this.animate = this.animate.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
    }

    async init() {
      const cubeParticlesPerEdge = 400;
      const burstParticlesPerEdge = 200;
      const initialHoverCoreParticlesPerEdge = 1800;
      const hoverCoreParticlesPerEdge = 10800;
      const hoverScatterParticlesPerEdge = 0;
      const hoverParticlesPerEdge = hoverCoreParticlesPerEdge + hoverScatterParticlesPerEdge;
      const outerScale = 0.5;
      const innerScale = 0.25;
      // 12 wireframe edges expressed as ordered corner-index pairs.
      const edgeLinks = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      const cornerNodes = [];
      const geo = new THREE.BufferGeometry();
      const totalParticles = edgeLinks.length * hoverParticlesPerEdge;
      const posStart = new Float32Array(totalParticles * 3);
      const posEnd = new Float32Array(totalParticles * 3);
      const squarePos = new Float32Array(totalParticles * 3);
      const burstPos = new Float32Array(totalParticles * 3);
      const offsets = new Float32Array(totalParticles);
      const cubeMask = new Float32Array(totalParticles);
      const burstMask = new Float32Array(totalParticles);
      const hoverMask = new Float32Array(totalParticles);
      const pressThreshold = new Float32Array(totalParticles);
      let pIdx = 0;
      let burstVisibleIndex = 0;
      let cubeVisibleIndex = 0;

      this.hoverTargetPoints = await this.loadHoverTargetPoints(
        totalParticles,
        hoverCoreParticlesPerEdge,
        hoverParticlesPerEdge
      );

      // Derive the 8 cube corners from the bits of their index so corner N maps
      // to the same coordinate the edge table expects (bit4=x, bit2=y, bit1=z).
      for (let n = 0; n < 8; n++) {
        cornerNodes.push(new THREE.Vector3(
          n & 4 ? 1 : -1,
          n & 2 ? 1 : -1,
          n & 1 ? 1 : -1
        ));
      }

      edgeLinks.forEach((edge) => {
        const [cornerA, cornerB] = edge;
        const vA = cornerNodes[cornerA];
        const vB = cornerNodes[cornerB];

        for (let p = 0; p < hoverParticlesPerEdge; p++) {
          const t = p / hoverParticlesPerEdge;
          const edgePoint = new THREE.Vector3().lerpVectors(vA, vB, t);
          const start = edgePoint.clone().multiplyScalar(outerScale);
          const end = edgePoint.clone().multiplyScalar(innerScale);
          const isCubeVisible = this.isVisibleSample(p, hoverParticlesPerEdge, cubeParticlesPerEdge);
          const isBurstVisible = this.isVisibleSample(p, hoverParticlesPerEdge, burstParticlesPerEdge);
          const isCoreLayer = p < hoverCoreParticlesPerEdge;
          const isInitialCoreVisible = isCoreLayer &&
            this.isVisibleSample(p, hoverCoreParticlesPerEdge, initialHoverCoreParticlesPerEdge);
          const isScatterLayer = !isCoreLayer;
          const inward = isCubeVisible ? cubeVisibleIndex % 2 === 0 : pIdx % 2 === 0;
          const burst = isBurstVisible
            ? this.getBurstPoint(burstVisibleIndex++, edgeLinks.length * burstParticlesPerEdge)
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
          hoverMask[pIdx] = (isInitialCoreVisible || isScatterLayer) ? 1 : 0;
          pressThreshold[pIdx] = isCoreLayer ? Math.max(Utils.hash(pIdx * 23.17 + 5.91), 0.001) : 2;
          if (isCubeVisible) cubeVisibleIndex++;
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
      geo.setAttribute("hoverMask", new THREE.BufferAttribute(hoverMask, 1));
      geo.setAttribute("pressThreshold", new THREE.BufferAttribute(pressThreshold, 1));
      this.burstPositionAttribute = geo.getAttribute("burstPos");

      this.mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uBurst: { value: 0 },
          uPress: { value: 0 },
          uColor: { value: new THREE.Color(this.foreground) },
          uResolution: { value: window.innerHeight * Math.min(window.devicePixelRatio, 2) },
          uHoverTilt: { value: new THREE.Matrix3() },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uHover;
          uniform float uBurst;
          uniform float uPress;
          uniform float uResolution;
          uniform mat3 uHoverTilt;
          attribute vec3 targetPos;
          attribute vec3 squarePos;
          attribute vec3 burstPos;
          attribute float offset;
          attribute float cubeMask;
          attribute float burstMask;
          attribute float hoverMask;
          attribute float pressThreshold;
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
            vec3 tiltedSquare = uHoverTilt * squarePos;
            vec3 hoverTarget = vec3(
              dot(worldRotation[0], tiltedSquare),
              dot(worldRotation[1], tiltedSquare),
              dot(worldRotation[2], tiltedSquare)
            ) * (1.5 + uPress * 0.12);
            float hoverEase = cubicBezierEase(uHover);
            float hoverMotion = smoothstep(0.72, 1.0, hoverEase) * (1.0 - uBurst);
            vec2 hoverDir = normalize(squarePos.xy + vec2(0.0001));
            vec2 hoverTangent = vec2(-hoverDir.y, hoverDir.x);
            float drift = sin(uTime * 2.4 + offset * 18.8496) * 0.012;
            float shimmer = cos(uTime * 3.1 + offset * 11.73) * 0.006;
            vec3 hoverWiggle = vec3(hoverTangent * drift + hoverDir * shimmer, 0.0) * hoverMotion;
            vec3 collapsedPos = mix(cubePos, hoverTarget + hoverWiggle, hoverEase);

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
            float pressReveal = step(pressThreshold, uPress);
            float edgeAmount = smoothstep(1.08, 1.66, max(abs(squarePos.x), abs(squarePos.y)));
            float edgeAlpha = mix(1.0, 0.5, edgeAmount);
            float hoverAlpha = max(hoverMask, pressReveal) * edgeAlpha;
            float stageAlpha = mix(cubeMask, hoverAlpha, hoverEase);
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

      this.cubeCloud = new THREE.Points(geo, this.mat);
      this.cubeCloud.rotation.x = this.baseRotationX;
      this.cubeCloud.renderOrder = 2;
      this.createHoverDust();
      this.scene.add(this.cubeCloud);

      this.createTrails(burstPos, offsets, burstMask);
      this.createThoughtScannerTarget();

      window.addEventListener("resize", this.onResize);
      this.container.addEventListener("pointermove", this.onPointerMove);
      this.container.addEventListener("pointerleave", this.onPointerLeave);
      this.container.addEventListener("pointerdown", this.onPointerDown);
      this.container.addEventListener("pointerup", this.onPointerUp);
      this.container.addEventListener("pointercancel", this.onPointerUp);
      this.updatePressTargetGuide();
      this.animate(0);
    }

    animate(time) {
      if (this.cubeCloud) {
        const msToSeconds = this.duration / 1000;
        const cubeRotationAmount = this.burstTarget > 0 ? 0 : 1;
        this.cubeCloud.rotation.x = this.baseRotationX * cubeRotationAmount;
        this.cubeCloud.rotation.y = (time / 1000) * (Math.PI * 2 / msToSeconds) * cubeRotationAmount;
        this.cubeCloud.rotation.y %= Math.PI * 2;
      }

      this.hoverAmount += (this.hoverTarget - this.hoverAmount) * 0.08;
      this.updateHoverDustState();
      this.hoverDustAmount += (this.hoverDustTarget - this.hoverDustAmount) * 0.12;
      this.updateHoverLookTransform();
      this.burstAmount += (this.burstTarget - this.burstAmount) * 0.025;

      if (this.pressPointerId !== null && this.burstTarget === 0) {
        this.pressAmount = Math.min((performance.now() - this.pressStartTime) / this.longPressDuration, 1);
        this.updateCursorPressState(true);
        if (this.pressAmount >= 1) {
          this.activateBurst();
        }
      } else if (this.burstTarget > 0) {
        this.pressAmount = 1;
      } else {
        this.pressAmount += (0 - this.pressAmount) * 0.12;
        this.updateCursorPressState(false);
      }

      if (this.mat) {
        this.mat.uniforms.uTime.value = time / 1000;
        this.mat.uniforms.uHover.value = this.hoverAmount;
        this.mat.uniforms.uBurst.value = this.burstAmount;
        this.mat.uniforms.uPress.value = this.pressAmount;
      }

      if (this.hoverDustMat) {
        this.hoverDustMat.uniforms.uTime.value = time / 1000;
        this.hoverDustMat.uniforms.uHover.value = this.hoverDustAmount;
        this.hoverDustMat.uniforms.uBurst.value = this.burstAmount;
        this.hoverDustMat.uniforms.uPress.value = this.pressAmount;
      }
      if (this.hoverDustRayMat) {
        this.hoverDustRayMat.uniforms.uHover.value = this.hoverDustAmount;
        this.hoverDustRayMat.uniforms.uBurst.value = this.burstAmount;
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
      if (this.hoverDustMat) {
        this.hoverDustMat.uniforms.uResolution.value = window.innerHeight * Math.min(window.devicePixelRatio, 2);
      }
      if (this.hoverDustGroup) {
        const hoverCenter = this.getHoverDustCenter();
        this.hoverDustGroup.position.set(hoverCenter.x, hoverCenter.y, 0);
      }
      this.updatePressTargetGuide();
      this.updateBurstPositions();
    }

    onPointerMove(event) {
      if (this.burstTarget > 0) {
        this.hideThoughtScanner(true);
        return;
      }

      const { distance, rect } = this.getCenterDistance(event);
      const base = Math.min(rect.width, rect.height);
      const isHovering = this.hoverTarget === 1 || this.hoverAmount > 0.18;
      const hitRadius = base * (isHovering ? this.hoverExitRadiusRatio : this.hoverEnterRadiusRatio);

      if (distance < hitRadius) {
        this.enterHover();
      } else {
        this.exitHover();
      }

      this.updateHoverLookTarget(event, distance < hitRadius);
      this.updateCursorSnap(event);
      this.updateThoughtScanner(event, distance >= hitRadius);

      if (this.pressPointerId === event.pointerId && !this.isInPressCenter(event)) {
        this.cancelLongPress();
      }
    }

    updateCursorSnap(event) {
      const { distance, rect } = this.getPressDistance(event);
      const center = this.getPressCenter(rect);
      const active = distance <= this.getCursorSnapRadius();
      this.cursorSnapActive = active;

      window.dispatchEvent(new CustomEvent("archive:cursor-snap", {
        detail: {
          active,
          x: center.x,
          y: center.y,
        },
      }));
    }

    getCursorSnapRadius() {
      const desktopReferenceHeight = 1080;
      const desktopOuterSize = 25;
      const hoverScale = 1.8;
      const dotRadius = 2.5;
      const scaled = desktopOuterSize * (window.innerHeight / desktopReferenceHeight);
      const outerSize = Math.max(2, Math.round(scaled / 2) * 2);

      return (outerSize / 2) * hoverScale + dotRadius;
    }

    onPointerLeave() {
      this.hideThoughtScanner(true);
      this.resetHoverLookTarget();
      this.cursorSnapActive = false;
      window.dispatchEvent(new CustomEvent("archive:cursor-snap", { detail: { active: false } }));
      if (this.burstTarget > 0) return;

      this.cancelLongPress();
      this.exitHover();
    }

    onPointerDown(event) {
      if (event.button !== 0) return;
      if (this.burstTarget > 0 || !this.isInPressCenter(event)) return;

      this.pressStartTime = performance.now();
      this.pressPointerId = event.pointerId;
      this.updateCursorPressState(true);
      this.enterHover();
      this.container.setPointerCapture?.(event.pointerId);
    }

    onPointerUp(event) {
      if (this.pressPointerId !== event.pointerId) return;

      this.cancelLongPress();
      this.container.releasePointerCapture?.(event.pointerId);
    }

    enterHover() {
      this.isHoverDustExiting = false;
      this.hoverTarget = 1;
      this.container.classList.add("is-hypercube-hovered");
    }

    exitHover() {
      this.hoverDustTarget = 0;
      this.isHoverDustExiting = this.hoverDustAmount > 0.02;

      if (!this.isHoverDustExiting) {
        this.hoverTarget = 0;
        this.container.classList.remove("is-hypercube-hovered");
      }
    }

    updateHoverDustState() {
      if (this.burstTarget > 0) {
        this.hoverDustTarget = 0;
        return;
      }

      if (this.isHoverDustExiting) {
        this.hoverDustTarget = 0;
        if (this.hoverDustAmount <= 0.035) {
          this.isHoverDustExiting = false;
          this.hoverTarget = 0;
          this.container.classList.remove("is-hypercube-hovered");
        }
        return;
      }

      this.hoverDustTarget = this.hoverTarget === 1 && this.hoverAmount > 0.86 ? 1 : 0;
    }

    updateHoverLookTarget(event, active) {
      if (!active || !this.hoverDustGroup) {
        this.resetHoverLookTarget();
        return;
      }

      const rect = this.renderer.domElement.getBoundingClientRect();
      const center = this.getPressCenter(rect);
      const base = Math.min(rect.width, rect.height);
      const x = (event.clientX - center.x) / (base * 0.5);
      const y = (event.clientY - center.y) / (base * 0.5);

      this.hoverLookTarget.set(
        THREE.MathUtils.clamp(x, -1, 1),
        THREE.MathUtils.clamp(y, -1, 1)
      );
    }

    resetHoverLookTarget() {
      this.hoverLookTarget.set(0, 0);
    }

    updateHoverLookTransform() {
      this.hoverLookCurrent.lerp(this.hoverLookTarget, 0.12);
      const active = smoothstep(0.18, 0.92, this.hoverAmount) * (1 - this.burstAmount);
      const tiltX = -this.hoverLookCurrent.y * this.hoverLookMaxTilt * active;
      const tiltY = this.hoverLookCurrent.x * this.hoverLookMaxTilt * active;

      if (this.hoverDustGroup) {
        this.hoverDustGroup.rotation.set(tiltX, tiltY, 0);
      }

      if (this.mat) {
        this.hoverTiltEuler.set(tiltX, tiltY, 0);
        this.hoverTiltMatrix4.makeRotationFromEuler(this.hoverTiltEuler);
        this.hoverTiltMatrix3.setFromMatrix4(this.hoverTiltMatrix4);
        this.mat.uniforms.uHoverTilt.value.copy(this.hoverTiltMatrix3);
      }

      if (this.hoverCenterDotEl) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const center = this.getPressCenter(rect);
        const pressRadius = this.getPressRadius(rect);
        let ox = this.hoverLookCurrent.x;
        let oy = this.hoverLookCurrent.y;
        const len = Math.hypot(ox, oy);

        if (len > 1) {
          ox /= len;
          oy /= len;
        }

        // While the cursor is magnetically snapped to the press center, keep the
        // red dot exactly on that center so it stays concentric with the
        // cursor's inner circle and long-press range ring.
        const dotOffset = this.cursorSnapActive ? 0 : pressRadius;
        const dotX = center.x + ox * dotOffset;
        const dotY = center.y + oy * dotOffset;
        const opacity = Math.max(this.hoverDustAmount, this.pressAmount) * (1 - this.burstAmount);

        this.hoverCenterDotEl.style.setProperty("--dot-x", `${dotX}px`);
        this.hoverCenterDotEl.style.setProperty("--dot-y", `${dotY}px`);
        this.hoverCenterDotEl.style.setProperty("--dot-opacity", opacity.toFixed(3));
      }
    }

    activateBurst() {
      if (this.burstTarget > 0) return;

      this.renderer.autoClear = true;
      this.renderer.clear();
      this.pressPointerId = null;
      this.pressAmount = 1;
      this.updateCursorPressState(false);
      this.hoverTarget = 1;
      this.burstTarget = 1;
      this.container.classList.remove("is-hypercube-hovered");
      this.container.classList.add("is-hypercube-bursting");
      this.hideThoughtScanner(true);
      this.cursorSnapActive = false;
      window.dispatchEvent(new CustomEvent("archive:cursor-snap", { detail: { active: false } }));
      window.dispatchEvent(new CustomEvent("archive:hypercube-burst"));
      if (this.cardStream) {
        this.cardStream.activate();
      }
    }

    cancelLongPress() {
      this.pressStartTime = 0;
      this.pressPointerId = null;
      this.updateCursorPressState(false);
    }

    isInPressCenter(event) {
      const { distance, rect } = this.getPressDistance(event);
      const pressRadius = this.getPressRadius(rect);

      return distance < pressRadius;
    }

    updatePressTargetGuide() {
      if (!this.pressTargetGuide) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      const diameter = this.getPressRadius(rect) * 2;
      const center = this.getPressCenter(rect);

      this.pressTargetGuide.style.left = `${center.x}px`;
      this.pressTargetGuide.style.top = `${center.y}px`;
      this.pressTargetGuide.style.width = `${diameter}px`;
      this.pressTargetGuide.style.height = `${diameter}px`;
    }

    updateCursorPressState(active) {
      window.dispatchEvent(new CustomEvent("archive:hypercube-long-press", {
        detail: {
          active,
          progress: active ? this.pressAmount : 0,
        },
      }));
    }

    getPressRadius(rect) {
      return Math.min(rect.width, rect.height) * this.pressRadiusRatio;
    }

    getPressCenter(rect) {
      const base = Math.min(rect.width, rect.height);

      return {
        x: rect.left + rect.width / 2 + base * this.pressOffsetXRatio,
        y: rect.top + rect.height / 2 + base * this.pressOffsetYRatio,
      };
    }

    getPressDistance(event) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const center = this.getPressCenter(rect);

      return {
        distance: Math.hypot(event.clientX - center.x, event.clientY - center.y),
        rect,
      };
    }

    getCenterDistance(event) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;

      return {
        distance: Math.hypot(x, y),
        rect,
      };
    }

    initThoughtScannerOverlay() {
      this.scanOverlay = document.getElementById("archiveThoughtScanner");
      if (!this.scanOverlay) {
        this.scanOverlay = document.createElement("div");
        this.scanOverlay.id = "archiveThoughtScanner";
        this.scanOverlay.className = "archive-thought-scanner";
        this.container.appendChild(this.scanOverlay);
      }

      this.scanLineSvg = document.getElementById("archiveThoughtScannerLines");
      if (!this.scanLineSvg) {
        this.scanLineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.scanLineSvg.id = "archiveThoughtScannerLines";
        this.scanLineSvg.classList.add("archive-thought-scanner__lines");
        this.scanOverlay.appendChild(this.scanLineSvg);
      }

      this.scanAnchorContainer = document.createElement("div");
      this.scanAnchorContainer.className = "archive-thought-scanner__anchors";
      this.scanOverlay.appendChild(this.scanAnchorContainer);

      this.scanProbeContainer = document.getElementById("archiveThoughtScannerProbes");
      if (!this.scanProbeContainer) {
        this.scanProbeContainer = document.createElement("div");
        this.scanProbeContainer.id = "archiveThoughtScannerProbes";
        this.scanProbeContainer.className = "archive-thought-scanner__probes";
        this.scanOverlay.appendChild(this.scanProbeContainer);
      }

      for (let i = 0; i < this.scanProbeCount; i++) {
        const probe = document.createElement("div");
        probe.className = "archive-thought-probe";
        probe.style.setProperty("--scan-opacity", "0");

        const label = document.createElement("div");
        label.className = "archive-thought-probe__label";
        const readout = document.createElement("div");
        readout.className = "archive-thought-probe__readout";

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add("archive-thought-scanner__line");
        line.style.setProperty("--scan-opacity", "0");

        probe.append(label, readout);
        this.scanProbeContainer.appendChild(probe);
        this.scanLineSvg.appendChild(line);
        this.scanProbes.push({
          element: probe,
          label,
          readout,
          line,
          anchorId: null,
          lastWordAt: -Infinity,
          renderX: null,
          renderY: null,
        });
      }
    }

    createThoughtScannerTarget() {
      const geometry = new THREE.SphereGeometry(2.45, 32, 18);
      const material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      });

      this.scanHitTarget = new THREE.Mesh(geometry, material);
      this.scanHitTarget.name = "thought-scanner-proxy";
      this.scanHitTarget.renderOrder = -10;
      this.scene.add(this.scanHitTarget);
    }

    updateThoughtScanner(event, enabled) {
      if (!enabled || this.pressPointerId !== null || !this.scanProbes.length) {
        this.hideThoughtScanner();
        return;
      }

      const rect = this.renderer.domElement.getBoundingClientRect();
      const now = performance.now();
      const pointer = {
        x: event.clientX,
        y: event.clientY,
      };
      const pointerSpeed = this.scanLastPointer
        ? Math.hypot(pointer.x - this.scanLastPointer.x, pointer.y - this.scanLastPointer.y)
        : 0;

      this.scanLastPointer = pointer;
      this.scanLastMoveTime = now;
      this.ensureThoughtScannerAnchors(rect);
      this.scanPointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      );

      const nearbyAnchorCount = this.countNearbyThoughtScannerAnchors(pointer);
      const count = THREE.MathUtils.clamp(
        Math.min(nearbyAnchorCount, pointerSpeed > 2 ? 4 : 3),
        2,
        4
      );
      const shouldRefreshWords = now - this.scanLastRefreshTime > 420;

      if (shouldRefreshWords) {
        this.scanLastRefreshTime = now;
      }

      const selectedAnchors = this.pickThoughtScannerAnchors(pointer, count);

      this.scanProbes.forEach((probe, index) => {
        const anchor = selectedAnchors[index];
        if (!anchor) {
          this.setThoughtProbeOpacity(probe, 0);
          return;
        }

        const size = this.getThoughtAnchorSize(anchor);
        const scale = 1;
        const anchorId = `${Math.round(anchor.x)}:${Math.round(anchor.y)}`;
        const anchorChanged = probe.anchorId !== anchorId;

        if (anchorChanged || !probe.label.textContent) {
          probe.label.textContent = this.pickThoughtScannerWord(index, now);
          probe.lastWordAt = now;
        }

        probe.readout.textContent = `LOCK ${Math.round(anchor.pointerDistance).toString().padStart(3, "0")} / D${Math.round(anchor.distance).toString().padStart(3, "0")}`;
        probe.renderX = Math.round(anchor.x);
        probe.renderY = Math.round(anchor.y);
        probe.element.style.setProperty("--scan-x", `${probe.renderX}px`);
        probe.element.style.setProperty("--scan-y", `${probe.renderY}px`);
        probe.element.style.setProperty("--scan-size", `${size}px`);
        probe.element.style.setProperty("--scan-scale", scale.toFixed(3));
        this.setThoughtProbeOpacity(probe, 1);
        if (anchorChanged) {
          probe.anchorId = anchorId;
          this.flashThoughtProbe(probe);
        }

        probe.line.setAttribute("x1", Math.round(pointer.x));
        probe.line.setAttribute("y1", Math.round(pointer.y));
        probe.line.setAttribute("x2", probe.renderX);
        probe.line.setAttribute("y2", probe.renderY);
      });
    }

    ensureThoughtScannerAnchors(rect) {
      const signature = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      if (signature === this.scanAnchorSignature && this.scanAnchorPoints.length) return;

      this.scanAnchorSignature = signature;
      this.scanAnchorPoints = [];
      this.scanActiveAnchors = [];

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const base = Math.min(rect.width, rect.height);
      const deadRadius = base * this.scanAnchorDeadRadiusRatio;
      const margin = 32;
      const clusterCount = 14;
      const clusters = [];

      for (let i = 0; i < clusterCount; i++) {
        const angle = i * 2.399963 + Utils.hash(i * 19.17) * 1.2;
        const radialBias = Math.pow(Utils.hash(i * 31.91 + 2.7), 0.55);
        const radius = THREE.MathUtils.lerp(deadRadius * 1.08, Math.hypot(rect.width, rect.height) * 0.46, radialBias);
        const x = THREE.MathUtils.clamp(centerX + Math.cos(angle) * radius * (0.72 + Utils.hash(i * 7.3) * 0.7), rect.left + margin, rect.right - margin);
        const y = THREE.MathUtils.clamp(centerY + Math.sin(angle) * radius * (0.62 + Utils.hash(i * 9.1) * 0.76), rect.top + margin, rect.bottom - margin);
        const density = 5 + Math.floor(Utils.hash(i * 13.73) * 8);
        const spread = THREE.MathUtils.lerp(base * 0.055, base * 0.15, Utils.hash(i * 23.9));

        if (Math.hypot(x - centerX, y - centerY) <= deadRadius) continue;
        clusters.push({ x, y, density, spread });
      }

      clusters.forEach((cluster, clusterIndex) => {
        for (let i = 0; i < cluster.density * 3 && this.getClusterAnchorCount(clusterIndex) < cluster.density; i++) {
          const angle = Utils.hash(clusterIndex * 101 + i * 17.31) * Math.PI * 2;
          const radius = Math.pow(Utils.hash(clusterIndex * 131 + i * 29.7), 1.25) * cluster.spread;
          const x = THREE.MathUtils.clamp(cluster.x + Math.cos(angle) * radius, rect.left + margin, rect.right - margin);
          const y = THREE.MathUtils.clamp(cluster.y + Math.sin(angle) * radius, rect.top + margin, rect.bottom - margin);

          if (Math.hypot(x - centerX, y - centerY) <= deadRadius) continue;
          this.addThoughtScannerAnchor(x, y, clusterIndex);
        }
      });

      const sparseTotal = 72;
      for (let i = 0; i < sparseTotal * 2 && this.getClusterAnchorCount(-1) < sparseTotal; i++) {
        const x = THREE.MathUtils.lerp(rect.left + margin, rect.right - margin, Utils.hash(i * 43.11 + 1.7));
        const y = THREE.MathUtils.lerp(rect.top + margin, rect.bottom - margin, Utils.hash(i * 61.87 + 5.3));

        if (Math.hypot(x - centerX, y - centerY) <= deadRadius) continue;
        this.addThoughtScannerAnchor(x, y, -1);
      }

      this.renderThoughtScannerAnchors();
    }

    addThoughtScannerAnchor(x, y, cluster) {
      const tooClose = this.scanAnchorPoints.some((anchor) => (
        Math.hypot(anchor.x - x, anchor.y - y) < this.scanAnchorMinDistance
      ));

      if (tooClose) return false;
      const distanceSeed = Utils.hash(x * 0.073 + y * 0.119 + (cluster + 17) * 5.31);
      const centered = (distanceSeed - 0.5) * 2;
      const distance = Math.round(THREE.MathUtils.clamp(
        120 + centered * centered * Math.sign(centered || 1) * 52,
        60,
        150
      ));
      this.scanAnchorPoints.push({ x, y, distance, cluster });

      return true;
    }

    getClusterAnchorCount(cluster) {
      return this.scanAnchorPoints.filter((anchor) => anchor.cluster === cluster).length;
    }

    renderThoughtScannerAnchors() {
      if (!this.scanAnchorContainer) return;

      this.scanAnchorContainer.replaceChildren();
      this.scanAnchorDots = this.scanAnchorPoints.map((anchor) => {
        const dot = document.createElement("span");

        dot.className = "archive-thought-anchor-dot";
        dot.style.setProperty("--anchor-x", `${anchor.x}px`);
        dot.style.setProperty("--anchor-y", `${anchor.y}px`);
        dot.style.setProperty("--anchor-size", "2px");
        dot.style.setProperty("--anchor-opacity", "0.55");
        this.scanAnchorContainer.appendChild(dot);

        return dot;
      });
    }

    pickThoughtScannerAnchors(pointer, count) {
      const candidates = this.scanAnchorPoints
        .map((anchor) => {
          const pointerDistance = Math.hypot(anchor.x - pointer.x, anchor.y - pointer.y);

          return {
            ...anchor,
            pointerDistance,
          };
        })
        .filter((anchor) => anchor.pointerDistance <= this.scanAttractRadius)
        .sort((a, b) => a.pointerDistance - b.pointerDistance);

      const selected = [];
      for (const candidate of candidates) {
        const probeSize = this.getThoughtAnchorSize(candidate);
        const overlaps = selected.some((anchor) => {
          const anchorSize = this.getThoughtAnchorSize(anchor);

          return this.getThoughtProbeOverlapRatio(candidate, probeSize, anchor, anchorSize) > this.scanMaxOverlapRatio;
        });

        if (overlaps) continue;
        selected.push(candidate);
        if (selected.length >= count) break;
      }

      this.scanActiveAnchors = selected;

      return selected;
    }

    getThoughtAnchorSize(anchor) {
      const raw = THREE.MathUtils.clamp(anchor.distance || 120, 60, 150);

      return Math.round(raw / 2) * 2;
    }

    countNearbyThoughtScannerAnchors(pointer) {
      return this.scanAnchorPoints.reduce((total, anchor) => {
        const distance = Math.hypot(anchor.x - pointer.x, anchor.y - pointer.y);

        return total + (distance <= this.scanAttractRadius ? 1 : 0);
      }, 0);
    }

    getThoughtProbeOverlapRatio(a, aSize, b, bSize) {
      const aHalf = aSize / 2;
      const bHalf = bSize / 2;
      const overlapWidth = Math.max(0, Math.min(a.x + aHalf, b.x + bHalf) - Math.max(a.x - aHalf, b.x - bHalf));
      const overlapHeight = Math.max(0, Math.min(a.y + aHalf, b.y + bHalf) - Math.max(a.y - aHalf, b.y - bHalf));
      const overlapArea = overlapWidth * overlapHeight;
      const smallerArea = Math.min(aSize * aSize, bSize * bSize);

      return smallerArea > 0 ? overlapArea / smallerArea : 0;
    }

    updateThoughtScannerFade(now) {
      return now;
    }

    hideThoughtScanner(resetPointer = false) {
      this.scanProbes.forEach((probe) => this.setThoughtProbeOpacity(probe, 0));
      if (resetPointer) {
        this.scanLastPointer = null;
        this.scanLastMoveTime = -Infinity;
        this.scanActiveAnchors = [];
        this.scanProbes.forEach((probe) => {
          probe.anchorId = null;
          probe.renderX = null;
          probe.renderY = null;
        });
      }
    }

    setThoughtProbeOpacity(probe, opacity) {
      probe.element.style.setProperty("--scan-opacity", opacity);
      probe.line.style.setProperty("--scan-opacity", opacity);
    }

    flashThoughtProbe(probe) {
      probe.element.classList.remove("is-capturing");
      probe.line.classList.remove("is-capturing");
      void probe.element.offsetWidth;
      probe.element.classList.add("is-capturing");
      probe.line.classList.add("is-capturing");
    }

    pickThoughtScannerWord(index, now) {
      const wordIndex = Math.floor(Utils.hash(index * 31.17 + now * 0.0027) * this.scanWordBank.length);

      return this.scanWordBank[wordIndex];
    }

    projectWorldToScreen(point, rect) {
      const projected = point.clone().project(this.camera);

      return {
        x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      };
    }

    isScreenPointVisible(point) {
      const margin = 160;

      return point.x > -margin &&
        point.x < window.innerWidth + margin &&
        point.y > -margin &&
        point.y < window.innerHeight + margin;
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

    createHoverDust() {
      const count = 6400;
      const positions = new Float32Array(count * 3);
      const offsets = new Float32Array(count);
      const alpha = new Float32Array(count);
      const rayStrength = new Float32Array(count);
      const base = this.getHoverDustBaseSize();
      const hoverCenter = this.getHoverDustCenter();
      const innerRadius = base * 0.32;
      const outerRadius = base * 0.82;
      const fadeStartRadius = base * 0.59 * 1.2;
      const rayCount = 108;

      for (let i = 0; i < count; i++) {
        const radiusT = Math.pow(Utils.hash(i * 17.91 + 4.13), 1.35);
        const rayIndex = Math.floor(Utils.hash(i * 29.37 + 9.61) * rayCount);
        const rayBaseAngle = (rayIndex / rayCount) * Math.PI * 2;
        const angle = rayBaseAngle;
        const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, radiusT);
        const maxBlur = base * 0.01 * (0.3 + radiusT);
        const blur = (Utils.hash(i * 53.79 + 8.43) - 0.5) * maxBlur;
        const index = i * 3;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const outerFade = smoothstep(fadeStartRadius, outerRadius, radius);
        const keepChance = THREE.MathUtils.lerp(1, 0.34, outerFade);
        const visible = Utils.hash(i * 67.33 + 12.07) <= keepChance ? 1 : 0;
        const edgeAlpha = THREE.MathUtils.lerp(1, 0.3, outerFade) * visible;

        positions[index] = cos * radius + Math.cos(angle + Math.PI / 2) * blur;
        positions[index + 1] = sin * radius + Math.sin(angle + Math.PI / 2) * blur;
        positions[index + 2] = -0.08;
        offsets[i] = Utils.hash(i * 37.19 + 2.71);
        alpha[i] = 0.8 * edgeAlpha;
        rayStrength[i] = 1 - Math.abs(blur) / (maxBlur * 0.5);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("offset", new THREE.BufferAttribute(offsets, 1));
      geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
      geo.setAttribute("rayStrength", new THREE.BufferAttribute(rayStrength, 1));

      this.hoverDustMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uBurst: { value: 0 },
          uPress: { value: 0 },
          uColor: { value: new THREE.Color(this.foreground) },
          uDustCenter: { value: new THREE.Vector2(0, 0) },
          uResolution: { value: window.innerHeight * Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uHover;
          uniform float uBurst;
          uniform float uPress;
          uniform float uResolution;
          uniform vec2 uDustCenter;
          attribute float offset;
          attribute float alpha;
          attribute float rayStrength;
          varying float vAlpha;

          void main() {
            float dustReveal = smoothstep(0.0, 1.0, uHover);
            float fade = dustReveal * (1.0 - uBurst);
            vec3 currentPos = position;
            vec2 fromCenter = currentPos.xy - uDustCenter;
            vec2 dustDir = normalize(fromCenter + vec2(0.0001));
            vec2 dustTangent = vec2(-dustDir.y, dustDir.x);
            float dustScale = 1.0 + uPress * 0.08;
            float hoverMotion = smoothstep(0.72, 1.0, dustReveal) * (1.0 - uBurst);
            float drift = sin(uTime * 2.4 + offset * 18.8496) * 0.012;
            float shimmer = cos(uTime * 3.1 + offset * 11.73) * 0.006;
            float pressMotion = smoothstep(0.0, 1.0, uPress) * (1.0 - uBurst);
            float rayLength = (0.05 + offset * 0.09) * pressMotion;
            float rayNoise = sin(uTime * 1.35 + offset * 37.6991) * 0.012 * pressMotion;

            currentPos.xy = uDustCenter + fromCenter * dustReveal * dustScale;
            currentPos.xy += (dustTangent * drift + dustDir * shimmer) * hoverMotion;
            currentPos.xy += dustDir * (rayLength + rayNoise) + dustTangent * rayNoise * 0.45;

            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
            gl_PointSize = (uResolution / 185.0) * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            float pressGlow = 1.0 + uPress * 0.55;
            vAlpha = alpha * pressGlow * mix(0.42, 1.0, clamp(rayStrength, 0.0, 1.0)) * fade;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;

          void main() {
            if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
            gl_FragColor = vec4(uColor, vAlpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });

      this.hoverDust = new THREE.Points(geo, this.hoverDustMat);
      this.hoverDust.renderOrder = 1;
      this.hoverDustGroup = new THREE.Group();
      this.hoverDustGroup.position.set(hoverCenter.x, hoverCenter.y, 0);
      this.hoverDustGroup.add(this.hoverDust);
      this.scene.add(this.hoverDustGroup);
      this.createHoverDustRayGuides(innerRadius, outerRadius, rayCount);
      this.createHoverCenterDot();
    }

    createHoverCenterDot() {
      this.hoverCenterDotEl = document.createElement("div");
      this.hoverCenterDotEl.className = "archive-hover-center-dot";
      document.body.appendChild(this.hoverCenterDotEl);
    }

    createHoverDustRayGuides(innerRadius, outerRadius, rayCount) {
      const positions = new Float32Array(rayCount * 2 * 3);
      const guideCenterX = this.getHoverDustBaseSize() * 0.025;
      const guideCenterY = this.getHoverDustBaseSize() * 0.015;

      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const start = i * 6;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const guideInnerRadius = innerRadius * 0.8;

        positions[start] = guideCenterX + cos * guideInnerRadius;
        positions[start + 1] = guideCenterY + sin * guideInnerRadius;
        positions[start + 2] = -0.06;
        positions[start + 3] = guideCenterX + cos * outerRadius;
        positions[start + 4] = guideCenterY + sin * outerRadius;
        positions[start + 5] = -0.06;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      this.hoverDustRayMat = new THREE.ShaderMaterial({
        uniforms: {
          uHover: { value: 0 },
          uBurst: { value: 0 },
          uColor: { value: new THREE.Color(0xffff00) },
        },
        vertexShader: `
          void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uHover;
          uniform float uBurst;

          void main() {
            gl_FragColor = vec4(uColor, uHover * (1.0 - uBurst) * 0.55);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });

      this.hoverDustRays = new THREE.LineSegments(geo, this.hoverDustRayMat);
      this.hoverDustRays.renderOrder = 3;
      this.hoverDustRays.visible = false;
      this.hoverDustGroup.add(this.hoverDustRays);
    }

    getHoverDustBaseSize() {
      const vFov = THREE.MathUtils.degToRad(this.camera.fov);
      const visibleHeight = 2 * Math.tan(vFov / 2) * this.camera.position.z;
      const visibleWidth = visibleHeight * this.camera.aspect;

      return Math.min(visibleWidth, visibleHeight);
    }

    getHoverDustCenter() {
      const base = this.getHoverDustBaseSize();

      return {
        x: base * this.pressOffsetXRatio,
        y: -base * this.pressOffsetYRatio,
      };
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

    async loadHoverTargetPoints(total, coreParticlesPerEdge, particlesPerEdge) {
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

          if (weight <= 0.06) return;

          activeWeight += Math.pow(weight, 1.7);
          weightedPixels.push(sample);
          cumulative.push(activeWeight);
        });

        if (!weightedPixels.length || activeWeight <= 0) {
          return [];
        }

        const targetSize = 0.92 * 3.6;
        const aspect = width / height;
        const targetWidth = aspect >= 1 ? targetSize : targetSize * aspect;
        const targetHeight = aspect >= 1 ? targetSize / aspect : targetSize;
        const points = [];

        for (let i = 0; i < total; i++) {
          const isScatterLayer = (i % particlesPerEdge) >= coreParticlesPerEdge;
          const seedOffset = isScatterLayer ? 97.31 : 0;
          const pick = Utils.hash(i * 19.73 + 3.17 + seedOffset) * activeWeight;
          const pixelIndex = this.findWeightedPixel(cumulative, pick);
          const pixel = weightedPixels[pixelIndex];
          const jitterScale = isScatterLayer ? 1.5 : 0;
          const jitterX = (Utils.hash(i * 31.11 + 7.91 + seedOffset) - 0.5) * jitterScale;
          const jitterY = (Utils.hash(i * 43.87 + 11.29 + seedOffset) - 0.5) * jitterScale;
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

    isVisibleSample(index, sourceCount, visibleCount) {
      if (visibleCount >= sourceCount) return true;

      const currentBucket = Math.floor((index * visibleCount) / sourceCount);
      const previousBucket = Math.floor(((index - 1) * visibleCount) / sourceCount);

      return index === 0 || currentBucket !== previousBucket;
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
