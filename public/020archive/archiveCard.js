(function () {
  const THEMES = [
    { number: "01", roman: "I", title: "SIGNAL" },
    { number: "02", roman: "II", title: "VECTOR" },
    { number: "03", roman: "III", title: "ORACLE" },
    { number: "04", roman: "IV", title: "NOESIS" },
  ];

  const normalizeIndex = (index) =>
    (index + THEMES.length) % THEMES.length;

  class ArchiveCardStream {
    constructor() {
      this.stream = document.getElementById("archiveCardStream");
      if (!this.stream) return;

      this.active = false;
      this.themeIndex = 0;
      this.transitionTimer = 0;
      this.wheelLockedUntil = 0;
      this.pointerId = null;
      this.pointerStartX = null;
      this.dragOffset = 0;
      this.suppressClick = false;

      this.build();
      this.bindEvents();
      this.applyTheme(0);
    }

    build() {
      const slides = THEMES.map(
        (theme, index) => `
          <button
            class="archive-carousel__slide"
            type="button"
            data-theme-index="${index}"
            aria-label="Open archive ${theme.number}: ${theme.title}"
          >
            <article class="archive-carousel__card">
              <h1>${theme.title}</h1>
            </article>
          </button>
        `
      ).join("");

      const railButtons = THEMES.map(
        (theme, index) => `
          <button
            class="archive-carousel__rail-button"
            type="button"
            data-theme-index="${index}"
            aria-label="Select ${theme.number}: ${theme.title}"
          >
            <span>${theme.number}</span>
          </button>
        `
      ).join("");

      this.stream.innerHTML = `
        <div class="archive-interface">
          <div class="archive-carousel__viewport" aria-label="Archive cards">
            <div class="archive-carousel__track">
              ${slides}
            </div>
          </div>

          <nav class="archive-carousel__rail" aria-label="Archive card position">
            <div class="archive-carousel__ticks" aria-hidden="true"></div>
            <div class="archive-carousel__rail-buttons">
              ${railButtons}
            </div>
            <div class="archive-carousel__capture" aria-hidden="true">
              <i data-record-roman></i>
            </div>
          </nav>
        </div>
      `;

      this.slides = Array.from(
        this.stream.querySelectorAll(".archive-carousel__slide")
      );
      this.railButtons = Array.from(
        this.stream.querySelectorAll(".archive-carousel__rail-button")
      );
      this.viewport = this.stream.querySelector(".archive-carousel__viewport");
    }

    bindEvents() {
      this.stream.addEventListener("click", (event) => {
        if (this.suppressClick) {
          this.suppressClick = false;
          event.preventDefault();
          return;
        }

        const button = event.target.closest("[data-theme-index]");
        if (!button) return;
        this.setTheme(Number(button.dataset.themeIndex), true);
      });

      this.viewport?.addEventListener("pointerdown", (event) => {
        if (!this.active || event.button !== 0) return;
        window.clearTimeout(this.transitionTimer);
        this.pointerId = event.pointerId;
        this.pointerStartX = event.clientX;
        this.dragOffset = 0;
        this.suppressClick = false;
        this.viewport.setPointerCapture?.(event.pointerId);
        this.stream.classList.remove(
          "is-carousel-switching",
          "is-carousel-settling"
        );
        this.stream.classList.add("is-carousel-dragging");
      });

      this.viewport?.addEventListener("pointermove", (event) => {
        if (
          this.pointerId !== event.pointerId ||
          this.pointerStartX === null
        ) {
          return;
        }

        const limit = Math.max(this.viewport.clientWidth * 0.42, 120);
        this.dragOffset = Math.max(
          -limit,
          Math.min(limit, event.clientX - this.pointerStartX)
        );
        this.suppressClick = Math.abs(this.dragOffset) > 6;
        this.stream.style.setProperty(
          "--archive-drag-x",
          `${this.dragOffset.toFixed(2)}px`
        );
      });

      this.viewport?.addEventListener("pointerup", (event) => {
        if (
          this.pointerId !== event.pointerId ||
          this.pointerStartX === null
        ) {
          return;
        }

        this.viewport.releasePointerCapture?.(event.pointerId);
        const threshold = Math.min(
          96,
          Math.max(54, this.viewport.clientWidth * 0.09)
        );
        const nextIndex =
          Math.abs(this.dragOffset) >= threshold
            ? this.themeIndex + (this.dragOffset < 0 ? 1 : -1)
            : this.themeIndex;

        this.pointerId = null;
        this.pointerStartX = null;
        this.finishDrag(nextIndex);
      });

      this.viewport?.addEventListener("pointercancel", () => {
        this.pointerId = null;
        this.pointerStartX = null;
        this.finishDrag(this.themeIndex);
      });

      this.stream.addEventListener(
        "wheel",
        (event) => {
          if (!this.active || Math.abs(event.deltaY) < 5) return;
          event.preventDefault();
          const now = performance.now();
          if (now < this.wheelLockedUntil) return;
          this.wheelLockedUntil = now + 650;
          this.setTheme(this.themeIndex + (event.deltaY > 0 ? 1 : -1), true);
        },
        { passive: false }
      );

      window.addEventListener("keydown", (event) => {
        if (
          !this.active ||
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
      this.stream.classList.add("is-archive-interface-active");
      window.requestAnimationFrame(() => {
        this.stream.classList.add("is-archive-interface-ready");
      });
    }

    finishDrag(index) {
      const nextIndex = normalizeIndex(index);
      const changed = nextIndex !== this.themeIndex;

      this.stream.classList.remove("is-carousel-dragging");
      this.stream.classList.add("is-carousel-settling");
      if (changed) {
        this.stream.dataset.carouselDirection =
          this.dragOffset < 0 ? "next" : "previous";
        this.stream.classList.add("is-carousel-switching");
        this.applyTheme(nextIndex);
      }

      this.dragOffset = 0;
      this.stream.style.setProperty("--archive-drag-x", "0px");
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = window.setTimeout(() => {
        this.stream.classList.remove(
          "is-carousel-settling",
          "is-carousel-switching"
        );
      }, changed ? 760 : 560);
    }

    getRelativeSlot(slideIndex, activeIndex) {
      let delta = slideIndex - activeIndex;
      if (delta > 2) delta -= THEMES.length;
      if (delta < -1) delta += THEMES.length;
      return delta;
    }

    setTheme(index, animate = true) {
      const nextIndex = normalizeIndex(index);
      if (nextIndex === this.themeIndex) return;

      window.clearTimeout(this.transitionTimer);
      const forward =
        normalizeIndex(nextIndex - this.themeIndex) <= THEMES.length / 2;
      this.stream.dataset.carouselDirection = forward ? "next" : "previous";
      this.stream.classList.remove(
        "is-carousel-dragging",
        "is-carousel-settling",
        "is-carousel-switching"
      );

      if (animate && this.active) {
        void this.stream.offsetWidth;
        this.stream.classList.add(
          "is-carousel-settling",
          "is-carousel-switching"
        );
      }

      this.stream.style.setProperty("--archive-drag-x", "0px");
      this.applyTheme(nextIndex);

      if (animate && this.active) {
        this.transitionTimer = window.setTimeout(() => {
          this.stream.classList.remove(
            "is-carousel-settling",
            "is-carousel-switching"
          );
        }, 760);
      }
    }

    applyTheme(index) {
      this.themeIndex = normalizeIndex(index);
      const theme = THEMES[this.themeIndex];
      this.stream.dataset.themeIndex = String(this.themeIndex);

      this.stream.querySelector("[data-record-roman]").textContent =
        theme.roman;

      this.slides.forEach((slide, slideIndex) => {
        const selected = slideIndex === this.themeIndex;
        const slot = this.getRelativeSlot(slideIndex, this.themeIndex);
        slide.style.setProperty("--archive-carousel-slot", String(slot));
        slide.classList.toggle("is-active", selected);
        slide.classList.toggle("is-previous", slot === -1);
        slide.classList.toggle("is-next", slot === 1);
        slide.classList.toggle("is-far", Math.abs(slot) > 1);
        slide.setAttribute("aria-pressed", String(selected));
        slide.setAttribute("tabindex", selected ? "0" : "-1");
      });

      this.railButtons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === this.themeIndex;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }
  }

  window.ArchiveCardStream = ArchiveCardStream;
})();
