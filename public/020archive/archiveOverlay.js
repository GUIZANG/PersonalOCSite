// Archive top-edge CREDITS overlay. Move the pointer to the top edge and
// dwell for a beat to pull the panel down; move to the bottom edge to retract
// it. The background is a multi-layer CSS starfield (box-shadow points seeded
// once into CSS custom properties). The overlay auto-disables for good once
// the hypercube bursts into the card stream.
(function () {
  function initArchiveOverlay() {
    const overlay = document.getElementById("archiveOverlayPage");
    const overlayContent = overlay?.querySelector(".archive-overlay-page__inner");
    const scrollLine = document.getElementById("archiveOverlayScrollLine");
    const scrollPercent = document.getElementById("archiveOverlayScrollPercent");
    const coordReadout = document.getElementById("archiveOverlayCoordReadout");
    const scanReadoutState = document.getElementById("archiveOverlayScanReadoutState");
    const maskPath = document.getElementById("archiveOverlayMaskPath");
    const stage = document.getElementById("hypercube-stage");
    if (!overlay || !maskPath) return;

    const expandThreshold = 10;
    const retractThreshold = 60;
    const expandDwell = 2000;
    const expandDuration = 820;
    const retractDuration = 980;
    let dwellTimer = null;
    let progress = 0;
    let startProgress = 0;
    let targetProgress = 0;
    let animationStart = 0;
    let animationDuration = expandDuration;
    let animationFrame = null;
    let disabled = false;
    let creditsTriggerActive = false;

    setupStarField();
    render();
    document.addEventListener("pointermove", onPointerMove);
    overlayContent?.addEventListener("scroll", updateScrollLine);
    window.addEventListener("resize", () => {
      render();
      updateScrollLine();
    });
    watchForBurst();

    function onPointerMove(event) {
      if (disabled) return;
      const height = window.innerHeight || document.documentElement.clientHeight;
      updatePointerReadout(event.clientX, event.clientY);

      const isInsideTrigger = event.clientY <= expandThreshold;
      updateCreditsTrigger(isInsideTrigger);

      if (isInsideTrigger) {
        scheduleExpand();
      } else {
        cancelDwell();
        if (event.clientY >= height - retractThreshold) {
          animateTo(0);
        }
      }
    }

    function updateCreditsTrigger(active) {
      if (creditsTriggerActive === active) return;
      creditsTriggerActive = active;
      window.dispatchEvent(new CustomEvent("archive:credits-trigger", {
        detail: { active },
      }));
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
      const isOpen = progress > 0.01;
      maskPath.setAttribute("d", shape.path);
      overlay.style.setProperty("--archive-overlay-edge-y", `${shape.edgeY * 100}%`);
      overlay.style.setProperty("--archive-overlay-edge-shadow", progress > 0.03 && progress < 0.98 ? "0.9" : "0");
      overlay.style.setProperty("--archive-overlay-opacity", isOpen ? "1" : "0");
      overlay.style.setProperty("--archive-overlay-pointer-events", isOpen ? "auto" : "none");
      overlay.style.setProperty("--archive-overlay-readout-opacity", isOpen ? "1" : "0");
      document.body.classList.toggle("is-archive-overlay-open", isOpen);
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

      overlay.style.setProperty("--archive-overlay-scroll-progress", format(scrollProgress));
      overlay.style.setProperty("--archive-overlay-scroll-opacity", hasScroll && progress > 0.01 ? "1" : "0");
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

    // Seed three parallax layers of stars as box-shadow lists in CSS vars.
    function setupStarField() {
      const spread = 2000;
      overlay.style.setProperty("--archive-overlay-stars-small", buildStars(700, spread));
      overlay.style.setProperty("--archive-overlay-stars-medium", buildStars(200, spread));
      overlay.style.setProperty("--archive-overlay-stars-big", buildStars(90, spread));

      ["small", "medium", "big"].forEach((size) => {
        const layer = document.createElement("div");
        layer.className = `archive-overlay-stars archive-overlay-stars--${size}`;
        overlay.insertBefore(layer, overlay.firstChild);
      });
    }

    function buildStars(count, spread) {
      const parts = [];
      for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * spread);
        const y = Math.floor(Math.random() * spread);
        parts.push(`${x}px ${y}px #FFF`);
      }
      return parts.join(", ");
    }

    // Once the hypercube bursts, the overlay is no longer reachable.
    function watchForBurst() {
      if (!stage) return;
      if (stage.classList.contains("is-hypercube-bursting")) {
        disableOverlay();
        return;
      }
      const observer = new MutationObserver(() => {
        if (stage.classList.contains("is-hypercube-bursting")) {
          disableOverlay();
          observer.disconnect();
        }
      });
      observer.observe(stage, { attributes: true, attributeFilter: ["class"] });
    }

    function disableOverlay() {
      disabled = true;
      updateCreditsTrigger(false);
      cancelDwell();
      animateTo(0);
      document.removeEventListener("pointermove", onPointerMove);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initArchiveOverlay);
  } else {
    initArchiveOverlay();
  }
})();
