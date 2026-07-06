(function () {
  document.addEventListener("DOMContentLoaded", initMainOverlay);

  function initMainOverlay() {
    const overlay = document.getElementById("mainOverlayPage");
    const overlayContent = overlay?.querySelector(".main-overlay-page__inner");
    const scrollLine = document.getElementById("mainOverlayScrollLine");
    const scrollPercent = document.getElementById("mainOverlayScrollPercent");
    const coordReadout = document.getElementById("mainOverlayCoordReadout");
    const scanReadoutState = document.getElementById("mainOverlayScanReadoutState");
    const maskPath = document.getElementById("mainOverlayMaskPath");
    if (!overlay || !maskPath) return;

    const expandThreshold = 10;
    const retractThreshold = 60;
    const expandDwell = 2000;
    const expandDuration = 820;
    const retractDuration = 980;
    let dwellTimer = null;
    const stage = document.getElementById("hypercube-stage");
    let progress = 0;
    let startProgress = 0;
    let targetProgress = 0;
    let animationStart = 0;
    let animationDuration = expandDuration;
    let animationFrame = null;
    let isDisabled = stage?.classList.contains("is-hypercube-bursting") || false;

    setupStarField();
    render();
    document.addEventListener("pointermove", onPointerMove);
    overlayContent?.addEventListener("scroll", updateScrollLine);
    window.addEventListener("resize", () => {
      render();
      updateScrollLine();
    });
    observeCardEntry();

    function onPointerMove(event) {
      if (isDisabled) return;
      const height = window.innerHeight || document.documentElement.clientHeight;
      updatePointerReadout(event.clientX, event.clientY);

      if (event.clientY <= expandThreshold) {
        scheduleExpand();
      } else {
        cancelDwell();
        if (event.clientY >= height - retractThreshold) {
          animateTo(0);
        }
      }
    }

    // Expand only after the pointer dwells at the top edge for a beat.
    function scheduleExpand() {
      if (targetProgress === 1 || dwellTimer) return;
      dwellTimer = setTimeout(() => {
        dwellTimer = null;
        animateTo(1);
      }, expandDwell);
    }

    function cancelDwell() {
      if (dwellTimer) {
        clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    }

    function animateTo(nextTarget) {
      if (isDisabled && nextTarget > 0) return;
      if (targetProgress === nextTarget && animationFrame) return;
      if (targetProgress === nextTarget && progress === nextTarget) return;

      startProgress = progress;
      targetProgress = nextTarget;
      animationDuration = nextTarget > startProgress ? expandDuration : retractDuration;
      animationStart = performance.now();
      startAnimation();
    }

    function startAnimation() {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(tick);
    }

    function tick(now) {
      const elapsed = now - animationStart;
      const amount = Math.min(elapsed / animationDuration, 1);
      const easedAmount = targetProgress < startProgress ? easeInCubic(amount) : easeInOutCubic(amount);

      progress = startProgress + (targetProgress - startProgress) * easedAmount;
      render();

      if (amount < 1) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }

      progress = targetProgress;
      animationFrame = null;
      render();
    }

    function render() {
      const shape = createOverlayShape(progress);
      const isOpen = !isDisabled && progress > 0.01;
      maskPath.setAttribute("d", shape.path);
      overlay.style.setProperty("--main-overlay-edge-y", `${shape.edgeY * 100}%`);
      overlay.style.setProperty("--main-overlay-edge-shadow", progress > 0.03 && progress < 0.98 ? "0.9" : "0");
      overlay.style.setProperty("--main-overlay-opacity", isOpen ? "1" : "0");
      overlay.style.setProperty("--main-overlay-pointer-events", isOpen ? "auto" : "none");
      overlay.style.setProperty("--main-overlay-readout-opacity", isOpen ? "1" : "0");
      overlay.hidden = isDisabled;
      document.body.classList.toggle("is-main-overlay-open", isOpen);
      updateScrollLine();
    }

    function createOverlayShape(value) {
      const edgeY = lerp(0.001, 1, value);
      const curveLift = Math.min(edgeY - 0.001, Math.sin(value * Math.PI) * 0.18);
      const centerY = edgeY - curveLift;
      const shoulderY = edgeY - curveLift * 0.72;

      return {
        edgeY,
        path: [
        "M0 0",
        "H1",
        `V${format(edgeY)}`,
        `C0.88 ${format(shoulderY)} 0.68 ${format(centerY)} 0.5 ${format(centerY)}`,
        `C0.32 ${format(centerY)} 0.12 ${format(shoulderY)} 0 ${format(edgeY)}`,
        "Z",
        ].join(" "),
      };
    }

    function easeInOutCubic(value) {
      return value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    function easeInCubic(value) {
      return value * value * value;
    }

    function lerp(from, to, value) {
      return from + (to - from) * value;
    }

    function format(value) {
      return value.toFixed(4);
    }

    function updateScrollLine() {
      if (!overlayContent || !scrollLine) return;
      const maxScroll = overlayContent.scrollHeight - overlayContent.clientHeight;
      const hasScroll = maxScroll > 1;
      const scrollProgress = hasScroll ? overlayContent.scrollTop / maxScroll : 1;
      const percent = Math.round(scrollProgress * 100);

      overlay.style.setProperty("--main-overlay-scroll-progress", format(scrollProgress));
      overlay.style.setProperty("--main-overlay-scroll-opacity", hasScroll && progress > 0.01 ? "1" : "0");
      if (scrollPercent) {
        scrollPercent.textContent = String(percent).padStart(2, "0");
      }
    }

    function updatePointerReadout(x, y) {
      if (coordReadout) {
        coordReadout.textContent = `X${String(Math.round(x)).padStart(4, "0")} / Y${String(Math.round(y)).padStart(4, "0")}`;
      }

      if (scanReadoutState) {
        const scanValue = Math.round(((x / Math.max(window.innerWidth, 1)) * 73 + (y / Math.max(window.innerHeight, 1)) * 27) % 100);
        scanReadoutState.textContent = `SCAN ${String(scanValue).padStart(2, "0")}`;
      }
    }

    function observeCardEntry() {
      if (!stage) return;
      const observer = new MutationObserver(() => {
        if (stage.classList.contains("is-hypercube-bursting")) {
          disableOverlay();
          observer.disconnect();
        }
      });

      observer.observe(stage, { attributes: true, attributeFilter: ["class"] });
    }

    function disableOverlay() {
      isDisabled = true;
      cancelDwell();
      progress = 0;
      targetProgress = 0;
      startProgress = 0;

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      document.body.classList.remove("is-main-overlay-open");
      render();
    }

    function setupStarField() {
      const layers = [
        { name: "small", count: 700 },
        { name: "medium", count: 200 },
        { name: "big", count: 100 },
      ];

      layers.forEach((layer, index) => {
        const starLayer = document.createElement("div");
        starLayer.className = `main-overlay-stars main-overlay-stars--${layer.name}`;
        overlay.insertBefore(starLayer, overlay.firstElementChild);
        overlay.style.setProperty(
          `--main-overlay-stars-${layer.name}`,
          createStarShadows(layer.count, 2048 + index * 997)
        );
      });
    }

    function createStarShadows(count, seed) {
      const shadows = [];
      let value = seed;

      for (let i = 0; i < count; i++) {
        value = seededRandom(value);
        const x = Math.ceil(value * 2000);
        value = seededRandom(value);
        const y = Math.ceil(value * 2000);
        shadows.push(`${x}px ${y}px #fff`);
      }

      return shadows.join(", ");
    }

    function seededRandom(value) {
      const next = Math.sin(value * 12.9898) * 43758.5453;

      return next - Math.floor(next);
    }
  }
})();
