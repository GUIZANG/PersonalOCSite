(function () {
  const DEFAULT_WORDS = [
    "SUBCONSCIOUS TRACE",
    "DREAM RESIDUE",
    "MNEMONIC ECHO",
    "THOUGHT PALACE",
    "LUCID INDEX",
    "CORTEX SIGNAL",
    "HYPNAGOGIC STATIC",
    "SOMATIC MEMORY",
    "NOOSPHERE BLEED",
    "EGO BOUNDARY",
    "SLEEP PARALYSIS NODE",
    "ARCHIVE NODE",
    "ENTITY RECORD",
    "CONTAINMENT NOTE",
    "ANOMALOUS BIOFORM",
    "FIELD OBSERVER",
    "CLASSIFIED SPECIMEN",
    "COGNITIVE HAZARD",
    "INTAKE CHAMBER",
    "MEMETIC RESIDUE",
    "NULL INDEX",
    "THE LANTERN EATER",
    "NULL MANTIS",
    "CATHEDRAL WORM",
    "BLACK-MOON LARVA",
    "SAINT OF STATIC",
    "EYELESS CURATOR",
    "THE BONE LIBRARIAN",
    "WHITE NOISE STAG",
    "SILENT ORRERY",
    "MIRROR-FED THING",
    "VESTIBULE SERAPH",
  ];

  class CursorBoxScanner {
    constructor(options = {}) {
      this.container = options.container instanceof Element ? options.container : document.body;
      this.words = Array.isArray(options.words) && options.words.length ? options.words : DEFAULT_WORDS;
      this.probeCount = clamp(Number(options.probeCount) || 4, 1, 8);
      this.maxActive = clamp(Number(options.maxActive) || 4, 1, this.probeCount);
      this.attractRadius = Number(options.attractRadius) || 120;
      this.deadRadiusRatio = Number(options.deadRadiusRatio) || 0.17;
      this.maxOverlapRatio = Number(options.maxOverlapRatio) || 0.5;
      this.minAnchorDistance = Number(options.minAnchorDistance) || 12;
      this.onCapture = typeof options.onCapture === "function" ? options.onCapture : null;
      this.enabled = false;
      this.anchors = [];
      this.probes = [];
      this.lastPointer = null;
      this.lastRefreshTime = -Infinity;
      this.layoutSignature = "";

      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.handleResize = this.handleResize.bind(this);

      this.createOverlay(options);
      this.createProbes();
      this.resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(this.handleResize)
        : null;
      this.resizeObserver?.observe(this.container);
      this.handleResize();

      if (options.enabled !== false) {
        this.enable();
      }
    }

    createOverlay(options) {
      const usesViewport = this.container === document.body || this.container === document.documentElement;
      this.overlay = document.createElement("div");
      this.overlay.className = "cursor-box-scanner";
      this.overlay.dataset.position = usesViewport ? "fixed" : "absolute";
      this.overlay.setAttribute("aria-hidden", "true");
      if (options.color) {
        this.overlay.style.setProperty("--cursor-box-scanner-color", options.color);
      }

      this.lines = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.lines.classList.add("cursor-box-scanner__lines");
      this.probeLayer = document.createElement("div");
      this.probeLayer.className = "cursor-box-scanner__probes";
      this.overlay.append(this.lines, this.probeLayer);
      this.container.appendChild(this.overlay);
    }

    createProbes() {
      for (let index = 0; index < this.probeCount; index++) {
        const element = document.createElement("div");
        const label = document.createElement("div");
        const readout = document.createElement("div");
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        element.className = "cursor-box-scanner__probe";
        label.className = "cursor-box-scanner__label";
        readout.className = "cursor-box-scanner__readout";
        line.classList.add("cursor-box-scanner__line");
        element.style.setProperty("--scanner-opacity", "0");
        line.style.setProperty("--scanner-opacity", "0");
        element.append(label, readout);
        this.probeLayer.appendChild(element);
        this.lines.appendChild(line);
        this.probes.push({ element, label, readout, line, anchorId: null });
      }
    }

    enable() {
      if (this.enabled) return;
      this.enabled = true;
      this.overlay.hidden = false;
      window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
      window.addEventListener("blur", this.handlePointerLeave);
      document.documentElement.addEventListener("pointerleave", this.handlePointerLeave);
    }

    disable() {
      if (!this.enabled) return;
      this.enabled = false;
      window.removeEventListener("pointermove", this.handlePointerMove);
      window.removeEventListener("blur", this.handlePointerLeave);
      document.documentElement.removeEventListener("pointerleave", this.handlePointerLeave);
      this.hide(true);
      this.overlay.hidden = true;
    }

    destroy() {
      this.disable();
      this.resizeObserver?.disconnect();
      this.overlay.remove();
      this.anchors = [];
      this.probes = [];
    }

    handleResize() {
      this.layoutSignature = "";
      this.ensureAnchors();
    }

    handlePointerMove(event) {
      if (!this.enabled) return;
      const rect = this.overlay.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        this.hide();
        return;
      }

      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const pointerSpeed = this.lastPointer
        ? Math.hypot(pointer.x - this.lastPointer.x, pointer.y - this.lastPointer.y)
        : 0;

      this.lastPointer = pointer;
      this.ensureAnchors();
      const nearbyCount = this.countNearbyAnchors(pointer);
      const activeCount = clamp(
        Math.min(nearbyCount, pointerSpeed > 2 ? this.maxActive : Math.min(3, this.maxActive)),
        0,
        this.maxActive
      );
      const selected = this.pickAnchors(pointer, activeCount);
      const now = performance.now();

      this.probes.forEach((probe, index) => {
        const anchor = selected[index];
        if (!anchor) {
          this.setOpacity(probe, 0);
          return;
        }

        const size = this.getAnchorSize(anchor);
        const anchorId = `${Math.round(anchor.x)}:${Math.round(anchor.y)}`;
        const anchorChanged = probe.anchorId !== anchorId;
        if (anchorChanged || !probe.label.textContent) {
          probe.label.textContent = this.pickWord(index, now);
          this.onCapture?.(probe.label.textContent, { index, anchor });
        }

        probe.readout.textContent =
          `LOCK ${Math.round(anchor.pointerDistance).toString().padStart(3, "0")} / ` +
          `D${Math.round(anchor.distance).toString().padStart(3, "0")}`;
        probe.element.style.setProperty("--scanner-x", `${Math.round(anchor.x)}px`);
        probe.element.style.setProperty("--scanner-y", `${Math.round(anchor.y)}px`);
        probe.element.style.setProperty("--scanner-size", `${size}px`);
        probe.element.style.setProperty("--scanner-scale", "1");
        probe.line.setAttribute("x1", Math.round(pointer.x));
        probe.line.setAttribute("y1", Math.round(pointer.y));
        probe.line.setAttribute("x2", Math.round(anchor.x));
        probe.line.setAttribute("y2", Math.round(anchor.y));
        this.setOpacity(probe, 1);

        if (anchorChanged) {
          probe.anchorId = anchorId;
          this.flash(probe);
        }
      });
    }

    handlePointerLeave() {
      this.hide(true);
    }

    hide(reset = false) {
      this.probes.forEach((probe) => {
        this.setOpacity(probe, 0);
        if (reset) probe.anchorId = null;
      });
      if (reset) this.lastPointer = null;
    }

    ensureAnchors() {
      const rect = this.overlay.getBoundingClientRect();
      const signature = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      if (signature === this.layoutSignature && this.anchors.length) return;

      this.layoutSignature = signature;
      this.anchors = [];
      this.lines.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const base = Math.min(rect.width, rect.height);
      const deadRadius = base * this.deadRadiusRatio;
      const margin = clamp(rect.width * 0.035, 22, 52) + 12;
      const outerRadius = Math.max(deadRadius * 1.2, Math.min(base * 0.35, base / 2 - margin));

      for (let clusterIndex = 0; clusterIndex < 12; clusterIndex++) {
        const angle = clusterIndex * 2.399963 + hash(clusterIndex * 19.17) * 1.2;
        const radialBias = Math.pow(hash(clusterIndex * 31.91 + 2.7), 0.55);
        const radius = lerp(deadRadius * 1.2, outerRadius, radialBias);
        const x = clamp(centerX + Math.cos(angle) * radius * 1.2, margin, rect.width - margin);
        const y = clamp(centerY + Math.sin(angle) * radius * 1.12, margin, rect.height - margin);
        const density = 7 + Math.floor(hash(clusterIndex * 13.73) * 8);
        const spread = lerp(base * 0.025, base * 0.05, hash(clusterIndex * 23.9));

        if (Math.hypot(x - centerX, y - centerY) <= deadRadius) continue;
        for (let index = 0; index < density * 3 && this.countCluster(clusterIndex) < density; index++) {
          const pointAngle = hash(clusterIndex * 101 + index * 17.31) * Math.PI * 2;
          const pointRadius = Math.pow(hash(clusterIndex * 131 + index * 29.7), 1.25) * spread;
          const pointX = clamp(x + Math.cos(pointAngle) * pointRadius * 1.16, margin, rect.width - margin);
          const pointY = clamp(y + Math.sin(pointAngle) * pointRadius, margin, rect.height - margin);
          if (Math.hypot(pointX - centerX, pointY - centerY) > deadRadius) {
            this.addAnchor(pointX, pointY, clusterIndex);
          }
        }
      }

      const sparseTotal = 48;
      for (let index = 0; index < sparseTotal * 2 && this.countCluster(-1) < sparseTotal; index++) {
        const angle = index * 2.399963 + hash(index * 17.31) * 0.45;
        const radius = lerp(
          deadRadius * 1.2,
          outerRadius,
          Math.pow(hash(index * 43.11 + 1.7), 0.72)
        );
        const x = clamp(centerX + Math.cos(angle) * radius * 1.2, margin, rect.width - margin);
        const y = clamp(centerY + Math.sin(angle) * radius * 1.12, margin, rect.height - margin);
        if (Math.hypot(x - centerX, y - centerY) > deadRadius) {
          this.addAnchor(x, y, -1);
        }
      }
    }

    addAnchor(x, y, cluster) {
      if (this.anchors.some((anchor) => Math.hypot(anchor.x - x, anchor.y - y) < this.minAnchorDistance)) {
        return;
      }
      const seed = hash(x * 0.073 + y * 0.119 + (cluster + 17) * 5.31);
      this.anchors.push({
        x,
        y,
        cluster,
        distance: Math.round(lerp(64, 120, seed) / 2) * 2,
      });
    }

    countCluster(cluster) {
      return this.anchors.filter((anchor) => anchor.cluster === cluster).length;
    }

    countNearbyAnchors(pointer) {
      return this.anchors.reduce(
        (total, anchor) => total + (Math.hypot(anchor.x - pointer.x, anchor.y - pointer.y) <= this.attractRadius ? 1 : 0),
        0
      );
    }

    pickAnchors(pointer, count) {
      const candidates = this.anchors
        .map((anchor) => ({
          ...anchor,
          pointerDistance: Math.hypot(anchor.x - pointer.x, anchor.y - pointer.y),
        }))
        .filter((anchor) => anchor.pointerDistance <= this.attractRadius)
        .sort((a, b) => a.pointerDistance - b.pointerDistance);
      const selected = [];

      for (const candidate of candidates) {
        const candidateSize = this.getAnchorSize(candidate);
        const overlaps = selected.some((anchor) => {
          const anchorSize = this.getAnchorSize(anchor);
          return (
            this.getOverlapRatio(candidate, candidateSize, anchor, anchorSize) > this.maxOverlapRatio ||
            this.textsOverlap(candidate, candidateSize, anchor, anchorSize)
          );
        });
        if (!overlaps) selected.push(candidate);
        if (selected.length >= count) break;
      }
      return selected;
    }

    getAnchorSize(anchor) {
      return Math.round(clamp(anchor.distance || 120, 64, 120) / 2) * 2;
    }

    getOverlapRatio(a, aSize, b, bSize) {
      const overlapWidth = Math.max(
        0,
        Math.min(a.x + aSize / 2, b.x + bSize / 2) - Math.max(a.x - aSize / 2, b.x - bSize / 2)
      );
      const overlapHeight = Math.max(
        0,
        Math.min(a.y + aSize / 2, b.y + bSize / 2) - Math.max(a.y - aSize / 2, b.y - bSize / 2)
      );
      return (overlapWidth * overlapHeight) / Math.min(aSize * aSize, bSize * bSize);
    }

    textsOverlap(a, aSize, b, bSize) {
      const getRects = (anchor, size) => {
        const left = anchor.x - size / 2;
        const top = anchor.y - size / 2;
        const bottom = anchor.y + size / 2;
        return [
          { left, right: left + 180, top: top - 25, bottom: top - 5 },
          { left, right: left + 180, top: bottom + 5, bottom: bottom + 20 },
        ];
      };
      return getRects(a, aSize).some((aRect) =>
        getRects(b, bSize).some((bRect) =>
          aRect.left < bRect.right &&
          aRect.right > bRect.left &&
          aRect.top < bRect.bottom &&
          aRect.bottom > bRect.top
        )
      );
    }

    pickWord(index, now) {
      return this.words[Math.floor(hash(index * 31.17 + now * 0.0027) * this.words.length)];
    }

    setOpacity(probe, opacity) {
      probe.element.style.setProperty("--scanner-opacity", opacity);
      probe.line.style.setProperty("--scanner-opacity", opacity);
    }

    flash(probe) {
      probe.element.classList.remove("is-capturing");
      probe.line.classList.remove("is-capturing");
      void probe.element.offsetWidth;
      probe.element.classList.add("is-capturing");
      probe.line.classList.add("is-capturing");
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function hash(value) {
    const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  CursorBoxScanner.DEFAULT_WORDS = [...DEFAULT_WORDS];
  window.CursorBoxScanner = CursorBoxScanner;
})();
