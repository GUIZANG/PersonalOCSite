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
    (index + THEMES.length) % THEMES.length;

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
      this.dragPosition = 0;
      this.dragRawPosition = 0;
      this.lastDragClientX = 0;
      this.lastDragTime = 0;
      this.dragVelocity = 0;
      this.suppressClick = false;
      this.wheelLockedUntil = 0;
      this.railProgress = 0;
      this.railAnimating = false;
      this.railAnimationFrame = 0;
      this.themeSwapTimer = 0;
      this.transitionTimer = 0;
      this.entranceTimer = 0;
      this.detentTimer = 0;

      this.build();
      this.bindEvents();
      this.applyTheme(0);
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

    build() {
      const channels = THEMES.map((theme, index) =>
        this.buildChannel(theme, index)
      ).join("");

      const railButtons = THEMES.map(
        (theme, index) => `
          <button
            class="archive-carousel__rail-button"
            type="button"
            data-theme-index="${index}"
            aria-label="Select ${theme.number}: ${theme.title}"
          >
            <span>
              <i>${theme.number}</i>
              <b>${theme.title}</b>
            </span>
          </button>
        `
      ).join("");
      const railTicks = Array.from({ length: 25 }, (_, index) => {
        const isDetent = index % 8 === 0;
        const position = ((index / 24) * 100).toFixed(4);
        return `<i${isDetent ? ' class="is-detent"' : ""} style="--tick-position: ${position}%"></i>`;
      }).join("");

      this.stream.innerHTML = `
        <div class="archive-interface">
          <div class="archive-screen-stage" aria-label="Rotating archive screen">
            <div class="archive-screen__horizon" aria-hidden="true"></div>

            <div class="archive-screen-rig">
              <div class="archive-screen__umbra" aria-hidden="true"></div>

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
                    <span>GB / 020</span>
                    <i></i><i></i><i></i><i></i>
                    <b>REC</b>
                  </div>

                  <div class="archive-screen__glass">
                    ${channels}
                    <div class="archive-screen__scanlines" aria-hidden="true"></div>
                    <div class="archive-screen__flare" aria-hidden="true"></div>
                  </div>
                </div>
              </div>

              <div class="archive-screen__cable archive-screen__cable--a" aria-hidden="true"></div>
              <div class="archive-screen__cable archive-screen__cable--b" aria-hidden="true"></div>
            </div>

            <div class="archive-screen__datum" aria-hidden="true">
              <span>ROTATION DATUM</span>
              <b></b>
              <span id="archiveScreenReadout">01 / 04</span>
            </div>
          </div>

          <nav
            class="archive-carousel__rail"
            role="slider"
            tabindex="0"
            aria-label="Archive screen navigation"
            aria-valuemin="1"
            aria-valuemax="${THEMES.length}"
            aria-valuenow="1"
            aria-valuetext="${THEMES[0].number}: ${THEMES[0].title}"
          >
            <div class="archive-carousel__ticks" aria-hidden="true">
              ${railTicks}
            </div>
            <div class="archive-carousel__rail-buttons">
              ${railButtons}
            </div>
            <div class="archive-carousel__capture" aria-hidden="true">
              <i class="archive-carousel__capture-bracket archive-carousel__capture-bracket--left"></i>
              <b class="archive-carousel__capture-body">
                <span></span><span></span><span></span>
              </b>
              <i class="archive-carousel__capture-bracket archive-carousel__capture-bracket--right"></i>
            </div>
          </nav>
        </div>
      `;

      this.channels = Array.from(
        this.stream.querySelectorAll(".archive-screen__channel")
      );
      this.railButtons = Array.from(
        this.stream.querySelectorAll(".archive-carousel__rail-button")
      );
      this.rail = this.stream.querySelector(".archive-carousel__rail");
      this.screenReadout = this.stream.querySelector("#archiveScreenReadout");
    }

    bindEvents() {
      this.stream.addEventListener("click", (event) => {
        if (event.detail !== 0 || this.suppressClick) {
          event.preventDefault();
          this.suppressClick = false;
          return;
        }

        const button = event.target.closest("[data-theme-index]");
        if (!button) return;
        this.setTheme(Number(button.dataset.themeIndex), true);
      });

      this.rail?.addEventListener("pointerdown", (event) => {
        if (!this.active || event.button !== 0) return;

        this.finishPendingTheme();
        this.cancelRailAnimation();
        this.pointerId = event.pointerId;
        this.pointerStartX = event.clientX;
        this.dragStarted = false;
        this.dragStartThemeIndex = this.themeIndex;
        this.dragPosition = this.themeIndex;
        this.dragRawPosition = this.themeIndex;
        this.lastDragClientX = event.clientX;
        this.lastDragTime = performance.now();
        this.dragVelocity = 0;
        this.suppressClick = false;
        this.rail.setPointerCapture?.(event.pointerId);
      });

      this.rail?.addEventListener("pointermove", (event) => {
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

        this.updateRailDrag(event.clientX);
      });

      this.rail?.addEventListener("pointerup", (event) => {
        if (this.pointerId !== event.pointerId) return;
        this.finishPointerInteraction(false);
      });

      this.rail?.addEventListener("pointercancel", (event) => {
        if (this.pointerId !== event.pointerId) return;
        this.finishPointerInteraction(true);
      });

      this.rail?.addEventListener("lostpointercapture", (event) => {
        if (this.pointerId !== event.pointerId) return;
        this.finishPointerInteraction(false, false);
      });

      this.rail?.addEventListener("pointerleave", (event) => {
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

    updateRailDrag(clientX) {
      if (!this.rail) return;
      const rect = this.rail.getBoundingClientRect();
      if (!rect.width) return;

      const trackStart = rect.left + rect.width * 0.11;
      const trackWidth = rect.width * 0.78;
      const rawProgress = Math.min(
        1,
        Math.max(0, (clientX - trackStart) / trackWidth)
      );
      const rawPosition = rawProgress * (THEMES.length - 1);
      const now = performance.now();
      const elapsed = Math.max(8, now - this.lastDragTime);
      const instantaneousVelocity =
        (clientX - this.lastDragClientX) / elapsed;

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
      const nextIndex = Math.round(rawPosition);
      const previousPosition = this.dragPosition;

      this.dragPosition = position;
      this.dragRawPosition = rawPosition;
      this.lastDragClientX = clientX;
      this.lastDragTime = now;
      this.stream.dataset.screenDirection =
        position >= previousPosition ? "next" : "previous";

      if (nextIndex !== this.themeIndex) {
        this.applyTheme(nextIndex);
        this.pulseRailDetent();
      }

      const localOffset = position - this.themeIndex;
      const turn = localOffset * -178;
      const roll = Math.max(
        -2.8,
        Math.min(2.8, this.dragVelocity * -1.75)
      );
      const depth = Math.min(120, Math.abs(localOffset) * 130);

      this.stream.style.setProperty(
        "--archive-screen-turn",
        `${turn.toFixed(2)}deg`
      );
      this.stream.style.setProperty(
        "--archive-screen-roll",
        `${roll.toFixed(2)}deg`
      );
      this.stream.style.setProperty(
        "--archive-screen-depth",
        `${depth.toFixed(2)}px`
      );
      this.setRailProgress(progress);
    }

    finishPointerInteraction(cancelled = false, releaseCapture = true) {
      if (this.pointerId === null) return;

      const pointerId = this.pointerId;
      const didDrag = this.dragStarted;
      this.pointerId = null;
      this.pointerStartX = null;
      this.dragStarted = false;

      if (releaseCapture) {
        try {
          if (this.rail?.hasPointerCapture?.(pointerId)) {
            this.rail.releasePointerCapture(pointerId);
          }
        } catch (_error) {
          // The browser may have already released capture on blur/leave.
        }
      }

      if (!didDrag) {
        this.snapRailToNearestDetent();
        return;
      }

      if (cancelled) {
        this.applyTheme(this.dragStartThemeIndex);
      } else {
        const snapIndex = Math.min(
          THEMES.length - 1,
          Math.max(0, Math.round(this.dragRawPosition))
        );
        if (snapIndex !== this.themeIndex) {
          this.applyTheme(snapIndex);
        }
      }
      this.finishRailDrag();
    }

    finishRailDrag() {
      const changed = this.themeIndex !== this.dragStartThemeIndex;
      this.stream.classList.remove(
        "is-screen-dragging",
        "is-carousel-rail-dragging"
      );
      this.stream.classList.add("is-screen-settling");
      if (changed) this.stream.classList.add("is-screen-switching");

      this.resetScreenTransform();
      this.animateRailTo(
        this.themeIndex / (THEMES.length - 1),
        this.stream.dataset.screenDirection === "previous" ? -1 : 1,
        this.dragVelocity,
        760
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
        this.applyTheme(snapIndex);
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
        this.applyTheme(this.pendingThemeIndex);
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
        this.applyTheme(nextIndex);
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

    applyTheme(index) {
      this.themeIndex = normalizeIndex(index);
      const theme = THEMES[this.themeIndex];
      this.stream.dataset.themeIndex = String(this.themeIndex);

      this.channels.forEach((channel, channelIndex) => {
        const selected = channelIndex === this.themeIndex;
        channel.classList.toggle("is-active", selected);
        channel.setAttribute("aria-hidden", String(!selected));
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
      if (this.screenReadout) {
        this.screenReadout.textContent = `${theme.number} / 04`;
      }
      if (this.pointerId === null && !this.railAnimating) {
        this.setRailProgress(this.themeIndex / (THEMES.length - 1));
      }
    }

    setRailProgress(progress) {
      const clamped = Math.min(1, Math.max(0, progress));
      this.railProgress = clamped;
      const displayPosition = 11 + clamped * 78;
      this.stream.style.setProperty(
        "--archive-rail-position",
        `${displayPosition.toFixed(3)}%`
      );
    }

    cancelRailAnimation() {
      window.cancelAnimationFrame(this.railAnimationFrame);
      this.railAnimationFrame = 0;
      this.railAnimating = false;
      this.stream.classList.remove(
        "is-rail-inertial",
        "is-rail-moving-next",
        "is-rail-moving-previous"
      );
    }

    animateRailTo(targetProgress, direction, velocity = 0, duration = 780) {
      this.cancelRailAnimation();

      const target = Math.min(1, Math.max(0, targetProgress));
      let position = this.railProgress;
      const travel = target - position;
      const resolvedDirection =
        direction || (travel === 0 ? 1 : Math.sign(travel));
      let springVelocity =
        resolvedDirection *
        Math.min(1.7, 0.34 + Math.abs(velocity) * 0.38);
      const startTime = performance.now();
      let previousTime = startTime;
      const stiffness = 112;
      const damping = 17.5;
      const maximumDuration = Math.max(720, duration + 240);

      this.railAnimating = true;
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

        this.setRailProgress(position);
        const settled =
          Math.abs(target - position) < 0.00035 &&
          Math.abs(springVelocity) < 0.0035;
        if (!settled && time - startTime < maximumDuration) {
          this.railAnimationFrame = window.requestAnimationFrame(animate);
          return;
        }

        this.setRailProgress(target);
        this.railAnimating = false;
        this.railAnimationFrame = 0;
        this.stream.classList.remove("is-rail-inertial");
      };

      this.railAnimationFrame = window.requestAnimationFrame(animate);
    }

    resetScreenTransform() {
      this.stream.style.setProperty("--archive-screen-turn", "0deg");
      this.stream.style.setProperty("--archive-screen-roll", "0deg");
      this.stream.style.setProperty("--archive-screen-depth", "0px");
    }
  }

  window.ArchiveCardStream = ArchiveCardStream;
})();
