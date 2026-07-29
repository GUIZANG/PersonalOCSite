(function () {
  const THEMES = [
    {
      number: "01",
      title: "SIGNAL",
      kicker: "Memory residue / A",
      status: "Carrier acquired",
      metric: "93.7 KHZ",
      summary:
        "A transmission recovered before its sender existed. The carrier remains stable; the source does not.",
      fragments: ["ECHO / 0041", "PHASE / LOCKED", "SOURCE / UNBORN"],
      schema: "signal",
    },
    {
      number: "02",
      title: "VECTOR",
      kicker: "Predicted motion / B",
      status: "Trajectory unresolved",
      metric: "08.2 SEC",
      summary:
        "Movement is archived as intention rather than position. Every route terminates one frame too early.",
      fragments: ["PATH / NULL", "DRIFT / +08", "ARRIVAL / DENIED"],
      schema: "vector",
    },
    {
      number: "03",
      title: "ORACLE",
      kicker: "Future witness / C",
      status: "Observer contaminated",
      metric: "31.0 DB",
      summary:
        "The record changes when examined. Repeated observation produces a more accurate version of the error.",
      fragments: ["EYE / OPEN", "CRC / FAILED", "WITNESS / ACTIVE"],
      schema: "oracle",
    },
    {
      number: "04",
      title: "NOESIS",
      kicker: "Synthetic thought / D",
      status: "Cognition recursive",
      metric: "∞ / 007",
      summary:
        "A thought without an owner continues to index itself. Retrieval is indistinguishable from infection.",
      fragments: ["MIND / UNBOUND", "LOOP / 020", "OWNER / MISSING"],
      schema: "noesis",
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
      this.transitionTimer = 0;
      this.transitionEndTimer = 0;
      this.backgroundTimer = 0;
      this.wheelLockedUntil = 0;
      this.referenceBackground = null;

      this.build();
      this.bindEvents();
      this.applyTheme(0);
    }

    build() {
      const indexItems = THEMES.map(
        (theme, index) => `
          <button
            class="archive-index__item"
            type="button"
            data-theme-index="${index}"
            aria-label="Open archive ${theme.number}: ${theme.title}"
          >
            <span>${theme.number}</span>
            <strong>${theme.title}</strong>
            <i>${theme.kicker.split(" / ")[0]}</i>
            <b>${theme.metric}</b>
          </button>
        `
      ).join("");

      const visualSchemas = THEMES.map(
        (theme, index) => `
          <div
            class="archive-schema archive-schema--${theme.schema}"
            data-schema-index="${index}"
            aria-hidden="true"
          >
            ${this.schemaMarkup(theme.schema)}
          </div>
        `
      ).join("");

      this.stream.innerHTML = `
        <div class="archive-interface">
          <div class="archive-interface__frame" aria-hidden="true">
            <i></i><i></i><i></i><i></i>
          </div>

          <header class="archive-interface__header">
            <span>Archive / Four strata / 020</span>
            <i>Recovered interface</i>
            <b>01—04 / Select record</b>
          </header>

          <nav class="archive-index" aria-label="Archive themes">
            <div class="archive-index__label">
              <span>Index</span><b>04 records</b>
            </div>
            ${indexItems}
            <div class="archive-index__key">Keys 1—4 / Arrow keys</div>
          </nav>

          <main class="archive-output" aria-live="polite">
            <div class="archive-output__rule" aria-hidden="true"></div>
            <div class="archive-output__visual">${visualSchemas}</div>

            <article class="archive-record">
              <div class="archive-record__eyebrow">
                <span data-record-number></span>
                <i data-record-kicker></i>
              </div>
              <h1 data-record-title></h1>
              <p data-record-summary></p>
              <ul data-record-fragments></ul>
            </article>

            <aside class="archive-telemetry">
              <span>State</span>
              <strong data-record-status></strong>
              <i data-record-metric></i>
            </aside>

            <div class="archive-output__position" aria-hidden="true">
              <span>Near / 01</span>
              <i><b></b></i>
              <span>Deep / 04</span>
            </div>
          </main>

          <footer class="archive-interface__footer">
            <span>Selected / <b data-record-readout></b></span>
            <i>Click index / Wheel / Keyboard</i>
            <strong>Strata remains observable</strong>
          </footer>

          <div class="archive-interface__tear" aria-hidden="true"></div>
        </div>
      `;

      this.themeButtons = Array.from(
        this.stream.querySelectorAll("[data-theme-index]")
      );
      this.schemas = Array.from(
        this.stream.querySelectorAll("[data-schema-index]")
      );
    }

    schemaMarkup(schema) {
      if (schema === "signal") {
        return `
          <div class="schema-signal__axis"></div>
          <div class="schema-signal__bands">
            ${Array.from({ length: 11 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}
          </div>
          <span>Carrier / 93.7</span>
        `;
      }

      if (schema === "vector") {
        return `
          <div class="schema-vector__origin"></div>
          <div class="schema-vector__path">
            ${Array.from({ length: 7 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}
          </div>
          <span>Trajectory / unresolved</span>
        `;
      }

      if (schema === "oracle") {
        return `
          <div class="schema-oracle__eye">
            <i></i><i></i><i></i><b></b>
          </div>
          <div class="schema-oracle__scan"></div>
          <span>Witness / active</span>
        `;
      }

      return `
        <div class="schema-noesis__depth">
          ${Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}
        </div>
        <div class="schema-noesis__node"></div>
        <span>Recursion / 020</span>
      `;
    }

    bindEvents() {
      this.stream.addEventListener("click", (event) => {
        const button = event.target.closest("[data-theme-index]");
        if (!button) return;
        this.setTheme(Number(button.dataset.themeIndex), true);
      });

      this.stream.addEventListener("pointermove", (event) => {
        if (!this.active) return;
        const x = event.clientX / Math.max(window.innerWidth, 1);
        const y = event.clientY / Math.max(window.innerHeight, 1);
        this.stream.style.setProperty("--archive-pointer-x", x.toFixed(4));
        this.stream.style.setProperty("--archive-pointer-y", y.toFixed(4));
        this.stream.style.setProperty(
          "--archive-parallax-x",
          `${((x - 0.5) * 16).toFixed(2)}px`
        );
        this.stream.style.setProperty(
          "--archive-parallax-y",
          `${((y - 0.5) * 12).toFixed(2)}px`
        );
      });

      this.stream.addEventListener(
        "wheel",
        (event) => {
          if (!this.active || Math.abs(event.deltaY) < 5) return;
          event.preventDefault();
          const now = performance.now();
          if (now < this.wheelLockedUntil) return;
          this.wheelLockedUntil = now + 520;
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

      window.clearTimeout(this.backgroundTimer);
      this.backgroundTimer = window.setTimeout(() => {
        const background = this.ensureReferenceBackground();
        background?.setPalette?.(this.themeIndex);
        background?.activate();
      }, 760);

      window.requestAnimationFrame(() => {
        this.stream.classList.add("is-archive-interface-ready");
      });
    }

    ensureReferenceBackground() {
      if (this.referenceBackground || !window.ArchiveReferenceBackground) {
        return this.referenceBackground;
      }

      this.referenceBackground = new window.ArchiveReferenceBackground(
        document.getElementById("hypercube-stage") || document.body
      );
      return this.referenceBackground;
    }

    setTheme(index, animate = true) {
      const nextIndex = normalizeIndex(index);
      if (nextIndex === this.themeIndex) return;

      window.clearTimeout(this.transitionTimer);
      window.clearTimeout(this.transitionEndTimer);

      if (!animate || !this.active) {
        this.applyTheme(nextIndex);
        return;
      }

      this.stream.classList.remove(
        "is-record-leaving",
        "is-record-entering",
        "is-record-tearing"
      );
      void this.stream.offsetWidth;
      this.stream.classList.add("is-record-leaving", "is-record-tearing");

      this.transitionTimer = window.setTimeout(() => {
        this.applyTheme(nextIndex);
        this.stream.classList.remove("is-record-leaving");
        this.stream.classList.add("is-record-entering");

        this.transitionEndTimer = window.setTimeout(() => {
          this.stream.classList.remove("is-record-entering", "is-record-tearing");
        }, 430);
      }, 135);
    }

    applyTheme(index) {
      this.themeIndex = normalizeIndex(index);
      const theme = THEMES[this.themeIndex];
      this.stream.dataset.themeIndex = String(this.themeIndex);
      this.stream.style.setProperty(
        "--archive-theme-progress",
        `${(this.themeIndex / (THEMES.length - 1)) * 100}%`
      );

      this.stream.querySelector("[data-record-number]").textContent =
        `${theme.number} / 04`;
      this.stream.querySelector("[data-record-kicker]").textContent = theme.kicker;
      this.stream.querySelector("[data-record-title]").textContent = theme.title;
      this.stream.querySelector("[data-record-summary]").textContent = theme.summary;
      this.stream.querySelector("[data-record-status]").textContent = theme.status;
      this.stream.querySelector("[data-record-metric]").textContent = theme.metric;
      this.stream.querySelector("[data-record-readout]").textContent =
        `${theme.number} / ${theme.title}`;
      this.stream.querySelector("[data-record-fragments]").innerHTML =
        theme.fragments.map((fragment) => `<li>${fragment}</li>`).join("");

      this.themeButtons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === this.themeIndex;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.setAttribute("tabindex", selected ? "0" : "-1");
      });

      this.schemas.forEach((schema, schemaIndex) => {
        schema.classList.toggle("is-active", schemaIndex === this.themeIndex);
      });

      this.referenceBackground?.setPalette?.(this.themeIndex, {
        glitch: this.active,
      });
    }
  }

  window.ArchiveCardStream = ArchiveCardStream;
})();
