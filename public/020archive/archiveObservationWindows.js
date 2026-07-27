(function () {
  const WINDOW_DEPTH = {
    large: 1,
    medium: 2,
    small: 3,
  };

  function decomposeRectangleUnion(rectangles) {
    if (!rectangles.length) return [];

    const xStops = [...new Set(
      rectangles.flatMap(({ x1, x2 }) => [x1, x2])
    )].sort((a, b) => a - b);
    const unionCells = [];

    for (let index = 0; index < xStops.length - 1; index += 1) {
      const x1 = xStops[index];
      const x2 = xStops[index + 1];
      if (x2 - x1 <= 0.01) continue;

      const intervals = rectangles
        .filter((rect) => rect.x1 < x2 && rect.x2 > x1)
        .map((rect) => ({ y1: rect.y1, y2: rect.y2 }))
        .sort((a, b) => a.y1 - b.y1 || a.y2 - b.y2);
      const mergedIntervals = [];

      intervals.forEach((interval) => {
        const previous = mergedIntervals[mergedIntervals.length - 1];
        if (previous && interval.y1 <= previous.y2 + 0.01) {
          previous.y2 = Math.max(previous.y2, interval.y2);
        } else {
          mergedIntervals.push({ ...interval });
        }
      });

      mergedIntervals.forEach(({ y1, y2 }) => {
        unionCells.push({ x1, y1, x2, y2 });
      });
    }

    return unionCells;
  }

  const WINDOW_DEFS = [
    {
      id: "main",
      size: "large",
      label: "ANOMALY_00 / PRIMARY FEED",
      status: "ORIGIN",
      x: 0.45,
      y: 0.20,
      width: 0.48,
      ratio: 5 / 3,
    },
    {
      id: "north",
      size: "medium",
      label: "MEMORY BUFFER / 02",
      x: 0.51,
      y: 0.05,
      width: 0.30,
      ratio: 2 / 1,
    },
    {
      id: "west",
      size: "small",
      label: "EYE TRACE / 03",
      x: 0.04,
      y: 0.12,
      width: 0.18,
      ratio: 1,
    },
    {
      id: "south-east",
      size: "small",
      label: "RECALL FRAGMENT / 04",
      x: 0.66,
      y: 0.55,
      width: 0.22,
      ratio: 4 / 3,
    },
    {
      id: "lower",
      size: "medium",
      label: "NOOSPHERE / 05",
      x: 0.12,
      y: 0.26,
      width: 0.28,
      ratio: 3 / 2,
    },
  ];

  class ArchiveObservationWindows {
    constructor(stage, sourceCanvas) {
      this.stage = stage;
      this.sourceCanvas = sourceCanvas;
      this.visualLayer = sourceCanvas.closest(".archive-hypercube-visual-layer");
      this.layer = document.createElement("section");
      this.layer.className = "archive-media-windows";
      this.layer.setAttribute("aria-label", "Movable archive observation windows");
      this.windows = [];
      this.resizeRaf = 0;
      this.clipRaf = 0;
      this.clipId = `archive-observation-clip-${Math.random().toString(36).slice(2)}`;

      this.stage.appendChild(this.layer);
      this.createWindows();
      this.createClipPath();
      this.connectSource();
      this.layoutInitial();
      this.bindEvents();

      this.stage.classList.add("has-archive-media-windows");
      this.startEntranceAnimation();
      window.ArchiveObservationWindows = this;
    }

    createWindows() {
      WINDOW_DEFS.forEach((definition, index) => {
        const frame = document.createElement("article");
        frame.className = `archive-media-window archive-media-window--${definition.size}`;
        frame.dataset.windowId = definition.id;
        frame.dataset.size = definition.size;
        frame.style.setProperty("--window-order", index);

        const bar = document.createElement("header");
        bar.className = "archive-media-window__bar hoverable";
        bar.innerHTML = [
          `<span>${definition.label}</span>`,
          definition.status
            ? `<span class="archive-media-window__status">${definition.status}</span>`
            : "",
        ].join("");

        const viewport = document.createElement("div");
        viewport.className = "archive-media-window__viewport";
        viewport.setAttribute("aria-label", `${definition.label} observation aperture`);

        const content = document.createElement("div");
        content.className = "archive-media-window__content";
        content.append(bar, viewport);

        frame.appendChild(content);
        this.layer.appendChild(frame);
        this.windows.push({
          definition,
          index,
          depth: WINDOW_DEPTH[definition.size] || 1,
          frame,
          content,
          bar,
          viewport,
          clipRect: null,
          occlusionPath: null,
          revealProgress: 0,
        });
      });
    }

    createClipPath() {
      const svgNs = "http://www.w3.org/2000/svg";
      this.clipSvg = document.createElementNS(svgNs, "svg");
      this.clipSvg.classList.add("archive-observation-clip-defs");
      this.clipSvg.setAttribute("aria-hidden", "true");

      const defs = document.createElementNS(svgNs, "defs");
      this.clipPath = document.createElementNS(svgNs, "clipPath");
      this.clipPath.id = this.clipId;
      this.clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

      this.windows.forEach((item) => {
        item.clipRect = document.createElementNS(svgNs, "rect");
        this.clipPath.appendChild(item.clipRect);

        const occlusionClip = document.createElementNS(svgNs, "clipPath");
        occlusionClip.id = `${this.clipId}-${item.definition.id}`;
        occlusionClip.setAttribute("clipPathUnits", "userSpaceOnUse");
        item.occlusionPath = document.createElementNS(svgNs, "path");
        item.occlusionPath.setAttribute("fill-rule", "evenodd");
        item.occlusionPath.setAttribute("clip-rule", "evenodd");
        occlusionClip.appendChild(item.occlusionPath);
        defs.appendChild(occlusionClip);

        const occlusionUrl = `url("#${occlusionClip.id}")`;
        item.frame.style.clipPath = occlusionUrl;
        item.frame.style.webkitClipPath = occlusionUrl;
      });

      defs.appendChild(this.clipPath);
      this.clipSvg.appendChild(defs);
      document.body.appendChild(this.clipSvg);
    }

    connectSource() {
      if (!this.visualLayer) return;
      const clipUrl = `url("#${this.clipId}")`;
      this.visualLayer.style.clipPath = clipUrl;
      this.visualLayer.style.webkitClipPath = clipUrl;
    }

    requestClipRefresh() {
      window.cancelAnimationFrame(this.clipRaf);
      this.clipRaf = window.requestAnimationFrame(() => this.refreshClip());
    }

    refreshClip() {
      this.windows.forEach(({ frame, viewport, clipRect, revealProgress }) => {
        if (!clipRect) return;
        const frameRect = frame.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const revealRight = frameRect.left + frameRect.width * revealProgress;
        const revealBottom = frameRect.top + frameRect.height * revealProgress;
        const visibleWidth = Math.max(
          0,
          Math.min(viewportRect.right, revealRight) - viewportRect.left
        );
        const visibleHeight = Math.max(
          0,
          Math.min(viewportRect.bottom, revealBottom) - viewportRect.top
        );

        clipRect.setAttribute("x", viewportRect.left.toFixed(2));
        clipRect.setAttribute("y", viewportRect.top.toFixed(2));
        clipRect.setAttribute("width", visibleWidth.toFixed(2));
        clipRect.setAttribute("height", visibleHeight.toFixed(2));
      });
      this.refreshWindowOcclusion();
    }

    refreshWindowOcclusion() {
      const rects = this.windows.map((item) => {
        const frameRect = item.frame.getBoundingClientRect();
        return {
          item,
          frameRect,
          visibleRect: {
            left: frameRect.left,
            top: frameRect.top,
            right: frameRect.left + frameRect.width * item.revealProgress,
            bottom: frameRect.top + frameRect.height * item.revealProgress,
          },
        };
      });

      rects.forEach(({ item, frameRect }) => {
        if (!item.occlusionPath) return;

        const width = Math.max(0, frameRect.width);
        const height = Math.max(0, frameRect.height);
        let path = `M0 0H${width.toFixed(2)}V${height.toFixed(2)}H0Z`;
        const occlusions = [];

        rects.forEach(({ item: upperItem, visibleRect: upperRect }) => {
          const isAbove =
            upperItem.depth > item.depth ||
            (upperItem.depth === item.depth && upperItem.index > item.index);
          if (!isAbove) return;

          const left = Math.max(frameRect.left, upperRect.left);
          const top = Math.max(frameRect.top, upperRect.top);
          const right = Math.min(frameRect.right, upperRect.right);
          const bottom = Math.min(frameRect.bottom, upperRect.bottom);
          if (right <= left || bottom <= top) return;

          const x1 = left - frameRect.left;
          const y1 = top - frameRect.top;
          const x2 = right - frameRect.left;
          const y2 = bottom - frameRect.top;
          occlusions.push({ x1, y1, x2, y2 });
        });

        // Even-odd holes toggle visibility. If two raw occlusion rectangles
        // overlap, their shared area toggles twice and reveals the bottom frame
        // again. Decompose their union into non-overlapping cells first so any
        // number of stacked windows remains fully opaque to lower layers.
        decomposeRectangleUnion(occlusions).forEach(({ x1, y1, x2, y2 }) => {
          path +=
            ` M${x1.toFixed(2)} ${y1.toFixed(2)}` +
            `H${x2.toFixed(2)}V${y2.toFixed(2)}` +
            `H${x1.toFixed(2)}Z`;
        });

        item.occlusionPath.setAttribute("d", path);
      });
    }

    startEntranceAnimation() {
      const orderedWindows = [...this.windows].sort(
        (a, b) =>
          a.depth - b.depth ||
          (a.definition.x + a.definition.y) - (b.definition.x + b.definition.y)
      );
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        orderedWindows.forEach((item) => {
          this.setRevealProgress(item, 1);
          item.frame.classList.add("is-reveal-complete");
        });
        this.refreshClip();
        return;
      }

      const duration = 680;
      const stagger = 120;
      const leadIn = 70;
      const startedAt = performance.now() + leadIn;

      const tick = (now) => {
        let complete = true;

        orderedWindows.forEach((item, order) => {
          const elapsed = now - startedAt - order * stagger;
          const linearProgress = Math.min(1, Math.max(0, elapsed / duration));
          const easedProgress = 1 - Math.pow(1 - linearProgress, 4);

          this.setRevealProgress(item, easedProgress);

          if (linearProgress >= 1) {
            item.frame.classList.add("is-reveal-complete");
          } else {
            complete = false;
          }
        });

        this.refreshClip();
        if (!complete) window.requestAnimationFrame(tick);
      };

      window.requestAnimationFrame(tick);
    }

    setRevealProgress(item, progress) {
      const clamped = Math.min(1, Math.max(0, progress));
      const frameRect = item.frame.getBoundingClientRect();
      item.revealProgress = clamped;
      item.frame.style.setProperty("--window-reveal", `${(clamped * 100).toFixed(3)}%`);
      item.frame.style.setProperty(
        "--window-outline-width",
        `${(frameRect.width * clamped).toFixed(2)}px`
      );
      item.frame.style.setProperty(
        "--window-outline-height",
        `${(frameRect.height * clamped).toFixed(2)}px`
      );
      item.frame.style.setProperty("--window-outline-opacity", clamped > 0 ? "1" : "0");
    }

    bindEvents() {
      this.windows.forEach((item) => {
        item.bar.addEventListener("pointerdown", (event) => this.startDrag(event, item));
        item.bar.addEventListener("contextmenu", (event) => event.preventDefault());
      });

      window.addEventListener("resize", () => {
        window.cancelAnimationFrame(this.resizeRaf);
        this.resizeRaf = window.requestAnimationFrame(() => {
          this.applyWindowSizes();
          this.clampAll();
          this.refreshClip();
        });
      });

      window.addEventListener("archive:hypercube-burst", () => {
        this.layer.setAttribute("aria-hidden", "true");
      });
    }

    startDrag(event, item) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent("archive:observation-drag-start"));

      const startRect = item.frame.getBoundingClientRect();
      const pointerOffsetX = event.clientX - startRect.left;
      const pointerOffsetY = event.clientY - startRect.top;
      const pointerId = event.pointerId;
      item.frame.classList.add("is-dragging");
      this.stage.classList.add("is-observation-dragging");

      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        this.place(
          item.frame,
          moveEvent.clientX - pointerOffsetX,
          moveEvent.clientY - pointerOffsetY
        );
        this.requestClipRefresh();
      };

      const finish = (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        upEvent.stopPropagation();
        item.frame.classList.remove("is-dragging");
        this.stage.classList.remove("is-observation-dragging");
        window.dispatchEvent(new CustomEvent("archive:observation-drag-end"));
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    }

    layoutInitial() {
      this.applyWindowSizes();
      this.windows.forEach(({ definition, frame }) => {
        this.place(
          frame,
          Math.round(window.innerWidth * definition.x),
          Math.round(window.innerHeight * definition.y)
        );
      });
      this.requestClipRefresh();
    }

    applyWindowSizes() {
      this.windows.forEach((item) => {
        const { definition, frame } = item;
        const requestedWidth = Math.max(180, Math.round(window.innerWidth * definition.width));
        frame.style.width = `${requestedWidth}px`;
        const renderedWidth = frame.getBoundingClientRect().width || requestedWidth;
        frame.style.setProperty("--window-content-height", `${renderedWidth / definition.ratio}px`);
        this.setRevealProgress(item, item.revealProgress);
      });
    }

    clampAll() {
      this.windows.forEach(({ frame }) => {
        const rect = frame.getBoundingClientRect();
        this.place(frame, rect.left, rect.top);
      });
    }

    place(frame, rawX, rawY) {
      const rect = frame.getBoundingClientRect();
      const visibleHandle = 72;
      const minX = Math.min(0, window.innerWidth - rect.width);
      const maxX = Math.max(0, window.innerWidth - visibleHandle);
      const minY = 0;
      const maxY = Math.max(0, window.innerHeight - 24);
      const x = Math.min(Math.max(rawX, minX), maxX);
      const y = Math.min(Math.max(rawY, minY), maxY);
      frame.style.left = `${Math.round(x)}px`;
      frame.style.top = `${Math.round(y)}px`;
    }
  }

  function initArchiveMediaWindows() {
    const stage = document.getElementById("hypercube-stage");
    const sourceCanvas = stage?.querySelector(".archive-hypercube-source");
    if (!stage || !sourceCanvas || stage.querySelector(".archive-media-windows")) return false;
    new ArchiveObservationWindows(stage, sourceCanvas);
    return true;
  }

  function waitForArchiveSource(attempt = 0) {
    if (initArchiveMediaWindows() || attempt >= 120) return;
    window.requestAnimationFrame(() => waitForArchiveSource(attempt + 1));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => waitForArchiveSource());
  } else {
    waitForArchiveSource();
  }
})();
