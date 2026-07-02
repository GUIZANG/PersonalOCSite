(function () {
  class MainReferenceBackground {
    constructor(container = document.body) {
      this.container = container;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "main-reference-background";
      this.context = this.canvas.getContext("2d");
      this.layers = [];
      this.speed = 2;
      this.animationFrame = null;
      this.isRunning = false;
      this.isEntering = false;
      this.isExiting = false;
      this.enterTimer = null;
      this.pendingAction = null;
      this.exitTimer = null;
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
      this.createLayers();
      this.update();
    }

    activate() {
      if (this.isEntering) {
        this.pendingAction = "activate";
        return;
      }
      if (this.isExiting) {
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
      if (this.isEntering) {
        this.pendingAction = "deactivate";
        return;
      }
      if (this.isExiting) {
        this.pendingAction = "deactivate";
        return;
      }

      this.isRunning = false;
      this.isExiting = true;
      this.enterStartTime = 0;
      this.exitStartTime = performance.now();
      const exitDuration = this.getExitDuration();
      this.canvas.style.setProperty("--main-reference-exit-ms", `${exitDuration}ms`);
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

    createLayers() {
      const white = ["#ffffff", "#d7d7d7", "#a8a8a8"];
      const black = ["#050505", "#101010", "#1b1b1b"];
      const configs = [
        [1, 4000, black, [50, 100], [10, 20]],
        [1.2, 2000, black, [20, 100], [10, 20]],
        [1.4, 300, white, [5, 100], [5, 20]],
        [1.5, 1000, white, [1, 5], [1, 5]],
        [1.6, 200, white, [5, 100], [5, 20]],
        [1.8, 100, white, [5, 100], [1, 20]],
        [1.9, 1000, black, [1, 1], [1, 1]],
      ];

      this.layers = configs.map((config) => new ParallaxLayer(this, ...config));
    }

    update() {
      const width = this.drawWidth;
      const height = window.innerHeight;

      this.context.clearRect(0, 0, width, height);
      const isExiting = this.canvas.classList.contains("is-exiting");
      if (this.isRunning || isExiting) {
        this.layers.forEach((layer) => layer.update());
      }

      this.animationFrame = window.requestAnimationFrame(this.update);
    }

    getParticleAlpha(particle) {
      return this.getSpatialDensity(particle);
    }

    getSpatialDensity(particle) {
      const width = this.drawWidth;
      const edgeWidth = this.edgeWidth || this.getEdgeWidth();
      const leftDistance = particle.x;
      const rightDistance = width - (particle.x + particle.width);
      const edgeDistance = Math.min(leftDistance, rightDistance);
      if (edgeDistance > edgeWidth) return 1;
      if (edgeDistance < 0) return 0;

      return this.getEdgeVisibility(particle, edgeDistance, edgeWidth);
    }

    getEdgeVisibility(particle, edgeDistance, edgeWidth) {
      const amount = 1 - Math.min(Math.max(edgeDistance / edgeWidth, 0), 1);
      const row = Math.floor(particle.y / 18);
      const cell = Math.floor(particle.x / 22);
      const ragged = hash(row * 31.7 + cell * 13.9 + particle.seed * 19.3);
      const edge = amount + (ragged - 0.5) * 0.42;
      const threshold = 0.62;
      const keep = edge < threshold;

      return keep ? 1 : 0;
    }
  }

  class Particle {
    constructor(host, layerSpeed, colors, widthRange, heightRange) {
      this.host = host;
      this.layerSpeed = layerSpeed;
      this.colors = colors;
      this.widthRange = widthRange;
      this.heightRange = heightRange;
      this.seed = Math.random();
      this.init();
    }

    init(reinit = false) {
      const width = this.host.drawWidth || window.innerWidth;
      const height = window.innerHeight;

      this.x = reinit ? random(width, width * 2) : random(0, width * 2);
      this.y = random(0, height);
      this.width = random(this.widthRange[0], this.widthRange[1]);
      this.height = random(this.heightRange[0], this.heightRange[1]);
      this.color = arrayRandom(this.colors);
    }

    update() {
      this.x -= this.host.speed * this.layerSpeed;
      if (this.x + this.width < 0) {
        this.init(true);
      }
    }

    draw() {
      const alpha = this.host.getParticleAlpha(this);
      if (alpha <= 0) return;

      this.host.context.globalAlpha = alpha;
      this.host.context.fillStyle = this.color;
      this.host.context.fillRect(this.x, this.y, this.width, this.height);
      this.host.context.globalAlpha = 1;
    }
  }

  class ParallaxLayer {
    constructor(host, speed, count, colors, widthRange, heightRange) {
      this.particles = [];

      for (let i = 0; i < count; i++) {
        this.particles.push(new Particle(host, speed, colors, widthRange, heightRange));
      }
    }

    update() {
      this.particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });
    }
  }

  function random(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  function arrayRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function smoothstep(edge0, edge1, value) {
    const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

    return t * t * (3 - 2 * t);
  }

  function hash(value) {
    const next = Math.sin(value * 12.9898) * 43758.5453;

    return next - Math.floor(next);
  }

  window.MainReferenceBackground = MainReferenceBackground;
})();
