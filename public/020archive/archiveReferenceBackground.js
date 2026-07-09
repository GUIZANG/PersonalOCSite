(function () {
  // Drifting rectangle field rendered behind a selected card. Independent
  // implementation: a flat "mote" pool advanced by per-band parallax factors,
  // with an enter/exit reveal driven from CSS and a ragged edge mask so the
  // field dissolves toward the screen sides.
  const PALETTES = [
    {
      backdrop: "#010709",
      ink: ["#01090b", "#031519", "#06252b", "#08363d"],
      ash: ["#13515b", "#1f7d87", "#35a9ad", "#84ddd8"],
    },
    {
      backdrop: "#070102",
      ink: ["#090102", "#120304", "#1d0506", "#2a0809"],
      ash: ["#5a1718", "#7d2423", "#a63a35", "#d06a5a"],
    },
    {
      backdrop: "#090000",
      ink: ["#120101", "#240202", "#3b0303", "#540606"],
      ash: ["#7c1010", "#aa1616", "#e32222", "#ff5a48"],
    },
    {
      backdrop: "#030303",
      ink: ["#050505", "#101010", "#1b1b1b", "#252525"],
      ash: ["#8a8a8a", "#b6b6b6", "#d8d8d8", "#ffffff"],
    },
  ];

  // Each band describes one parallax plane: how fast it slides, how many motes
  // it carries, its palette, and the min/max span/thickness of each mote.
  const BANDS = [
    { factor: 1.0, motes: 4000, palette: "ink", span: [50, 100], thick: [10, 20] },
    { factor: 1.2, motes: 2000, palette: "ink", span: [20, 100], thick: [10, 20] },
    { factor: 1.4, motes: 300, palette: "ash", span: [5, 100], thick: [5, 20] },
    { factor: 1.5, motes: 1000, palette: "ash", span: [1, 5], thick: [1, 5] },
    { factor: 1.6, motes: 200, palette: "ash", span: [5, 100], thick: [5, 20] },
    { factor: 1.8, motes: 100, palette: "ash", span: [5, 100], thick: [1, 20] },
    { factor: 1.9, motes: 1000, palette: "ink", span: [1, 1], thick: [1, 1] },
  ];

  const BASE_SLIDE = 2;

  const intBetween = (lo, hi) => Math.floor(Math.random() * (hi - lo) + lo);
  const oneOf = (list) => list[(Math.random() * list.length) | 0];
  const wrap01 = (v) => v - Math.floor(v);
  const jitter = (seed) => wrap01(Math.sin(seed * 12.9898) * 43758.5453);

  class ArchiveReferenceBackground {
    constructor(container = document.body) {
      this.container = container;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "archive-reference-background";
      this.context = this.canvas.getContext("2d");
      this.motes = [];
      this.slide = BASE_SLIDE;
      this.animationFrame = null;
      this.isRunning = false;
      this.isEntering = false;
      this.isExiting = false;
      this.enterTimer = null;
      this.pendingAction = null;
      this.exitTimer = null;
      this.paletteIndex = 0;
      this.palette = PALETTES[this.paletteIndex];
      this.glitchUntil = 0;
      this.glitchSwitchTimer = null;
      this.enterStartTime = 0;
      this.exitStartTime = 0;
      this.enterEdgeDuration = 820;
      this.exitDuration = 1400;
      this.edgeWidth = 0;
      this.drawWidth = window.innerWidth;

      this.onResize = this.onResize.bind(this);
      this.update = this.update.bind(this);

      this.container.insertBefore(this.canvas, this.container.firstChild);
      window.addEventListener("resize", this.onResize);
      this.onResize();
      this.seedField();
      this.update();
    }

    setPalette(index, options = {}) {
      const nextIndex = ((index % PALETTES.length) + PALETTES.length) % PALETTES.length;
      if (nextIndex === this.paletteIndex && !options.glitch) return;

      if (!options.glitch) {
        this.applyPalette(nextIndex);
        return;
      }

      this.triggerPaletteGlitch(() => {
        this.applyPalette(nextIndex);
      });
    }

    triggerPaletteGlitch(onSwitch) {
      this.glitchUntil = performance.now() + 360;
      if (this.glitchSwitchTimer) {
        window.clearTimeout(this.glitchSwitchTimer);
      }

      this.glitchSwitchTimer = window.setTimeout(() => {
        this.glitchSwitchTimer = null;
        onSwitch();
      }, 130);
    }

    applyPalette(index) {
      this.paletteIndex = index;
      this.palette = PALETTES[index];
      this.motes.forEach((mote) => {
        mote.color = this.pickPaletteColor(mote.paletteName, mote.colorSeed);
      });
    }

    pickPaletteColor(name, seed = Math.random()) {
      const colors = this.palette[name] || this.palette.ink;
      const index = Math.floor(seed * colors.length) % colors.length;
      return colors[index];
    }

    activate() {
      if (this.isEntering || this.isExiting) {
        this.pendingAction = "activate";
        return;
      }

      this.isRunning = true;
      this.exitStartTime = 0;
      if (this.exitTimer) {
        window.clearTimeout(this.exitTimer);
        this.exitTimer = null;
      }
      if (this.enterTimer) {
        window.clearTimeout(this.enterTimer);
        this.enterTimer = null;
      }

      this.resetToRight();
      this.isEntering = true;
      this.pendingAction = null;
      window.requestAnimationFrame(() => {
        this.enterStartTime = performance.now();
        this.canvas.classList.add("is-active");
        this.enterTimer = window.setTimeout(() => {
          this.completeEnter();
        }, this.getEnterDuration() + 50);
      });
    }

    deactivate() {
      if (this.isEntering || this.isExiting) {
        this.pendingAction = "deactivate";
        return;
      }

      this.isRunning = false;
      this.isExiting = true;
      this.enterStartTime = 0;
      this.exitStartTime = performance.now();
      const exitDuration = this.getExitDuration();
      this.canvas.style.setProperty("--archive-reference-exit-ms", `${exitDuration}ms`);
      this.canvas.classList.remove("is-active");
      this.canvas.classList.add("is-exiting");

      if (this.exitTimer) {
        window.clearTimeout(this.exitTimer);
      }
      this.exitTimer = window.setTimeout(() => {
        this.completeExit();
      }, exitDuration + 100);
    }

    resetToRight() {
      this.canvas.classList.remove("is-active", "is-exiting");
      this.canvas.style.transition = "none";
      this.canvas.style.opacity = "0";
      this.canvas.style.transform = "translate3d(100%, 0, 0)";
      this.canvas.offsetWidth;
      this.canvas.style.transition = "";
      this.canvas.style.opacity = "";
      this.canvas.style.transform = "";
      this.isEntering = false;
      this.isExiting = false;
      this.pendingAction = null;
      this.enterStartTime = 0;
      this.exitStartTime = 0;
    }

    completeEnter() {
      this.isEntering = false;
      this.enterTimer = null;
      this.enterStartTime = 0;

      const action = this.pendingAction;
      this.pendingAction = null;

      if (action === "deactivate") {
        this.deactivate();
      }
    }

    completeExit() {
      const action = this.pendingAction;
      this.pendingAction = null;
      this.exitTimer = null;
      this.canvas.classList.remove("is-exiting");
      this.resetToRight();

      if (action === "activate") {
        this.activate();
      }
    }

    getEnterDuration() {
      return this.enterEdgeDuration;
    }

    getExitDuration() {
      return this.exitDuration;
    }

    onResize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.edgeWidth = this.getEdgeWidth();
      this.drawWidth = window.innerWidth + this.edgeWidth * 2;
      this.canvas.width = Math.ceil(this.drawWidth * ratio);
      this.canvas.height = Math.ceil(window.innerHeight * ratio);
      this.canvas.style.left = `${-this.edgeWidth}px`;
      this.canvas.style.right = "auto";
      this.canvas.style.width = `${this.drawWidth}px`;
      this.canvas.style.height = `${window.innerHeight}px`;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    getEdgeWidth() {
      return Math.min(window.innerWidth * 0.17, 210);
    }

    // Build the flat mote pool up front. Motes are tagged with their band factor
    // so a single pass can advance the whole field.
    seedField() {
      const span = this.drawWidth || window.innerWidth;
      const tall = window.innerHeight;
      const pool = [];

      for (const band of BANDS) {
        for (let i = 0; i < band.motes; i++) {
          const colorSeed = Math.random();
          pool.push({
            factor: band.factor,
            x: intBetween(0, span * 2),
            y: intBetween(0, tall),
            w: intBetween(band.span[0], band.span[1]),
            h: intBetween(band.thick[0], band.thick[1]),
            paletteName: band.palette,
            colorSeed,
            color: this.pickPaletteColor(band.palette, colorSeed),
            seed: Math.random(),
          });
        }
      }

      this.motes = pool;
    }

    // Respawn a mote just off the right edge once it has slid past the left.
    recycle(mote) {
      const span = this.drawWidth || window.innerWidth;
      mote.x = intBetween(span, span * 2);
      mote.y = intBetween(0, window.innerHeight);
    }

    update() {
      const width = this.drawWidth;
      const height = window.innerHeight;
      const ctx = this.context;

      ctx.clearRect(0, 0, width, height);
      const live = this.isRunning || this.canvas.classList.contains("is-exiting");

      if (live) {
        const glitchAmount = this.getGlitchAmount();
        ctx.fillStyle = this.palette.backdrop;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < this.motes.length; i++) {
          const mote = this.motes[i];
          mote.x -= this.slide * mote.factor;
          if (mote.x + mote.w < 0) {
            this.recycle(mote);
          }

          const alpha = this.getParticleAlpha(mote);
          if (alpha <= 0) continue;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = mote.color;
          const glitchOffset = glitchAmount > 0
            ? (jitter(Math.floor(mote.y / 13) * 19.7 + mote.seed * 113.0 + Math.floor(performance.now() / 34)) - 0.5) * 90 * glitchAmount
            : 0;
          ctx.fillRect(mote.x + glitchOffset, mote.y, mote.w, mote.h);
        }
        if (glitchAmount > 0) {
          this.drawGlitchOverlay(ctx, width, height, glitchAmount);
        }
        ctx.globalAlpha = 1;
      }

      this.animationFrame = window.requestAnimationFrame(this.update);
    }

    getParticleAlpha(mote) {
      return this.getSpatialDensity(mote);
    }

    getGlitchAmount() {
      if (!this.glitchUntil) return 0;
      const remaining = this.glitchUntil - performance.now();
      if (remaining <= 0) {
        this.glitchUntil = 0;
        return 0;
      }

      return Math.min(Math.max(remaining / 360, 0), 1);
    }

    drawGlitchOverlay(ctx, width, height, amount) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 18; i++) {
        const seed = i * 37.1 + Math.floor(performance.now() / 28);
        const y = jitter(seed) * height;
        const h = 1 + jitter(seed + 9.3) * 5;
        const x = (jitter(seed + 4.7) - 0.5) * width * 0.12 * amount;
        ctx.globalAlpha = (0.08 + jitter(seed + 2.1) * 0.16) * amount;
        ctx.fillStyle = i % 2 === 0 ? "#ff2a2a" : "#3ffff0";
        ctx.fillRect(x, y, width, h);
      }
      ctx.restore();
    }

    getSpatialDensity(mote) {
      const width = this.drawWidth;
      const edgeWidth = this.edgeWidth || this.getEdgeWidth();
      const leftDistance = mote.x;
      const rightDistance = width - (mote.x + mote.w);
      const edgeDistance = Math.min(leftDistance, rightDistance);
      if (edgeDistance > edgeWidth) return 1;
      if (edgeDistance < 0) return 0;

      return this.getEdgeVisibility(mote, edgeDistance, edgeWidth);
    }

    getEdgeVisibility(mote, edgeDistance, edgeWidth) {
      const amount = 1 - Math.min(Math.max(edgeDistance / edgeWidth, 0), 1);
      const row = Math.floor(mote.y / 18);
      const cell = Math.floor(mote.x / 22);
      const ragged = jitter(row * 31.7 + cell * 13.9 + mote.seed * 19.3);
      const edge = amount + (ragged - 0.5) * 0.42;
      const threshold = 0.62;

      return edge < threshold ? 1 : 0;
    }
  }

  window.ArchiveReferenceBackground = ArchiveReferenceBackground;
})();
