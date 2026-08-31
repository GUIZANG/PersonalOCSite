(function () {
  const THEMES = [
    {
      number: "01",
      title: "SIGNAL",
      code: "FIELD TRACE",
      state: "LOCKED",
      topology: "INTERFERENCE FIELD",
      coordinate: "31.7 / 08.2",
    },
    {
      number: "02",
      title: "VECTOR",
      code: "MOTION DATUM",
      state: "PROJECTED",
      topology: "PROJECTED MOTION",
      coordinate: "17.4 / 62.1",
    },
    {
      number: "03",
      title: "ORACLE",
      code: "OCULAR RESIDUE",
      state: "OBSERVING",
      topology: "RETINAL RESIDUE",
      coordinate: "00.3 / 93.8",
    },
    {
      number: "04",
      title: "NOESIS",
      code: "MEMORY STRATA",
      state: "RECURSIVE",
      topology: "RECURSIVE MEMORY",
      coordinate: "72.9 / 11.0",
    },
  ];

  const normalizeIndex = (index) =>
    ((index % THEMES.length) + THEMES.length) % THEMES.length;

  class ArchiveCardStream {
    constructor() {
      this.stream = document.getElementById("archiveCardStream");
      if (!this.stream) return;

      this.active = false;
      this.themeIndex = 0;
      this.pendingThemeIndex = null;
      this.pointerId = null;
      this.pointerStartX = null;
      this.dragStarted = false;
      this.dragStartThemeIndex = 0;
      this.dragStartOrbitPosition = 0;
      this.dragPosition = 0;
      this.dragRawPosition = 0;
      this.lastDragClientX = 0;
      this.lastDragClientY = 0;
      this.lastDragTime = 0;
      this.dragVelocity = 0;
      this.suppressClick = false;
      this.wheelLockedUntil = 0;
      this.railProgress = 0;
      this.orbitPosition = 0;
      this.railAnimating = false;
      this.railAnimationFrame = 0;
      this.themeSwapTimer = 0;
      this.transitionTimer = 0;
      this.entranceTimer = 0;
      this.detentTimer = 0;
      this.modelView = null;
      this.thermalEnabled = false;

      this.build();
      this.bindEvents();
      this.applyTheme(0);
      window.archiveCardStreamInstance = this;
      window.dispatchEvent(
        new CustomEvent("archive-card-stream-ready", { detail: this })
      );
    }

    buildChannel(theme, index) {
      return `
        <section
          class="archive-screen__channel"
          data-theme-index="${index}"
          data-screen-theme="${theme.title.toLowerCase()}"
          aria-hidden="${index === 0 ? "false" : "true"}"
        >
          <div class="archive-screen__channel-field" aria-hidden="true">
            <i></i><i></i><i></i><i></i><i></i><i></i>
          </div>

          <header class="archive-screen__channel-header">
            <span><i></i>CHANNEL / ${theme.number}</span>
            <b>${theme.code}</b>
            <em>${theme.state}</em>
          </header>

          <div class="archive-screen__channel-title">
            <span>${theme.title}</span>
            <span aria-hidden="true">${theme.title}</span>
          </div>

          <div class="archive-screen__channel-index" aria-hidden="true">
            ${theme.number}
          </div>

          <footer class="archive-screen__channel-footer">
            <span>${theme.topology}</span>
            <b></b>
            <span>CAL / ${theme.coordinate}</span>
          </footer>
        </section>
      `;
    }

    buildScreen(theme, index) {
      return `
        <article
          class="archive-screen-module"
          data-module-index="${index}"
          style="--archive-module-angle: ${index * 90}deg; --archive-module-order: ${index}"
          aria-label="Archive screen ${theme.number}: ${theme.title}"
        >
          <div class="archive-screen__arm" aria-hidden="true"><i></i><i></i></div>
          <div class="archive-screen__cables" aria-hidden="true"><i></i><i></i></div>

          <div class="archive-screen__shell">
            <div class="archive-screen__face archive-screen__face--back">
              <span></span><span></span><span></span><span></span>
            </div>
            <div class="archive-screen__face archive-screen__face--left"></div>
            <div class="archive-screen__face archive-screen__face--right"></div>
            <div class="archive-screen__face archive-screen__face--top"></div>
            <div class="archive-screen__face archive-screen__face--bottom"></div>

            <div class="archive-screen__face archive-screen__face--front">
              <div class="archive-screen__hardware" aria-hidden="true">
                <span>GB / ${theme.number}</span>
                <i></i><i></i><i></i><i></i>
                <b>${theme.state}</b>
              </div>

              <div class="archive-screen__glass">
                ${this.buildChannel(theme, index)}
                <div class="archive-screen__scanlines" aria-hidden="true"></div>
                <div class="archive-screen__flare" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </article>
      `;
    }

    build() {
      const screens = THEMES.map((theme, index) =>
        this.buildScreen(theme, index)
      ).join("");

      this.stream.innerHTML = `
        <div class="archive-interface">
          <div
            class="archive-screen-stage"
            role="slider"
            tabindex="0"
            aria-label="Drag the archive model to rotate screens"
            aria-valuemin="1"
            aria-valuemax="${THEMES.length}"
            aria-valuenow="1"
            aria-valuetext="${THEMES[0].number}: ${THEMES[0].title}"
          >
            <div class="archive-screen__horizon" aria-hidden="true"></div>

            <div
              class="archive-card-model"
              id="archiveCardModel"
              aria-label="Four rotating industrial archive displays"
            >
              <span class="archive-card-model__status">ASSEMBLING / 3D</span>
            </div>

            <button
              class="archive-thermal-toggle"
              type="button"
              aria-pressed="false"
              aria-label="Enable thermal imaging"
            >
              <i aria-hidden="true"></i>
              <span>THERMAL</span><b>T–00</b>
            </button>

            <div class="archive-orbit-assembly">
              <div class="archive-orbit__umbra" aria-hidden="true"></div>
              <div class="archive-orbit__floor" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
              <div class="archive-orbit__mast" aria-hidden="true">
                <i></i><i></i><i></i><i></i><b></b>
              </div>
              <div class="archive-orbit__crown" aria-hidden="true"><i></i><i></i><i></i></div>
              <div class="archive-orbit__cable-bundle" aria-hidden="true">
                <i></i><i></i><i></i><i></i><b></b><b></b>
              </div>
              <div class="archive-screen-orbit">
                ${screens}
              </div>
            </div>

          </div>
        </div>
      `;

      this.channels = Array.from(
        this.stream.querySelectorAll(".archive-screen__channel")
      );
      this.modules = Array.from(
        this.stream.querySelectorAll(".archive-screen-module")
      );
      this.railButtons = [];
      this.rail = this.stream.querySelector(".archive-screen-stage");
      this.modelHost = this.stream.querySelector("#archiveCardModel");
      this.thermalButton = this.stream.querySelector(".archive-thermal-toggle");
    }

    bindEvents() {
      this.thermalButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (this.stream.classList.contains("is-archive-interface-entering")) {
          event.preventDefault();
          return;
        }
        this.thermalEnabled = !this.thermalEnabled;
        this.thermalButton.classList.toggle("is-active", this.thermalEnabled);
        this.thermalButton.setAttribute(
          "aria-pressed",
          String(this.thermalEnabled)
        );
        this.thermalButton.setAttribute(
          "aria-label",
          this.thermalEnabled
            ? "Disable thermal imaging"
            : "Enable thermal imaging"
        );
        const state = this.thermalButton.querySelector("b");
        if (state) state.textContent = this.thermalEnabled ? "T–01" : "T–00";
        this.modelView?.setThermalEnabled(this.thermalEnabled);
      });

      this.stream.addEventListener("click", (event) => {
        if (this.stream.classList.contains("is-archive-interface-entering")) {
          event.preventDefault();
          return;
        }
        if (event.detail !== 0 || this.suppressClick) {
          event.preventDefault();
          this.suppressClick = false;
          return;
        }

        const button = event.target.closest("[data-theme-index]");
        if (!button) return;
        this.setTheme(Number(button.dataset.themeIndex), true);
      });

      this.modelHost?.addEventListener("pointerdown", (event) => {
        if (
          !this.active ||
          this.stream.classList.contains("is-archive-interface-entering") ||
          event.button !== 0
        ) {
          return;
        }

        this.finishPendingTheme();
        this.cancelRailAnimation();
        this.pointerId = event.pointerId;
        this.pointerStartX = event.clientX;
        this.dragStarted = false;
        this.dragStartThemeIndex = this.themeIndex;
        this.dragStartOrbitPosition = this.orbitPosition;
        this.dragPosition = this.orbitPosition;
        this.dragRawPosition = this.orbitPosition;
        this.lastDragClientX = event.clientX;
        this.lastDragClientY = event.clientY;
        this.lastDragTime = performance.now();
        this.dragVelocity = 0;
        this.suppressClick = false;
        this.modelView?.setInteracting(true);
        this.modelHost.setPointerCapture?.(event.pointerId);
      });

      this.stream.addEventListener("pointermove", (event) => {
        if (
          !this.active ||
          this.stream.classList.contains("is-archive-interface-entering") ||
          this.pointerId !== null
        ) {
          this.modelView?.setHovered(false);
          return;
        }
        const modelRect = this.modelHost?.getBoundingClientRect();
        const railRect = this.rail?.getBoundingClientRect();
        const overModel = Boolean(
          modelRect &&
          event.clientX >= modelRect.left &&
          event.clientX <= modelRect.right &&
          event.clientY >= modelRect.top &&
          event.clientY <= modelRect.bottom &&
          (!railRect || event.clientY < railRect.top - 8)
        );
        this.modelView?.setHovered(overModel);
      });

      this.stream.addEventListener("pointerleave", () => {
        this.modelView?.setHovered(false);
      });

      this.modelHost?.addEventListener("pointermove", (event) => {
        if (
          this.pointerId !== event.pointerId ||
          this.pointerStartX === null
        ) {
          return;
        }

        if ((event.buttons & 1) !== 1) {
          this.finishPointerInteraction(false);
          return;
        }

        if (!this.dragStarted) {
          if (Math.abs(event.clientX - this.pointerStartX) <= 6) return;
          this.dragStarted = true;
          this.suppressClick = true;
          this.stream.classList.remove(
            "is-screen-switching",
            "is-screen-settling",
            "is-screen-turn-next",
            "is-screen-turn-previous"
          );
          this.stream.classList.add(
            "is-screen-dragging",
            "is-carousel-rail-dragging"
          );
        }

        this.updateRailDrag(event.clientX, event.clientY);
      });

      this.modelHost?.addEventListener("pointerup", (event) => {
        if (this.pointerId !== event.pointerId) return;
        this.finishPointerInteraction(false);
      });

      this.modelHost?.addEventListener("pointercancel", (event) => {
        if (this.pointerId !== event.pointerId) return;
        this.finishPointerInteraction(true);
      });

      this.modelHost?.addEventListener("lostpointercapture", (event) => {
        if (this.pointerId !== event.pointerId) return;
        this.finishPointerInteraction(false, false);
      });

      this.modelHost?.addEventListener("pointerleave", (event) => {
        if (this.pointerId !== null) {
          if ((event.buttons & 1) !== 1) {
            this.finishPointerInteraction(false);
          }
          return;
        }
        this.snapRailToNearestDetent();
      });

      window.addEventListener(
        "pointerup",
        (event) => {
          if (this.pointerId !== event.pointerId) return;
          this.finishPointerInteraction(false);
        },
        true
      );

      window.addEventListener(
        "pointercancel",
        (event) => {
          if (this.pointerId !== event.pointerId) return;
          this.finishPointerInteraction(true);
        },
        true
      );

      window.addEventListener("blur", () => {
        if (this.pointerId !== null) {
          this.finishPointerInteraction(false);
        } else {
          this.snapRailToNearestDetent();
        }
      });

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;
        if (this.pointerId !== null) {
          this.finishPointerInteraction(false);
        } else {
          this.snapRailToNearestDetent();
        }
      });

      this.stream.addEventListener(
        "wheel",
        (event) => {
          const wheelDelta =
            Math.abs(event.deltaX) > Math.abs(event.deltaY)
              ? event.deltaX
              : event.deltaY;
          if (
            !this.active ||
            this.stream.classList.contains("is-archive-interface-entering") ||
            this.pointerId !== null ||
            Math.abs(wheelDelta) < 5
          ) {
            return;
          }

          event.preventDefault();
          const now = performance.now();
          if (now < this.wheelLockedUntil) return;
          this.wheelLockedUntil = now + 780;
          this.setTheme(
            this.themeIndex + (wheelDelta > 0 ? 1 : -1),
            true,
            "wheel"
          );
        },
        { passive: false }
      );

      window.addEventListener("keydown", (event) => {
        if (
          !this.active ||
          this.stream.classList.contains("is-archive-interface-entering") ||
          this.pointerId !== null ||
          document.body.classList.contains("is-archive-overlay-open") ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey
        ) {
          return;
        }

        if (/^[1-4]$/.test(event.key)) {
          this.setTheme(Number(event.key) - 1, true);
          return;
        }

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          this.setTheme(this.themeIndex + 1, true);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          this.setTheme(this.themeIndex - 1, true);
        }
      });
    }

    activate() {
      if (!this.stream || this.active) return;
      this.active = true;
      this.modelView?.setActive(true);
      this.stream.classList.add(
        "is-archive-interface-active",
        "is-archive-interface-entering"
      );
      window.requestAnimationFrame(() => {
        this.stream.classList.add("is-archive-interface-ready");
      });
      window.clearTimeout(this.entranceTimer);
      this.entranceTimer = window.setTimeout(() => {
        this.stream.classList.remove("is-archive-interface-entering");
      }, 1500);
    }

    updateRailDrag(clientX, clientY) {
      if (!this.modelHost || this.pointerStartX === null) return;
      const rect = this.modelHost.getBoundingClientRect();
      if (!rect.width) return;

      const pixelsPerScreen = Math.max(180, Math.min(420, rect.width * 0.24));
      const rawPosition =
        this.dragStartOrbitPosition +
        (this.pointerStartX - clientX) / pixelsPerScreen;
      const now = performance.now();
      const elapsed = Math.max(8, now - this.lastDragTime);
      const instantaneousVelocity =
        (this.lastDragClientX - clientX) / elapsed;
      const verticalDelta = clientY - this.lastDragClientY;

      this.dragVelocity =
        this.dragVelocity * 0.7 + instantaneousVelocity * 0.3;
      const nearestDetent = Math.round(rawPosition);
      const detentDistance = rawPosition - nearestDetent;
      const normalizedDistance = Math.min(
        1,
        Math.abs(detentDistance) / 0.5
      );
      const magneticPower =
        2.25 - Math.min(0.75, Math.abs(this.dragVelocity) * 0.34);
      const magneticDistance =
        Math.sign(detentDistance) *
        Math.pow(normalizedDistance, magneticPower) *
        0.5;
      const position = nearestDetent + magneticDistance;
      const progress = position / (THEMES.length - 1);
      const nextIndex = normalizeIndex(Math.round(rawPosition));
      const previousPosition = this.dragPosition;

      this.dragPosition = position;
      this.dragRawPosition = rawPosition;
      this.lastDragClientX = clientX;
      this.lastDragClientY = clientY;
      this.lastDragTime = now;
      this.stream.dataset.screenDirection =
        position >= previousPosition ? "next" : "previous";

      if (nextIndex !== this.themeIndex) {
        this.applyTheme(nextIndex, false);
        this.pulseRailDetent();
      }

      const roll = Math.max(
        -1.8,
        Math.min(1.8, this.dragVelocity * -1.15)
      );
      const depth = Math.min(54, Math.abs(this.dragVelocity) * 30);

      this.stream.style.setProperty(
        "--archive-orbit-roll",
        `${roll.toFixed(2)}deg`
      );
      this.stream.style.setProperty(
        "--archive-orbit-depth",
        `${depth.toFixed(2)}px`
      );
      this.modelView?.adjustDragCameraOrbit(verticalDelta);
      this.setRailProgress(progress, false);
      this.setOrbitPosition(position);
    }

    finishPointerInteraction(cancelled = false, releaseCapture = true) {
      if (this.pointerId === null) return;

      const pointerId = this.pointerId;
      const didDrag = this.dragStarted;
      this.pointerId = null;
      this.pointerStartX = null;
      this.dragStarted = false;
      if (didDrag) this.modelView?.releaseDragCameraOrbit();

      if (releaseCapture) {
        try {
          if (this.modelHost?.hasPointerCapture?.(pointerId)) {
            this.modelHost.releasePointerCapture(pointerId);
          }
        } catch (_error) {
          // The browser may have already released capture on blur/leave.
        }
      }

      if (!didDrag) {
        this.modelView?.setInteracting(false);
        this.snapRailToNearestDetent();
        return;
      }

      if (cancelled) {
        this.applyTheme(this.dragStartThemeIndex, false);
        const cycleOffset = Math.round(
          (this.orbitPosition - this.dragStartThemeIndex) / THEMES.length
        );
        this.finishRailDrag(
          this.dragStartThemeIndex + cycleOffset * THEMES.length
        );
      } else {
        const targetOrbitPosition = Math.round(this.dragRawPosition);
        const snapIndex = normalizeIndex(targetOrbitPosition);
        if (snapIndex !== this.themeIndex) {
          this.applyTheme(snapIndex, false);
        }
        this.finishRailDrag(targetOrbitPosition);
      }
    }

    finishRailDrag(targetOrbitPosition = Math.round(this.dragRawPosition)) {
      const changed = this.themeIndex !== this.dragStartThemeIndex;
      const settleDirection = Math.sign(
        targetOrbitPosition - this.orbitPosition
      );
      this.stream.classList.remove(
        "is-screen-dragging",
        "is-carousel-rail-dragging"
      );
      this.stream.classList.add("is-screen-settling");
      if (changed) this.stream.classList.add("is-screen-switching");

      this.resetScreenTransform();
      this.animateRailTo(
        this.themeIndex / (THEMES.length - 1),
        settleDirection ||
          (this.stream.dataset.screenDirection === "previous" ? -1 : 1),
        0,
        760,
        targetOrbitPosition
      );
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = window.setTimeout(() => {
        this.stream.classList.remove(
          "is-screen-settling",
          "is-screen-switching"
        );
      }, 920);
    }

    snapRailToNearestDetent() {
      if (
        this.pointerId !== null ||
        this.railAnimating ||
        !Number.isFinite(this.railProgress)
      ) {
        return;
      }

      const currentPosition = this.railProgress * (THEMES.length - 1);
      const snapIndex = Math.min(
        THEMES.length - 1,
        Math.max(0, Math.round(currentPosition))
      );
      const target = snapIndex / (THEMES.length - 1);
      if (Math.abs(target - this.railProgress) < 0.0005) return;

      const direction = target >= this.railProgress ? 1 : -1;
      if (snapIndex !== this.themeIndex) {
        this.applyTheme(snapIndex, false);
      }
      this.animateRailTo(target, direction, this.dragVelocity, 620);
    }

    pulseRailDetent() {
      this.stream.classList.remove("is-rail-detent-impact");
      void this.stream.offsetWidth;
      this.stream.classList.add("is-rail-detent-impact");
      window.clearTimeout(this.detentTimer);
      this.detentTimer = window.setTimeout(() => {
        this.stream.classList.remove("is-rail-detent-impact");
      }, 210);
    }

    finishPendingTheme() {
      window.clearTimeout(this.themeSwapTimer);
      window.clearTimeout(this.transitionTimer);
      if (this.pendingThemeIndex !== null) {
        this.applyTheme(this.pendingThemeIndex, false);
        this.pendingThemeIndex = null;
      }
      this.stream.classList.remove(
        "is-screen-switching",
        "is-screen-settling",
        "is-screen-turn-next",
        "is-screen-turn-previous"
      );
      this.resetScreenTransform();
    }

    setTheme(index, animate = true, source = "discrete") {
      const nextIndex = normalizeIndex(index);
      if (
        nextIndex === this.themeIndex &&
        this.pendingThemeIndex === null
      ) {
        return;
      }

      this.finishPendingTheme();
      this.cancelRailAnimation();
      if (!animate || !this.active) {
        this.applyTheme(nextIndex);
        return;
      }

      const forward =
        normalizeIndex(nextIndex - this.themeIndex) <= THEMES.length / 2;
      this.pendingThemeIndex = nextIndex;
      this.animateRailTo(
        nextIndex / (THEMES.length - 1),
        forward ? 1 : -1,
        source === "wheel" ? 1.15 : 0.72,
        source === "wheel" ? 840 : 780
      );
      this.stream.classList.add(
        "is-screen-switching",
        forward ? "is-screen-turn-next" : "is-screen-turn-previous"
      );

      this.themeSwapTimer = window.setTimeout(() => {
        this.applyTheme(nextIndex, false);
        this.pendingThemeIndex = null;
      }, 360);

      this.transitionTimer = window.setTimeout(() => {
        this.stream.classList.remove(
          "is-screen-switching",
          "is-screen-turn-next",
          "is-screen-turn-previous"
        );
      }, 900);
    }

    applyTheme(index, syncPosition = true) {
      this.themeIndex = normalizeIndex(index);
      const theme = THEMES[this.themeIndex];
      this.stream.dataset.themeIndex = String(this.themeIndex);

      this.channels.forEach((channel, channelIndex) => {
        const selected = channelIndex === this.themeIndex;
        channel.classList.toggle("is-active", selected);
        channel.setAttribute("aria-hidden", String(!selected));
      });

      this.modules?.forEach((module, moduleIndex) => {
        const selected = moduleIndex === this.themeIndex;
        module.classList.toggle("is-active", selected);
        module.setAttribute("aria-current", selected ? "true" : "false");
      });

      this.railButtons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === this.themeIndex;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });

      if (this.rail) {
        this.rail.setAttribute("aria-valuenow", String(this.themeIndex + 1));
        this.rail.setAttribute(
          "aria-valuetext",
          `${theme.number}: ${theme.title}`
        );
      }
      this.modelView?.setTheme(this.themeIndex);
      if (syncPosition) {
        this.setRailProgress(this.themeIndex / (THEMES.length - 1));
      }
    }

    setOrbitPosition(position) {
      this.orbitPosition = position;
      this.stream.style.setProperty(
        "--archive-orbit-angle",
        `${(-position * 90).toFixed(3)}deg`
      );
      this.modelView?.setPosition(position);
    }

    attachModelView(modelView) {
      this.modelView = modelView;
      this.modelView.setPosition(this.orbitPosition);
      this.modelView.setTheme(this.themeIndex);
      this.modelView.setActive(this.active);
      this.modelView.setThermalEnabled(this.thermalEnabled);
    }

    setRailProgress(progress, syncOrbit = true) {
      const clamped = Math.min(1, Math.max(0, progress));
      this.railProgress = clamped;
      const displayPosition = 11 + clamped * 78;
      this.stream.style.setProperty(
        "--archive-rail-position",
        `${displayPosition.toFixed(3)}%`
      );
      if (syncOrbit) {
        this.setOrbitPosition(clamped * (THEMES.length - 1));
      }
    }

    cancelRailAnimation() {
      window.cancelAnimationFrame(this.railAnimationFrame);
      this.railAnimationFrame = 0;
      this.railAnimating = false;
      this.modelView?.setInteracting(false);
      this.stream.classList.remove(
        "is-rail-inertial",
        "is-rail-moving-next",
        "is-rail-moving-previous"
      );
    }

    animateRailTo(
      targetProgress,
      direction,
      velocity = 0,
      duration = 780,
      absoluteOrbitTarget = null
    ) {
      this.cancelRailAnimation();

      const target = Math.min(1, Math.max(0, targetProgress));
      let position = this.railProgress;
      const travel = target - position;
      const resolvedDirection =
        direction || (travel === 0 ? 1 : Math.sign(travel));
      const railDirection = travel === 0 ? 0 : Math.sign(travel);
      let springVelocity =
        railDirection * Math.min(0.55, Math.abs(velocity) * 0.18);
      const startTime = performance.now();
      let previousTime = startTime;
      const orbitStart = this.orbitPosition;
      const targetThemePosition = target * (THEMES.length - 1);
      let orbitTarget = Number.isFinite(absoluteOrbitTarget)
        ? absoluteOrbitTarget
        : targetThemePosition;
      if (!Number.isFinite(absoluteOrbitTarget)) {
        if (resolvedDirection > 0) {
          while (orbitTarget < orbitStart - 0.001) orbitTarget += THEMES.length;
        } else if (resolvedDirection < 0) {
          while (orbitTarget > orbitStart + 0.001) orbitTarget -= THEMES.length;
        }
      }
      const stiffness = 112;
      const damping = 17.5;
      const maximumDuration = Math.max(720, duration + 240);
      const orbitDuration = Math.min(680, Math.max(420, duration * 0.82));

      this.railAnimating = true;
      this.modelView?.setInteracting(true);
      this.stream.classList.add("is-rail-inertial");

      const animate = (time) => {
        const deltaTime = Math.min(0.032, (time - previousTime) / 1000);
        previousTime = time;

        const acceleration = (target - position) * stiffness;
        springVelocity += acceleration * deltaTime;
        springVelocity *= Math.exp(-damping * deltaTime);
        position += springVelocity * deltaTime;

        if (position < -0.018 || position > 1.018) {
          position = Math.min(1.018, Math.max(-0.018, position));
          springVelocity *= -0.16;
        }

        this.setRailProgress(position, false);
        const orbitTime = Math.min(1, (time - startTime) / orbitDuration);
        const travelProgress = orbitTime * orbitTime * (3 - 2 * orbitTime);
        const currentOrbitPosition =
          orbitStart + (orbitTarget - orbitStart) * travelProgress;
        this.setOrbitPosition(currentOrbitPosition);
        const railSettled =
          Math.abs(target - position) < 0.00035 &&
          Math.abs(springVelocity) < 0.0035;
        const orbitSettled =
          Math.abs(orbitTarget - currentOrbitPosition) < 0.0005;
        const settled = railSettled && orbitSettled;
        if (!settled && time - startTime < maximumDuration) {
          this.railAnimationFrame = window.requestAnimationFrame(animate);
          return;
        }

        this.setRailProgress(target, false);
        this.setOrbitPosition(targetThemePosition);
        this.railAnimating = false;
        this.modelView?.setInteracting(false);
        this.railAnimationFrame = 0;
        this.stream.classList.remove("is-rail-inertial");
      };

      this.railAnimationFrame = window.requestAnimationFrame(animate);
    }

    resetScreenTransform() {
      this.stream.style.setProperty("--archive-orbit-roll", "0deg");
      this.stream.style.setProperty("--archive-orbit-depth", "0px");
    }
  }

  window.ArchiveCardStream = ArchiveCardStream;
})();
