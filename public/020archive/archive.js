(function () {
  const HUD_PRESS_PHASES = [
    {
      threshold: 0,
      signal: "CORE LOCK",
      title: "THE EYE",
      summary: "It does not look at you. It remembers the version of you that has not happened yet.",
      instruction: "CORE LOCK",
    },
    {
      threshold: 0.28,
      signal: "MEMORY LEAK",
      title: "IT HEARS YOU",
      summary: "Something behind the iris is repeating thoughts you have never spoken.",
      instruction: "MEMORY LEAK",
    },
    {
      threshold: 0.58,
      signal: "IDENTITY LOSS",
      title: "IT KNOWS YOU",
      summary: "Your name has appeared in records written before your birth.",
      instruction: "IDENTITY BREACH",
    },
    {
      threshold: 0.82,
      signal: "BREACH IMMINENT",
      title: "DO NOT RELEASE",
      summary: "The archive is opening from the other side.",
      instruction: "CONTAINMENT FAILURE",
    },
  ];

  window.addEventListener("DOMContentLoaded", () => {
    const stage = document.getElementById("hypercube-stage");
    const cardStream = new window.ArchiveCardStream();
    new Hypercube(stage, cardStream).init();
  });

  class Hypercube {
    constructor(container = document.body, cardStream = null) {
      this.container = container;
      this.cardStream = cardStream;
      this.themePalette = {
        background: 0x050203,
        particle: 0xffffff, // pure-white hypercube (dormant)
        hoverParticle: 0xffffff, // cube is hidden on hover; kept white regardless
        pressParticle: 0xc21f2d, // eye/rays turn a slightly darker/deeper red on press
        burstParticle: 0xff2338, // red starfield after burst
        dust: 0xffffff, // white eye so the difference blend renders a clean inverse
        ray: 0xffffff, // white rays for the same inverse effect
        trail: 0xff2338,
      };
      const initialPalette = this.themePalette;
      this.background = initialPalette.background;
      this.foreground = initialPalette.particle;
      this.baseRayColor = new THREE.Color(initialPalette.ray);
      this.themeRenderColor = new THREE.Color(initialPalette.particle);
      this.themeTargetColor = new THREE.Color(initialPalette.particle);
      this.themeDustRenderColor = new THREE.Color(initialPalette.dust);
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
      this.pressOffsetXRatio = 0;
      this.pressOffsetYRatio = 0;
      // Shift the eye shape, dust glow and rays up-right by this world ratio,
      // while the center dot and long-press circle stay at the cube center.
      this.eyeShiftXRatio = 0.015;
      this.eyeShiftYRatio = 0.015;
      // Single source of truth for the WHOLE hypercube assembly: cube points,
      // eye pattern, square scan, dust/rays and every detection zone + guide are
      // all derived from this offset, so changing it moves everything together.
      // World +y is up. Units are a ratio of the visible field.
      this.hypercubeOffsetXRatio = 0;
      this.hypercubeOffsetYRatio = 0;
      this.baseRotationX = Math.sin(45 * Math.PI / 180);
      this.cubeCloud = null;
      this.cubeWorldCenter = new THREE.Vector3();
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
      this.hoverLookMaxTilt = 0.62;
      this.hoverTiltEuler = new THREE.Euler();
      this.hoverTiltMatrix4 = new THREE.Matrix4();
      this.hoverTiltMatrix3 = new THREE.Matrix3();
      this.activeInteractionRect = null;
      this.cachedCursorMetrics = null;
      this.hoverDotStyleCache = {
        size: "",
        x: "",
        y: "",
        opacity: "",
      };
      this.lastCursorPressActive = null;
      this.lastCursorPressProgress = null;
      this.lastCursorSnapActive = null;
      this.lastCursorSnapX = null;
      this.lastCursorSnapY = null;
      this.lastOpaqueStage = null;
      this.pointerMoveFrame = null;
      this.pendingPointerMove = null;
      this.hudPressStyleCache = {
        progress: "",
        tension: "",
      };
      this.trails = null;
      this.trailMat = null;
      this.burstPositionAttribute = null;
      this.trailBurstPositionAttribute = null;
      this.burstSourceIndices = [];
      this.trailSourceIndices = [];
      this.hoverTargetPoints = [];
      this.ambientHud = document.getElementById("archiveAmbientHud");
      this.hudSignal = document.getElementById("archiveHudSignal");
      this.hudCoord = document.getElementById("archiveHudCoord");
      this.hudScan = document.getElementById("archiveHudScan");
      this.hudRecord = document.getElementById("archiveHudRecord");
      this.hudSummary = document.getElementById("archiveHudSummary");
      this.hudInstruction = document.getElementById("archiveHudInstruction");
      this.hudUid = document.getElementById("archiveHudUid");
      this.hudClock = document.getElementById("archiveHudClock");
      this.hudFrame = document.getElementById("archiveHudFrame");
      this.hudDepth = document.getElementById("archiveHudDepth");
      this.hudIntegrity = document.getElementById("archiveHudIntegrity");
      this.hudStratum = document.getElementById("archiveHudStratum");
      this.hudFrameCount = 0;
      this.hudMicroLast = 0;
      this.hudGlitchTimer = null;
      this.initialBlinkTimer = null;
      this.initialTextGlitchTimer = null;
      this.hudTelemetryLast = 0;
      this.hudTelemetryTargetAt = 0;
      this.hudTelemetry = {
        depth: 7.43,
        depthTarget: 7.43,
        integrity: 98.4,
        integrityTarget: 98.4,
        stratum: 2,
        stratumTarget: 2,
      };
      this.hudStaticCopy = {
        archive: null,
        eyebrow: null,
        classes: [],
        matrix: null,
        matrixState: null,
      };
      this.hudState = "DORMANT";
      this.hudEyeRecordActive = false;
      this.hudEyeRecordClearTimer = 0;
      this.hudPressPhaseIndex = -1;
      this.verticalSyncTriggered = false;
      this.verticalSyncActive = false;
      this.verticalSyncStart = 0;
      this.verticalSyncDuration = 480;
      this.scene = new THREE.Scene();
      // Transparent while dormant so the DOM nested-frame background (z-index
      // below the canvas) shows through the empty areas around the particles.
      // Once the cube bursts into the card stream we restore an opaque dark
      // backdrop (see animate) so the settled starfield keeps its soft look.
      this.scene.background = null;
      this.sceneBackgroundColor = new THREE.Color(this.background);
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
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(this.background, 0);
      this.createVerticalSyncPass();

      this.visualLayer = document.createElement("div");
      this.visualLayer.className = "archive-hypercube-visual-layer";
      this.visualLayer.setAttribute("aria-hidden", "true");
      this.container.insertBefore(this.visualLayer, this.container.firstChild);
      this.renderer.domElement.classList.add("archive-hypercube-source");
      this.visualLayer.appendChild(this.renderer.domElement);
      this.refreshInteractionRect();
      window.ArchiveCardVFX?.attachLiquidSource?.(this.renderer.domElement);
      this.pressTargetGuide = document.createElement("div");
      this.pressTargetGuide.className = "hypercube-press-target-guide";
      this.visualLayer.appendChild(this.pressTargetGuide);
      this.hoverExitGuide = document.createElement("div");
      this.hoverExitGuide.className = "hypercube-hover-exit-guide";
      this.hoverExitGuide.setAttribute("aria-hidden", "true");
      this.visualLayer.appendChild(this.hoverExitGuide);
      this.rayInnerRingEl = document.createElement("div");
      this.rayInnerRingEl.className = "hypercube-ray-inner-ring";
      this.visualLayer.appendChild(this.rayInnerRingEl);
      this.eyeFxEl = document.createElement("div");
      this.eyeFxEl.className = "hypercube-eye-fx";
      this.eyeFxEl.setAttribute("aria-hidden", "true");
      this.eyeFxEl.innerHTML =
        '<span class="hypercube-eye-fx__scan"></span>' +
        '<span class="hypercube-eye-fx__ring"></span>';
      this.visualLayer.appendChild(this.eyeFxEl);

      this.animate = this.animate.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
    }

    createVerticalSyncPass() {
      this.verticalSyncResolution = new THREE.Vector2();
      this.verticalSyncTarget = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      });
      this.verticalSyncTarget.texture.generateMipmaps = false;

      this.verticalSyncScene = new THREE.Scene();
      this.verticalSyncCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.verticalSyncMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uScene: { value: this.verticalSyncTarget.texture },
          uOffset: { value: 0 },
          uEnvelope: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uScene;
          uniform float uOffset;
          uniform float uEnvelope;
          varying vec2 vUv;

          void main() {
            vec2 rolledUv = vec2(vUv.x, fract(vUv.y - uOffset));
            vec4 signal = texture2D(uScene, rolledUv);

            float signalLevel = max(signal.r, max(signal.g, signal.b));
            vec3 redSignal = vec3(0.82, 0.055, 0.105) * signalLevel * 1.16;
            vec3 color = mix(signal.rgb, redSignal, uEnvelope);

            float bandY = fract(uOffset);
            float bandDistance = abs(vUv.y - bandY);
            bandDistance = min(bandDistance, 1.0 - bandDistance);
            float syncBand = 1.0 - smoothstep(0.0, 0.0065, bandDistance);
            color += vec3(0.72, 0.07, 0.11) * syncBand * uEnvelope * 0.62;

            // During the roll, transparent pixels become pure black. At both
            // ends the envelope returns to zero, so the direct-render handoff
            // remains visually seamless.
            float alpha = mix(signal.a, 1.0, uEnvelope);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });

      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        this.verticalSyncMaterial
      );
      quad.frustumCulled = false;
      this.verticalSyncScene.add(quad);
      this.resizeVerticalSyncTarget();
      this.renderer.compile(this.verticalSyncScene, this.verticalSyncCamera);
      this.renderer.setRenderTarget(this.verticalSyncTarget);
      this.renderer.clear(true, true, true);
      this.renderer.setRenderTarget(null);
    }

    resizeVerticalSyncTarget() {
      if (!this.verticalSyncTarget || !this.renderer) return;
      this.renderer.getDrawingBufferSize(this.verticalSyncResolution);
      this.verticalSyncTarget.setSize(
        Math.max(1, Math.round(this.verticalSyncResolution.x)),
        Math.max(1, Math.round(this.verticalSyncResolution.y))
      );
    }

    updateVerticalSyncRoll(time) {
      const isHolding = this.pressPointerId !== null && this.burstTarget === 0;

      if (!isHolding) {
        this.verticalSyncTriggered = false;
      } else if (
        this.pressAmount >= 0.32 &&
        !this.verticalSyncTriggered &&
        !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        this.verticalSyncTriggered = true;
        this.verticalSyncActive = true;
        this.verticalSyncStart = time;
        this.container.classList.add("is-vertical-sync-roll");
      }

      if (this.burstTarget > 0) {
        this.verticalSyncActive = false;
        this.container.classList.remove("is-vertical-sync-roll");
        return;
      }
      if (!this.verticalSyncActive || !this.verticalSyncMaterial) return;

      const progress = Math.min(
        1,
        Math.max(0, (time - this.verticalSyncStart) / this.verticalSyncDuration)
      );
      const fadeIn = smoothstep(0, 0.065, progress);
      const fadeOut = 1 - smoothstep(0.88, 1, progress);
      const envelope = Math.min(fadeIn, fadeOut);

      this.verticalSyncMaterial.uniforms.uOffset.value = progress;
      this.verticalSyncMaterial.uniforms.uEnvelope.value = envelope;

      if (progress >= 1) {
        this.verticalSyncActive = false;
        this.container.classList.remove("is-vertical-sync-roll");
      }
    }

    renderVerticalSyncFrame() {
      this.renderer.setRenderTarget(this.verticalSyncTarget);
      this.renderer.autoClear = true;
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);

      this.renderer.setRenderTarget(null);
      this.renderer.autoClear = true;
      this.renderer.render(this.verticalSyncScene, this.verticalSyncCamera);
    }

    applyArchiveThemeColors() {
      const palette = this.themePalette;

      this.background = palette.background;
      this.foreground = palette.particle;
      this.baseRayColor.setHex(palette.ray);
      this.scene?.background?.setHex(palette.background);
      this.renderer?.setClearColor(palette.background, 0);
      this.fadeMaterial?.color?.setHex(palette.background);
      this.mat?.uniforms.uColor.value.setHex(palette.particle);
      this.hoverDustMat?.uniforms.uColor.value.setHex(palette.dust);
      this.hoverDustRayMat?.uniforms.uColor.value.setHex(palette.ray);
      this.trailMat?.uniforms.uColor.value.setHex(palette.trail);
    }

    updateArchiveThemeRenderColors() {
      const palette = this.themePalette;

      this.themeRenderColor
        .setHex(palette.particle)
        .lerp(this.themeTargetColor.setHex(palette.hoverParticle), this.hoverAmount)
        .lerp(this.themeTargetColor.setHex(palette.pressParticle), this.pressAmount)
        .lerp(this.themeTargetColor.setHex(palette.burstParticle), this.burstAmount);
      // Eye + rays are pure white on plain hover (normal compositing) and share one
      // white->red ramp so the whole assembly reddens together as the long-press
      // deepens. The canvas' difference blend is enabled ONLY during the press, so
      // the reddening reads as a live inverse of the background frames.
      this.themeDustRenderColor
        .setHex(palette.dust)
        .lerp(this.themeTargetColor.setHex(palette.pressParticle), this.pressAmount);

      this.mat?.uniforms.uColor.value.copy(this.themeRenderColor);
      this.hoverDustMat?.uniforms.uColor.value.copy(this.themeDustRenderColor);
      this.hoverDustRayMat?.uniforms.uColor.value.copy(this.themeDustRenderColor);
    }

    async init() {
      const cubeParticlesPerEdge = 400;
      const burstParticlesPerEdge = 200;
      const initialHoverCoreParticlesPerEdge = 1800;
      const hoverCoreParticlesPerEdge = 7200;
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
          uEyeShift: { value: new THREE.Vector2(0, 0) },
          uSignalLoss: { value: 0 },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uHover;
          uniform float uBurst;
          uniform float uPress;
          uniform float uResolution;
          uniform mat3 uHoverTilt;
          uniform vec2 uEyeShift;
          uniform float uSignalLoss;
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
            vec3 tiltedSquare = uHoverTilt * squarePos * (1.5 + uPress * 0.12);
            // Pupil constriction: an accelerating (press^2) implosion that pulls
            // the inner eye pattern toward the core, with a fast tremor near the
            // end so the iris feels like it is clamping shut on the viewer.
            float pressSq = uPress * uPress;
            float eyeR = length(tiltedSquare.xy);
            float constrict = 1.0 - pressSq * 0.34 * (1.0 - smoothstep(0.0, 2.2, eyeR));
            tiltedSquare.xy *= constrict;
            float tremor = sin(uTime * 42.0 + offset * 30.0) * 0.02 * pressSq;
            tiltedSquare.xy += normalize(tiltedSquare.xy + vec2(0.0001)) * tremor;
            // Apply the eye shift in the camera-facing frame (before the inverse
            // model rotation) so it stays a constant screen-space offset and
            // does not swing as the cube spins.
            tiltedSquare.xy += uEyeShift;
            vec3 hoverTarget = vec3(
              dot(worldRotation[0], tiltedSquare),
              dot(worldRotation[1], tiltedSquare),
              dot(worldRotation[2], tiltedSquare)
            );
            // Delay the collapse so the cube spends the first ~20% of the hover as a
            // full, spinning cube (the whip-spin is clearly visible) before it folds
            // into the eye. On exit this keeps the cube fully expanded + spinning for
            // the last stretch too, so both directions read the rotation strongly.
            float morphProgress = smoothstep(0.3, 1.0, uHover);
            float hoverEase = cubicBezierEase(morphProgress);
            float hoverMotion = smoothstep(0.72, 1.0, hoverEase) * (1.0 - uBurst);
            vec2 hoverDir = normalize(squarePos.xy + vec2(0.0001));
            vec2 hoverTangent = vec2(-hoverDir.y, hoverDir.x);
            float drift = sin(uTime * 2.4 + offset * 18.8496) * 0.012;
            float shimmer = cos(uTime * 3.1 + offset * 11.73) * 0.006;
            vec3 hoverWiggle = vec3(hoverTangent * drift + hoverDir * shimmer, 0.0) * hoverMotion;
            // Curved in-flight path: instead of sliding straight from the cube to
            // the eye, each particle swirls in along an arc (a coherent whirlpool)
            // that peaks mid-transition and vanishes at both ends, so the start /
            // end positions are unchanged but the collapse reads as a fluid vortex.
            vec3 straightPos = mix(cubePos, hoverTarget + hoverWiggle, hoverEase);
            float arc = sin(hoverEase * 3.14159265) * (1.0 - uBurst);
            vec3 flightVec = hoverTarget - cubePos;
            // Coherent inward whirlpool: every particle is nudged the same rotational
            // way (perpendicular to its own flight line) so the collapse reads as one
            // clean vortex being drawn into the eye — no random depth scatter, so the
            // "force" has a single, legible direction.
            vec3 swirlTangent = normalize(vec3(-flightVec.y, flightVec.x, 0.0) + vec3(0.0, 0.0, 0.0001));
            float swirlAmt = arc * (0.35 + 0.4 * fract(offset * 3.17));
            vec3 collapsedPos = straightPos + swirlTangent * swirlAmt;

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

            // Signal-loss glitch: horizontal slice tearing + point dropout, only
            // meaningful before the burst so the cube reads like a failing feed.
            if (uSignalLoss > 0.001) {
              float slice = floor((currentPos.y + 6.0) * 5.0);
              float sliceRnd = fract(sin(slice * 12.9898 + floor(uTime * 24.0)) * 43758.5453);
              float tear = (sliceRnd - 0.5) * uSignalLoss * 1.6 * step(0.55, sliceRnd);
              currentPos.x += tear * (1.0 - burstEase);
              float dropRnd = fract(sin(offset * 91.17 + floor(uTime * 30.0)) * 24634.6345);
              vAlpha *= 1.0 - uSignalLoss * step(0.82, dropRnd) * (1.0 - burstEase);
            }

            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
            float dustScale = mix(1.0, 0.72, burstEase);
            gl_PointSize = (uResolution / 190.5) * dustScale * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;

          void main() {
            if (vAlpha <= 0.001) discard;
            // Rounded-square sprite: small corner radius, filled body.
            vec2 p = abs(gl_PointCoord - vec2(0.5));
            float r = 0.12;
            vec2 q = p - (0.5 - r);
            if (length(max(q, 0.0)) - r > 0.0) discard;
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
      this.updateEyeShift();
      this.createHoverDust();
      this.scene.add(this.cubeCloud);
      this.applyHypercubeOffset();

      this.createTrails(burstPos, offsets, burstMask);
      this.applyArchiveThemeColors();

      window.addEventListener("resize", this.onResize);
      this.container.addEventListener("pointermove", this.onPointerMove);
      this.container.addEventListener("pointerleave", this.onPointerLeave);
      this.container.addEventListener("pointerdown", this.onPointerDown);
      this.container.addEventListener("pointerup", this.onPointerUp);
      this.container.addEventListener("pointercancel", this.onPointerUp);
      window.addEventListener("archive:observation-drag-start", () => this.clearHoverForDrag());
      this.updatePressTargetGuide();
      this.updateAmbientHudState("DORMANT");
      this.animate(0);
      this.scheduleInitialGlitches();
    }

    animate(time) {
      if (this.cubeCloud) {
        // Incremental spin so the rotation SPEED can be modulated smoothly (an
        // absolute time*speed formula would jump when the multiplier changes).
        const nowSec = time / 1000;
        const dt =
          this.lastRotTime === undefined ? 0 : Math.min(nowSec - this.lastRotTime, 0.05);
        this.lastRotTime = nowSec;

        const msToSeconds = this.duration / 1000;
        const baseSpeed = (Math.PI * 2) / msToSeconds; // rad/s

        if (this.burstTarget > 0) {
          // Burst: ease the whole cube back to identity orientation. The red-dot
          // starfield lives on this rotating cubeCloud, but the trails are a
          // separate world-space object that is never rotated — so any leftover
          // cube spin would make the dots and their trails point different ways.
          // Easing (not snapping) keeps the collapse->starfield hand-off smooth.
          this.cubeSpinY = (this.cubeSpinY || 0) * 0.9;
          this.cubeCloud.rotation.x *= 0.9;
          this.cubeCloud.rotation.y = this.cubeSpinY;
        } else {
          // Idle spin decelerates as the cube collapses into the eye so it settles
          // on a near-still cube, then spins back up on exit.
          const hoverSlow = 1 - smoothstep(0.05, 0.9, this.hoverAmount) * 0.9;

          // Dramatic hand-off spin: whip through ~1.5 extra turns whenever the hover
          // state is CHANGING (either direction), so entering AND leaving both give a
          // clearly visible forward whoosh that eases out as it settles. Driven by
          // the per-frame change in hoverAmount so it's always forward (never rewinds).
          const hoverDelta = Math.abs(this.hoverAmount - (this.prevHoverAmount ?? this.hoverAmount));
          this.prevHoverAmount = this.hoverAmount;
          const spinTurns = 1.5;
          const spinBoost = hoverDelta * spinTurns * Math.PI * 2;

          this.cubeSpinY =
            ((this.cubeSpinY || 0) + baseSpeed * dt * hoverSlow + spinBoost) % (Math.PI * 2);

          // Mid-collapse tumble on X: peaks halfway through the transition and returns
          // to the resting tilt at both ends, so the cube visibly rolls as it folds.
          const tumble = Math.sin(smoothstep(0.0, 1.0, this.hoverAmount) * Math.PI) * 0.8;
          this.cubeCloud.rotation.x = this.baseRotationX + tumble;
          this.cubeCloud.rotation.y = this.cubeSpinY;
        }
      }

      // Asymmetric easing: enter more slowly than exit. The exit whoosh already
      // reads well at 0.08; entering at the same rate blurs the spin/fold into ~0.1s
      // so it's hard to see. A slower enter spreads the same 1.5-turn whip over more
      // time, making the wind-up-and-fold clearly legible.
      const hoverRate = this.hoverTarget > this.hoverAmount ? 0.045 : 0.08;
      this.hoverAmount += (this.hoverTarget - this.hoverAmount) * hoverRate;
      this.updateHoverDustState();
      this.hoverDustAmount += (this.hoverDustTarget - this.hoverDustAmount) * 0.12;
      this.updateHoverLookTransform();
      this.burstAmount += (this.burstTarget - this.burstAmount) * 0.025;

      if (this.pressPointerId !== null && this.burstTarget === 0) {
        this.pressAmount = Math.min((performance.now() - this.pressStartTime) / this.longPressDuration, 1);
        this.updateCursorPressState(true);
        this.updateAmbientHudPress(this.pressAmount);
        if (this.pressAmount >= 1) {
          this.activateBurst();
        }
      } else if (this.burstTarget > 0) {
        this.pressAmount = 1;
      } else {
        this.pressAmount += (0 - this.pressAmount) * 0.12;
        this.updateCursorPressState(false);
      }

      this.updateSignalLoss(time);
      this.updateArchiveThemeRenderColors();
      this.updateVerticalSyncRoll(time);

      if (this.mat) {
        this.mat.uniforms.uTime.value = time / 1000;
        this.mat.uniforms.uHover.value = this.hoverAmount;
        this.mat.uniforms.uBurst.value = this.burstAmount;
        this.mat.uniforms.uPress.value = this.pressAmount;
        this.mat.uniforms.uSignalLoss.value = this.signalLoss || 0;
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

      // Transparent only while dormant/hover/press (so the frame background shows
      // through); opaque dark backdrop once bursting into the card stream, which
      // restores the soft look of the settled red starfield.
      const opaqueStage = this.burstAmount > 0.001 || this.burstTarget > 0;
      if (opaqueStage !== this.lastOpaqueStage) {
        this.lastOpaqueStage = opaqueStage;
        if (opaqueStage) {
          this.sceneBackgroundColor.setHex(this.background);
          this.scene.background = this.sceneBackgroundColor;
          this.renderer.setClearColor(this.background, 1);
        } else {
          this.scene.background = null;
          this.renderer.setClearColor(this.background, 0);
        }
      }

      if (this.verticalSyncActive) {
        this.renderVerticalSyncFrame();
      } else if (trailAmount > 0.001) {
        this.renderer.autoClear = false;
        this.fadeMaterial.opacity = THREE.MathUtils.lerp(0.34, 0.08, trailAmount);
        this.renderer.render(this.fadeScene, this.fadeCamera);
        this.renderer.render(this.scene, this.camera);
      } else {
        this.renderer.autoClear = true;
        this.renderer.render(this.scene, this.camera);
      }

      this.updateHudMicroLabels(time);
      this.updateLivingTelemetry(time);
      window.requestAnimationFrame(this.animate);
    }

    updateSignalLoss(time) {
      if (this.signalLoss === undefined) {
        this.signalLoss = 0;
        this.signalLossPeak = 0;
        this.signalLossStart = 0;
        this.signalLossDuration = 0;
        this.nextSignalLossAt = time + 8000 + Math.random() * 7000;
      }

      // Randomly schedule short dropout bursts (with the eyelid blink) on a
      // random 8-15s cadence while the cube is idle/hovered.
      // One eyelid blink per random 8-15s window, whether the cube is idle or
      // mid long-press. A press does not add its own blink; if the scheduled
      // moment lands during a press it simply blinks then and the timer resets
      // (the press "uses up" that window). Otherwise it fires on the normal
      // cadence.
      if (time >= this.nextSignalLossAt && this.burstTarget === 0) {
        this.signalLossStart = time;
        this.signalLossDuration = 90 + Math.random() * 160;
        this.signalLossPeak = 0.5 + Math.random() * 0.5;
        this.nextSignalLossAt = time + 8000 + Math.random() * 7000;
        this.triggerBlink?.();
      }

      const elapsed = time - this.signalLossStart;
      if (elapsed >= 0 && elapsed < this.signalLossDuration) {
        // Fast stutter envelope rather than a smooth fade.
        const phase = elapsed / this.signalLossDuration;
        const flicker = Math.sin(elapsed * 0.9) * 0.5 + 0.5;
        this.signalLoss = this.signalLossPeak * (1 - phase) * (0.4 + 0.6 * flicker);
      } else {
        this.signalLoss = 0;
      }
    }

    updateHudMicroLabels(time) {
      this.hudFrameCount++;
      if (time - this.hudMicroLast < 120) return;
      this.hudMicroLast = time;

      if (this.hudFrame) {
        this.hudFrame.textContent = String(this.hudFrameCount % 1000000).padStart(6, "0");
      }
      if (this.hudClock) {
        const now = new Date();
        this.hudClock.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map((unit) => String(unit).padStart(2, "0"))
          .join(":");
      }
      if (this.hudUid) {
        // Pseudo memory-address readout that drifts while the field is live.
        const seed = (Math.floor(time / 480) * 2654435761) >>> 0;
        this.hudUid.textContent = `0X${seed.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
      }
    }

    updateLivingTelemetry(time) {
      const telemetry = this.hudTelemetry;
      const active = this.hoverTarget > 0 || this.pressPointerId !== null;
      const targetInterval = active ? 280 : 520;
      const renderInterval = active ? 70 : 120;

      if (time >= this.hudTelemetryTargetAt) {
        const randomBetween = (min, max) => min + Math.random() * (max - min);
        telemetry.depthTarget = randomBetween(active ? 7.3 : 7.4, active ? 7.6 : 7.46);
        telemetry.integrityTarget = randomBetween(active ? 98.1 : 98.3, active ? 98.6 : 98.5);
        telemetry.stratumTarget = Math.round(randomBetween(active ? 0 : 1, active ? 9 : 3));
        this.hudTelemetryTargetAt = time + targetInterval;
      }

      if (time - this.hudTelemetryLast < renderInterval) return;
      this.hudTelemetryLast = time;

      const smoothing = active ? 0.34 : 0.2;
      telemetry.depth += (telemetry.depthTarget - telemetry.depth) * smoothing;
      telemetry.integrity += (telemetry.integrityTarget - telemetry.integrity) * smoothing;
      telemetry.stratum += (telemetry.stratumTarget - telemetry.stratum) * smoothing;

      if (this.hudDepth) {
        this.hudDepth.textContent = telemetry.depth.toFixed(2).padStart(5, "0");
      }
      if (this.hudIntegrity) {
        this.hudIntegrity.textContent = telemetry.integrity.toFixed(1).padStart(4, "0");
      }
      if (this.hudStratum) {
        const suffix = String(Math.round(telemetry.stratum)).padStart(2, "0");
        this.hudStratum.textContent = `7.${suffix}`;
      }
    }

    onResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.activeInteractionRect = null;
      this.cachedCursorMetrics = null;
      this.refreshInteractionRect();
      this.resizeVerticalSyncTarget();
      this.updateEyeShift();
      this.applyHypercubeOffset();

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
      this.pendingPointerMove = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
        target: event.target,
      };
      if (this.pointerMoveFrame !== null) return;

      this.pointerMoveFrame = window.requestAnimationFrame(() => {
        this.pointerMoveFrame = null;
        const pending = this.pendingPointerMove;
        this.pendingPointerMove = null;
        if (pending) this.processPointerMove(pending);
      });
    }

    processPointerMove(event) {
      if (this.burstTarget > 0) {
        return;
      }

      if (this.container.classList.contains("is-observation-dragging")) {
        this.activeInteractionRect = null;
        this.resetHoverLookTarget();
        this.clearHoverForDrag();
        return;
      }

      if (this.pressPointerId === event.pointerId) {
        // Pointer capture retargets move events to the stage, so the viewport
        // check below would otherwise misread a tiny movement as leaving the
        // observation window and collapse the eye back into the hypercube.
        this.resetHoverLookTarget();
        this.lockCursorToPressCenter();
        return;
      }

      const mediaViewport = event.target?.closest?.(".archive-media-window__viewport");
      if (this.container.classList.contains("has-archive-media-windows") && !mediaViewport) {
        this.activeInteractionRect = null;
        this.resetHoverLookTarget();
        this.exitHover();
        this.cursorSnapActive = false;
        this.dispatchCursorSnap(false);
        this.container.classList.remove("is-hud-scanning");
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
      this.updateAmbientHudPointer(event, distance >= hitRadius);

    }

    updateCursorSnap(event) {
      const { distance, rect } = this.getPressDistance(event);
      const center = this.getPressCenter(rect);
      const active = distance <= this.getCursorSnapRadius();
      this.cursorSnapActive = active;
      this.dispatchCursorSnap(active, center.x, center.y);
    }

    getCursorMetrics() {
      if (this.cachedCursorMetrics) return this.cachedCursorMetrics;

      // Mirror the responsive sizing in archiveCursor.js (updateCursorSize) so
      // the red center dot tracks the real cursor's outer ring / inner dot on
      // any viewport height.
      const desktopReferenceHeight = 1080;
      const desktopOuterSize = 25;
      const desktopDotSize = 8;
      const scale = window.innerHeight / desktopReferenceHeight;
      const snapEven = (value) => Math.max(2, Math.round(value / 2) * 2);

      this.cachedCursorMetrics = {
        outer: snapEven(desktopOuterSize * scale),
        dot: snapEven(desktopDotSize * scale),
      };
      return this.cachedCursorMetrics;
    }

    getCursorSnapRadius() {
      const hoverScale = 1.8;
      const dotRadius = 2.5;
      const outerSize = this.getCursorMetrics().outer;

      return (outerSize / 2) * hoverScale + dotRadius;
    }

    onPointerLeave() {
      if (this.pointerMoveFrame !== null) {
        window.cancelAnimationFrame(this.pointerMoveFrame);
        this.pointerMoveFrame = null;
      }
      this.pendingPointerMove = null;
      this.resetHoverLookTarget();
      if (this.pressPointerId !== null) {
        return;
      }

      this.cursorSnapActive = false;
      this.dispatchCursorSnap(false);
      if (this.burstTarget > 0) return;

      this.cancelLongPress();
      this.exitHover();
      this.container.classList.remove("is-hud-scanning");
      this.updateAmbientHudState("DORMANT");
    }

    clearHoverForDrag() {
      this.cancelLongPress();
      this.hoverTarget = 0;
      this.hoverAmount = 0;
      this.hoverDustTarget = 0;
      this.hoverDustAmount = 0;
      this.isHoverDustExiting = false;
      this.cursorSnapActive = false;
      this.resetHoverLookTarget();
      this.container.classList.remove("is-hypercube-hovered", "is-hud-scanning");
      this.setAmbientHudEyeRecord(false);
      this.updateAmbientHudState("DORMANT");
      this.dispatchCursorSnap(false);
    }

    onPointerDown(event) {
      if (event.button !== 0) return;
      if (
        this.container.classList.contains("has-archive-media-windows") &&
        !event.target?.closest?.(".archive-media-window__viewport")
      ) {
        return;
      }

      // Long-press only starts when the cursor is actually aimed at (snapped to)
      // the red center dot. We do NOT force-snap on press.
      const { distance } = this.getPressDistance(event);
      if (this.burstTarget > 0 || distance > this.getCursorSnapRadius()) return;

      this.pressStartTime = performance.now();
      this.pressPointerId = event.pointerId;
      this.updateCursorPressState(true);
      this.updateAmbientHudPress(0);
      this.enterHover();
      this.resetHoverLookTarget();
      this.lockCursorToPressCenter();
      this.container.setPointerCapture?.(event.pointerId);
    }

    onPointerUp(event) {
      if (this.pressPointerId !== event.pointerId) return;

      this.cancelLongPress();
      this.cursorSnapActive = false;
      this.dispatchCursorSnap(false);
      this.container.releasePointerCapture?.(event.pointerId);
      this.reconcileHoverAfterPress(event);
    }

    reconcileHoverAfterPress(event) {
      if (this.burstTarget > 0) return;

      const pointerTarget = document.elementFromPoint(event.clientX, event.clientY);
      const mediaViewport = pointerTarget?.closest?.(".archive-media-window__viewport");
      if (this.container.classList.contains("has-archive-media-windows") && !mediaViewport) {
        this.activeInteractionRect = null;
        this.resetHoverLookTarget();
        this.exitHover();
        this.container.classList.remove("is-hud-scanning");
        this.updateAmbientHudState("DORMANT");
        return;
      }

      const { distance, rect } = this.getCenterDistance(event);
      const exitRadius = Math.min(rect.width, rect.height) * this.hoverExitRadiusRatio;
      if (distance < exitRadius) {
        this.enterHover();
        this.updateHoverLookTarget(event, true);
        this.updateCursorSnap(event);
        this.updateAmbientHudPointer(event, false);
        return;
      }

      this.activeInteractionRect = null;
      this.resetHoverLookTarget();
      this.exitHover();
      this.container.classList.remove("is-hud-scanning");
      this.updateAmbientHudState("DORMANT");
    }

    lockCursorToPressCenter() {
      const rect = this.getActiveInteractionRect();
      const center = this.getPressCenter(rect);
      this.cursorSnapActive = true;
      this.dispatchCursorSnap(true, center.x, center.y);
    }

    dispatchCursorSnap(active, x = 0, y = 0) {
      if (
        this.lastCursorSnapActive === active &&
        (!active || (this.lastCursorSnapX === x && this.lastCursorSnapY === y))
      ) {
        return;
      }
      this.lastCursorSnapActive = active;
      this.lastCursorSnapX = x;
      this.lastCursorSnapY = y;
      window.dispatchEvent(new CustomEvent("archive:cursor-snap", {
        detail: active ? { active, x, y } : { active: false },
      }));
    }

    enterHover() {
      this.isHoverDustExiting = false;
      this.hoverTarget = 1;
      this.container.classList.add("is-hypercube-hovered");
      this.setAmbientHudEyeRecord(true);
    }

    exitHover() {
      this.hoverDustTarget = 0;
      this.isHoverDustExiting = this.hoverDustAmount > 0.02;

      if (!this.isHoverDustExiting) {
        this.hoverTarget = 0;
        this.container.classList.remove("is-hypercube-hovered");
        this.setAmbientHudEyeRecord(false);
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
          this.setAmbientHudEyeRecord(false);
        }
        return;
      }

      // Start the eye glow + rays cross-fading in mid-collapse (not after the cube
      // has almost finished morphing) so there is no gap between "cube formed the
      // eye" and "rays appear" — the whole hand-off reads as one continuous motion.
      this.hoverDustTarget = this.hoverTarget === 1 && this.hoverAmount > 0.58 ? 1 : 0;
    }

    updateHoverLookTarget(event, active) {
      if (!active || !this.hoverDustGroup) {
        this.resetHoverLookTarget();
        return;
      }

      const rect = this.getActiveInteractionRect();
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
      const tiltX = this.hoverLookCurrent.y * this.hoverLookMaxTilt * active;
      const tiltY = this.hoverLookCurrent.x * this.hoverLookMaxTilt * active;
      const interactionRect = this.getActiveInteractionRect();

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
        const rect = interactionRect;
        const center = this.getPressCenter(rect);
        const cursorMetrics = this.getCursorMetrics();
        let ox = this.hoverLookCurrent.x;
        let oy = this.hoverLookCurrent.y;
        const len = Math.hypot(ox, oy);

        if (len > 1) {
          ox /= len;
          oy /= len;
        }

        // While the cursor is magnetically snapped to the press center, keep the
        // red dot exactly on that center so it stays concentric with the
        // cursor's inner circle and long-press range ring. Otherwise it roams
        // within the cursor's (hover-scaled) outer-ring radius so the travel
        // range matches the visible outer circle. Its diameter matches the
        // cursor's inner dot. Both track the responsive cursor sizing.
        const outerHoverRadius = (cursorMetrics.outer / 2) * 1.8 + 5;
        const dotOffset = this.cursorSnapActive ? 0 : outerHoverRadius;
        const dotX = center.x + ox * dotOffset;
        const dotY = center.y + oy * dotOffset;
        const opacity = Math.max(this.hoverDustAmount, this.pressAmount) * (1 - this.burstAmount);

        const dotSize = `${cursorMetrics.dot}px`;
        const dotXValue = `${dotX}px`;
        const dotYValue = `${dotY}px`;
        const dotOpacity = opacity.toFixed(3);
        const cache = this.hoverDotStyleCache;

        if (cache.size !== dotSize) {
          cache.size = dotSize;
          this.hoverCenterDotEl.style.setProperty("--dot-size", dotSize);
        }
        if (cache.x !== dotXValue) {
          cache.x = dotXValue;
          this.hoverCenterDotEl.style.setProperty("--dot-x", dotXValue);
        }
        if (cache.y !== dotYValue) {
          cache.y = dotYValue;
          this.hoverCenterDotEl.style.setProperty("--dot-y", dotYValue);
        }
        if (cache.opacity !== dotOpacity) {
          cache.opacity = dotOpacity;
          this.hoverCenterDotEl.style.setProperty("--dot-opacity", dotOpacity);
        }
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
      this.container.classList.remove("is-hud-scanning", "is-hud-pressing");
      this.container.style.setProperty("--archive-hud-progress", "0");
      this.container.style.setProperty("--archive-hud-tension", "0");
      this.updateAmbientHudState("OPEN");
      this.cursorSnapActive = false;
      this.dispatchCursorSnap(false);
      window.dispatchEvent(new CustomEvent("archive:hypercube-burst"));
      if (this.cardStream) {
        this.cardStream.activate();
      }
    }

    cancelLongPress() {
      this.pressStartTime = 0;
      this.pressPointerId = null;
      this.updateCursorPressState(false);
      this.container.classList.remove("is-hud-pressing");
      this.ambientHud?.style.setProperty("--archive-hud-progress", "0");
      this.container.style.setProperty("--archive-hud-progress", "0");
      this.container.style.setProperty("--archive-hud-tension", "0");
      if (this.burstTarget === 0) {
        this.updateAmbientHudState(this.hoverTarget === 1 ? "ACQUIRING" : "DORMANT");
        if (this.hudScan) {
          this.hudScan.textContent = "000%";
        }
        if (this.hudEyeRecordActive) {
          this.hudPressPhaseIndex = -1;
          delete this.ambientHud.dataset.pressPhase;
          this.updateAmbientHudStaticPressCopy(-1);
          this.setHudRecordText("THE EYE");
          this.hudSummary.textContent = "It does not look at you. It remembers the version of you that has not happened yet.";
        }
      }
    }

    isInPressCenter(event) {
      const { distance, rect } = this.getPressDistance(event);
      const pressRadius = this.getPressRadius(rect);

      return distance < pressRadius;
    }

    updatePressTargetGuide() {
      if (!this.pressTargetGuide) return;

      const rect = this.getActiveInteractionRect();
      const diameter = this.getPressRadius(rect) * 2;
      const center = this.getPressCenter(rect);

      // Pin the guide to the press center (cube center + hypercube offset) so it
      // follows the assembly; transform: translate(-50%, -50%) keeps it centered.
      this.pressTargetGuide.style.left = `${center.x}px`;
      this.pressTargetGuide.style.top = `${center.y}px`;
      this.pressTargetGuide.style.width = `${diameter}px`;
      this.pressTargetGuide.style.height = `${diameter}px`;
      this.updateHoverExitGuide(rect);
      this.updateDebugCircles();
    }

    updateHoverExitGuide(rect) {
      if (!this.hoverExitGuide) return;

      const radius = Math.min(rect.width, rect.height) * this.hoverExitRadiusRatio;
      const offset = this.getHypercubeScreenOffset(rect);
      this.hoverExitGuide.style.left = `${rect.left + rect.width / 2 + offset.x}px`;
      this.hoverExitGuide.style.top = `${rect.top + rect.height / 2 + offset.y}px`;
      this.hoverExitGuide.style.width = `${radius * 2}px`;
      this.hoverExitGuide.style.height = `${radius * 2}px`;
    }

    updateDebugCircles() {
      if (!this.rayInnerRingEl) return;

      const rect = this.getActiveInteractionRect();
      const base = this.getHoverDustBaseSize();
      const pxPerWorld = rect.height / base;
      // Inner radius of the hover-dust ray field (see createHoverDust),
      // pulled in by 10px per request.
      const innerRadius = base * 0.32 * pxPerWorld - 10;
      const dustCenter = this.getHoverDustCenter();
      const cx = rect.left + rect.width / 2 + dustCenter.x * pxPerWorld;
      const cy = rect.top + rect.height / 2 - dustCenter.y * pxPerWorld;

      this.rayInnerRingEl.style.left = `${cx}px`;
      this.rayInnerRingEl.style.top = `${cy}px`;
      this.rayInnerRingEl.style.width = `${innerRadius * 2}px`;
      this.rayInnerRingEl.style.height = `${innerRadius * 2}px`;

      if (this.eyeFxEl) {
        // Square center must coincide with the red center dot (press center),
        // not the up-right-shifted eye pattern.
        const dotCenter = this.getPressCenter(rect);
        this.eyeFxEl.style.left = `${dotCenter.x}px`;
        this.eyeFxEl.style.top = `${dotCenter.y}px`;
      }
    }

    getHypercubeScreenCenter(rect) {
      if (!this.cubeCloud) return this.getPressCenter(rect);

      this.cubeCloud.updateWorldMatrix(true, false);
      this.cubeCloud.getWorldPosition(this.cubeWorldCenter);
      this.cubeWorldCenter.project(this.camera);

      return {
        x: rect.left + (this.cubeWorldCenter.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-this.cubeWorldCenter.y * 0.5 + 0.5) * rect.height,
      };
    }

    updateCursorPressState(active) {
      const progress = active ? this.pressAmount : 0;
      if (
        this.lastCursorPressActive === active &&
        (!active || this.lastCursorPressProgress === progress)
      ) {
        return;
      }
      this.lastCursorPressActive = active;
      this.lastCursorPressProgress = progress;
      window.dispatchEvent(new CustomEvent("archive:hypercube-long-press", {
        detail: {
          active,
          progress,
        },
      }));
    }

    updateAmbientHudPointer(event, isScanning) {
      if (!this.ambientHud || this.burstTarget > 0) return;

      const rect = this.getInteractionRect(event);
      const x = Math.round(THREE.MathUtils.clamp(event.clientX - rect.left, 0, rect.width));
      const y = Math.round(THREE.MathUtils.clamp(event.clientY - rect.top, 0, rect.height));
      if (this.hudCoord) {
        this.hudCoord.textContent = `X${String(x).padStart(4, "0")} / Y${String(y).padStart(4, "0")}`;
      }
      this.container.classList.toggle("is-hud-scanning", isScanning);

      if (this.pressPointerId === null) {
        this.updateAmbientHudState("ACQUIRING");
      }
    }

    updateAmbientHudPress(progress) {
      if (!this.ambientHud || this.burstTarget > 0) return;

      const clamped = THREE.MathUtils.clamp(progress, 0, 1);
      const tension = clamped * clamped;
      const remaining = Math.max(0, (this.longPressDuration * (1 - clamped)) / 1000);
      const progressValue = clamped.toFixed(3);
      const tensionValue = tension.toFixed(3);
      if (!this.container.classList.contains("is-hud-pressing")) {
        this.container.classList.add("is-hud-pressing");
      }
      if (this.hudPressStyleCache.progress !== progressValue) {
        this.hudPressStyleCache.progress = progressValue;
        this.ambientHud.style.setProperty("--archive-hud-progress", progressValue);
        this.container.style.setProperty("--archive-hud-progress", progressValue);
      }
      if (this.hudPressStyleCache.tension !== tensionValue) {
        this.hudPressStyleCache.tension = tensionValue;
        this.container.style.setProperty("--archive-hud-tension", tensionValue);
      }
      this.updateAmbientHudState("DECRYPTING");
      this.applyAmbientHudPressCopy(clamped, remaining);
    }

    applyAmbientHudPressCopy(progress, remaining = this.longPressDuration / 1000) {
      const phaseIndex = HUD_PRESS_PHASES.reduce(
        (currentIndex, candidate, index) => progress >= candidate.threshold ? index : currentIndex,
        0
      );
      const phase = HUD_PRESS_PHASES[phaseIndex];

      if (phaseIndex !== this.hudPressPhaseIndex) {
        this.hudPressPhaseIndex = phaseIndex;
        this.ambientHud.dataset.pressPhase = String(phaseIndex);
        this.updateAmbientHudStaticPressCopy(phaseIndex);
        this.hudSummary.textContent = phase.summary;
        this.scrambleElement(this.hudSignal, phase.signal, 300);
        // Swap the wordmark copy directly (no per-glyph scramble): the VFX layer
        // re-captures once per phase, so the transition stays smooth instead of
        // thrashing the texture ~15x/phase.
        this.setHudRecordText(phase.title);
      }
      if (this.hudScan) {
        const scanText = `${String(Math.round(progress * 100)).padStart(3, "0")}%`;
        if (this.hudScan.textContent !== scanText) {
          this.hudScan.textContent = scanText;
        }
      }
      if (this.hudInstruction) {
        const instructionText = `${phase.instruction} / ${remaining.toFixed(2)} SEC`;
        if (this.hudInstruction.textContent !== instructionText) {
          this.hudInstruction.textContent = instructionText;
        }
      }
    }

    updateAmbientHudStaticPressCopy(phaseIndex) {
      const variants = [
        {
          archive: "NOOSPHERE ARCHIVE",
          eyebrow: "POST–HUMAN FIELD RECORD",
          classes: ["CLASS IV", "RESTRICTED", "CRC ACTIVE"],
          matrix: "EXTRACTION",
          matrixState: "ONLINE",
        },
        {
          archive: "MEMORY OVERRIDE",
          eyebrow: "RECURSIVE SIGNAL",
          classes: ["CLASS IV", "CORE LOCK", "CRC ERROR"],
          matrix: "CONTAINMENT",
          matrixState: "UNSTABLE",
        },
        {
          archive: "IDENTITY BREACH",
          eyebrow: "OBSERVER CORRUPTED",
          classes: ["CLASS Ω", "BREACH", "CRC FAILED"],
          matrix: "COGNITIVE",
          matrixState: "CRITICAL",
        },
        {
          archive: "ARCHIVE AWAKE",
          eyebrow: "SUBJECT MERGED",
          classes: ["CLASS NULL", "NO RELEASE", "CRC VOID"],
          matrix: "MATRIX LOST",
          matrixState: "OPEN",
        },
      ];
      const copy = variants[Math.max(0, phaseIndex)];
      const setText = (element, text) => {
        if (element) element.textContent = text;
      };

      setText(this.hudStaticCopy.archive, copy.archive);
      setText(this.hudStaticCopy.eyebrow, copy.eyebrow);
      this.hudStaticCopy.classes.forEach((element, index) => setText(element, copy.classes[index] || ""));
      setText(this.hudStaticCopy.matrix, copy.matrix);
      setText(this.hudStaticCopy.matrixState, copy.matrixState);
    }

    scrambleElement(el, finalText, duration = 360) {
      if (!el) return;
      const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/#%*+<>";
      const start = performance.now();
      clearInterval(el._scrambleTimer);
      el._scrambleTimer = setInterval(() => {
        const progress = Math.min((performance.now() - start) / duration, 1);
        const revealed = Math.floor(progress * finalText.length);
        let out = "";
        for (let i = 0; i < finalText.length; i++) {
          const ch = finalText[i];
          out += i < revealed || ch === " " ? ch : glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        el.textContent = out;
        if (progress >= 1) {
          clearInterval(el._scrambleTimer);
          el.textContent = finalText;
        }
      }, 28);
    }

    // Text-only HUD glitch: a short scanline jump on the wordmark. Does NOT flash
    // the full-screen eyelid blink (that is reserved for triggerBlink, driven only
    // by the 8-15s cadence), so state transitions don't add extra black blinks.
    triggerHudGlitch() {
      if (!this.ambientHud) return;

      this.ambientHud.classList.remove("is-hud-glitch");
      // Force reflow so the short animation restarts even on rapid re-triggers.
      void this.ambientHud.offsetWidth;
      this.ambientHud.classList.add("is-hud-glitch");
      clearTimeout(this.hudGlitchTimer);
      this.hudGlitchTimer = setTimeout(() => {
        this.ambientHud?.classList.remove("is-hud-glitch");
      }, 400);
    }

    // Full eyelid blink: the existing black-screen shutter. Normal scheduled
    // blinks keep their accompanying HUD glitch; the one-off first-load blink
    // can reuse the same shutter without making the separate text fault overlap.
    triggerBlink(includeHudGlitch = true) {
      if (includeHudGlitch) this.triggerHudGlitch();
      if (!this.container) return;

      this.container.classList.remove("is-hud-glitch");
      void this.container.offsetWidth;
      this.container.classList.add("is-hud-glitch");
      clearTimeout(this.blinkTimer);
      this.blinkTimer = setTimeout(() => {
        this.container?.classList.remove("is-hud-glitch");
      }, 400);
    }

    scheduleInitialGlitches() {
      clearTimeout(this.initialBlinkTimer);
      clearTimeout(this.initialTextGlitchTimer);

      // Keep the two required first-load faults random but non-overlapping.
      // One occupies an early window and the other a later window; their order
      // is shuffled on every page entry. Both finish before the three-second mark.
      const earlyDelay = 400 + Math.random() * 850;
      const lateDelay = 1800 + Math.random() * 650;
      const blinkFirst = Math.random() < 0.5;
      const blinkDelay = blinkFirst ? earlyDelay : lateDelay;
      const textDelay = blinkFirst ? lateDelay : earlyDelay;

      this.initialBlinkTimer = setTimeout(
        () => this.triggerInitialBlink(),
        blinkDelay
      );
      this.initialTextGlitchTimer = setTimeout(
        () => this.triggerInitialTextGlitch(),
        textDelay
      );
    }

    triggerInitialBlink() {
      this.triggerBlink(false);
    }

    triggerInitialTextGlitch() {
      this.triggerHudGlitch();
      window.dispatchEvent(new CustomEvent("archive:eye-glitch", {
        detail: { duration: 320 },
      }));
    }

    updateAmbientHudState(state) {
      if (!this.ambientHud) return;

      const changed = this.hudState !== state;
      this.hudState = state;
      const stateValue = state.toLowerCase();
      if (this.ambientHud.dataset.state !== stateValue) {
        this.ambientHud.dataset.state = stateValue;
      }

      // Skip the state-change blink while a long-press is active: the press owns
      // its single randomly-timed blink, so entering DECRYPTING must not add one.
      if (changed && this.burstTarget === 0 && this.pressPointerId === null) {
        this.triggerHudGlitch();
        this.scrambleElement(this.hudSignal, state, 300);
      } else if (this.hudSignal && this.hudSignal.textContent !== state) {
        this.hudSignal.textContent = state;
      }

      if (state === "OPEN" && this.hudInstruction) {
        if (this.hudInstruction.textContent !== "ARCHIVE CHANNEL OPEN") {
          this.hudInstruction.textContent = "ARCHIVE CHANNEL OPEN";
        }
      } else if (state !== "DECRYPTING" && this.hudInstruction) {
        if (this.hudInstruction.textContent !== "HOLD CORE / 03.00 SEC TO DECODE") {
          this.hudInstruction.textContent = "HOLD CORE / 03.00 SEC TO DECODE";
        }
      }
    }

    setAmbientHudEyeRecord(active) {
      if (!this.hudRecord || !this.hudSummary || this.hudEyeRecordActive === active) return;

      window.clearTimeout(this.hudEyeRecordClearTimer);
      this.hudEyeRecordClearTimer = 0;
      this.hudEyeRecordActive = active;
      this.ambientHud.dataset.eyeRecord = active ? "active" : "dormant";
      if (active) {
        this.ambientHud.classList.remove("is-eye-record-exiting");
        this.hudPressPhaseIndex = -1;
        this.setHudRecordText("THE EYE");
        this.hudSummary.textContent = "It does not look at you. It remembers the version of you that has not happened yet.";
        window.dispatchEvent(new CustomEvent("archive:eye-record-visibility", {
          detail: { active: true },
        }));
        return;
      }

      this.hudPressPhaseIndex = -1;
      delete this.ambientHud.dataset.pressPhase;
      this.ambientHud.classList.add("is-eye-record-exiting");
      window.dispatchEvent(new CustomEvent("archive:eye-record-visibility", {
        detail: { active: false },
      }));
      this.hudEyeRecordClearTimer = window.setTimeout(() => {
        if (this.hudEyeRecordActive) return;
        this.ambientHud.classList.remove("is-eye-record-exiting");
        this.setHudRecordText("");
        this.hudSummary.textContent = "";
        this.hudEyeRecordClearTimer = 0;
      }, 420);
    }

    setHudRecordText(text) {
      if (!this.hudRecord) return;
      const textLayer = this.hudRecord.querySelector(".strata__record-title-text");
      if (textLayer) {
        textLayer.textContent = text;
        return;
      }
      this.hudRecord.textContent = text;
    }

    getAmbientHudSummary(word) {
      if (/ENTITY|SPECIMEN|BIOFORM|EATER|MANTIS|WORM|LARVA|SERAPH|THING|STAG/.test(word)) {
        return "Unclassified entity signature retained at the edge of the field.";
      }
      if (/HAZARD|NULL|STATIC|PARALYSIS|BLEED/.test(word)) {
        return "Cognitive interference exceeds the stable archive threshold.";
      }
      if (/MEMORY|MNEMONIC|DREAM|THOUGHT|EGO|SUBCONSCIOUS/.test(word)) {
        return "Residual cognition detected beyond the indexed field.";
      }

      return "Recovered signal fragment awaiting noospheric classification.";
    }

    getPressRadius(rect) {
      return Math.min(rect.width, rect.height) * this.pressRadiusRatio;
    }

    getHypercubeWorldOffset() {
      const base = this.getHoverDustBaseSize();

      return {
        x: base * this.hypercubeOffsetXRatio,
        y: base * this.hypercubeOffsetYRatio,
      };
    }

    getHypercubeScreenOffset(rect) {
      // World-to-screen scale is rect.height / visibleHeight on both axes, so a
      // world-ratio offset maps to ratio * rect.height px. World +y is up, which
      // is screen -y.
      return {
        x: this.hypercubeOffsetXRatio * rect.height,
        y: -this.hypercubeOffsetYRatio * rect.height,
      };
    }

    applyHypercubeOffset() {
      if (!this.cubeCloud) return;

      const offset = this.getHypercubeWorldOffset();
      this.cubeCloud.position.x = offset.x;
      this.cubeCloud.position.y = offset.y;
    }

    getPressCenter(rect) {
      const base = Math.min(rect.width, rect.height);
      const offset = this.getHypercubeScreenOffset(rect);

      return {
        x: rect.left + rect.width / 2 + base * this.pressOffsetXRatio + offset.x,
        y: rect.top + rect.height / 2 + base * this.pressOffsetYRatio + offset.y,
      };
    }

    getPressDistance(event) {
      const rect = this.getInteractionRect(event);
      const center = this.getPressCenter(rect);

      return {
        distance: Math.hypot(event.clientX - center.x, event.clientY - center.y),
        rect,
      };
    }

    getCenterDistance(event) {
      const rect = this.getInteractionRect(event);
      const offset = this.getHypercubeScreenOffset(rect);
      const x = event.clientX - rect.left - rect.width / 2 - offset.x;
      const y = event.clientY - rect.top - rect.height / 2 - offset.y;

      return {
        distance: Math.hypot(x, y),
        rect,
      };
    }

    getInteractionRect(event) {
      return this.getActiveInteractionRect();
    }

    getActiveInteractionRect() {
      return this.activeInteractionRect || this.refreshInteractionRect();
    }

    refreshInteractionRect() {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.activeInteractionRect = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
      return this.activeInteractionRect;
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
            float pressSq = uPress * uPress * (1.0 - uBurst);
            // Rays stretch outward while an accelerating suck drags dust back
            // toward the iris, and the tremble amplitude climbs near completion.
            float rayLength = (0.05 + offset * 0.09) * pressMotion;
            float suck = pressSq * (0.14 + offset * 0.12);
            float rayNoise = sin(uTime * 1.35 + offset * 37.6991) * (0.012 + 0.03 * pressSq) * pressMotion;

            currentPos.xy = uDustCenter + fromCenter * dustReveal * dustScale;
            currentPos.xy += (dustTangent * drift + dustDir * shimmer) * hoverMotion;
            currentPos.xy += dustDir * (rayLength - suck + rayNoise) + dustTangent * rayNoise * 0.45;

            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
            gl_PointSize = (uResolution / 220.2) * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            float pressGlow = 1.0 + uPress * 0.55 + pressSq * 0.6;
            vAlpha = alpha * pressGlow * mix(0.42, 1.0, clamp(rayStrength, 0.0, 1.0)) * fade;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;

          void main() {
            vec2 p = abs(gl_PointCoord - vec2(0.5));
            float r = 0.12;
            vec2 q = p - (0.5 - r);
            if (length(max(q, 0.0)) - r > 0.0) discard;
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
      this.visualLayer.appendChild(this.hoverCenterDotEl);
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
          uColor: { value: this.baseRayColor.clone() },
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
            // Full opacity so the canvas' hover difference-blend fully inverts the
            // rays against the frames (a lower alpha washes them to mid-gray and
            // they vanish over similarly toned bands).
            gl_FragColor = vec4(uColor, uHover * (1.0 - uBurst));
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
        x: base * this.pressOffsetXRatio + base * this.eyeShiftXRatio + base * this.hypercubeOffsetXRatio,
        y: -base * this.pressOffsetYRatio + base * this.eyeShiftYRatio + base * this.hypercubeOffsetYRatio,
      };
    }

    updateEyeShift() {
      if (!this.mat) return;

      const base = this.getHoverDustBaseSize();
      this.mat.uniforms.uEyeShift.value.set(
        base * this.eyeShiftXRatio,
        base * this.eyeShiftYRatio
      );
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
        const image = await this.loadImage("../assets/images/fullEye.svg");
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
