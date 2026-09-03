(function () {
  const MAX_DEPTH = 32;

  function initStrataScrubber() {
    const stage = document.getElementById("hypercube-stage");
    const hud = document.getElementById("archiveAmbientHud");
    const plate = document.getElementById("strataFaultPlate");
    const control = document.getElementById("strataDepthControl");
    const readout = document.getElementById("strataDepthReadout");
    const rail = plate?.querySelector(".strata__fault-rail");
    const digits = Array.from(plate?.querySelectorAll(".strata__fault-zero b") || []);
    if (!stage || !hud || !plate || !control || !readout || !rail || digits.length === 0) return;

    let depth = 0;
    let startDepth = 0;
    let startX = 0;
    let activePointerId = null;
    let moved = false;
    let suppressClickUntil = 0;
    let singleClickTimer = 0;
    let skipTimer = 0;
    let tickTimer = 0;
    let pulseTimer = 0;

    function syncRailWidth() {
      hud.style.setProperty("--fault-rail-width", `${rail.getBoundingClientRect().width}px`);
    }

    syncRailWidth();
    new ResizeObserver(syncRailWidth).observe(rail);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      requestAnimationFrame(() => {
        plate.classList.add("is-scrub-entering");
      });
    }
    plate.addEventListener("animationend", (event) => {
      if (
        event.target === plate &&
        event.animationName === "strataScrubPlateEnter"
      ) {
        plate.classList.remove("is-scrub-entering");
      }
    });

    function formatDepth(value) {
      return String(value).padStart(2, "0");
    }

    function pulseBackground() {
      stage.classList.remove("is-strata-depth-pulse");
      void stage.offsetWidth;
      stage.classList.add("is-strata-depth-pulse");
      window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(() => {
        stage.classList.remove("is-strata-depth-pulse");
      }, 150);
    }

    function tickCounter() {
      plate.classList.remove("is-index-changing");
      void plate.offsetWidth;
      plate.classList.add("is-index-changing");
      window.clearTimeout(tickTimer);
      tickTimer = window.setTimeout(() => {
        plate.classList.remove("is-index-changing");
      }, 120);
    }

    function showSkipFault() {
      plate.classList.add("is-fault-skipping");
      window.clearTimeout(skipTimer);
      skipTimer = window.setTimeout(() => {
        plate.classList.remove("is-fault-skipping");
      }, 90);
    }

    function applyDepth(nextDepth, options = {}) {
      const clamped = Math.min(MAX_DEPTH, Math.max(0, Math.round(nextDepth)));
      const previous = depth;
      if (clamped === previous && !options.force) {
        if (options.pulse) pulseBackground();
        return;
      }

      depth = clamped;
      const label = formatDepth(depth);
      const progress = `${((depth / MAX_DEPTH) * 77).toFixed(3)}%`;

      digits.forEach((digit) => {
        digit.textContent = label;
      });
      readout.textContent = `Depth / ${label}`;
      control.setAttribute(
        "aria-label",
        `Strata depth ${label}. Drag horizontally or use arrow keys.`
      );
      hud.style.setProperty("--fault-progress", progress);
      plate.style.setProperty("--fault-progress", progress);

      if (Math.abs(depth - previous) > 1) showSkipFault();
      if (!options.skipTick) tickCounter();
      window.dispatchEvent(new CustomEvent("archive:strata-depth", {
        detail: { index: depth },
      }));
      if (options.pulse) pulseBackground();
    }

    function finishScrub(event, cancelled = false) {
      if (activePointerId === null || event.pointerId !== activePointerId) return;

      control.releasePointerCapture?.(activePointerId);
      activePointerId = null;
      plate.classList.remove("is-strata-scrubbing", "is-fault-skipping");
      if (moved && !cancelled) {
        suppressClickUntil = performance.now() + 320;
        pulseBackground();
      }
      moved = false;
    }

    control.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      plate.classList.remove("is-scrub-entering");
      activePointerId = event.pointerId;
      startX = event.clientX;
      startDepth = depth;
      moved = false;
      control.setPointerCapture?.(event.pointerId);
      plate.classList.add("is-strata-scrubbing");
    });

    control.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointerId) return;
      const travel = event.clientX - startX;
      if (Math.abs(travel) >= 3) moved = true;
      if (!moved) return;

      const pixelsPerStep = Math.max(6, control.clientWidth / MAX_DEPTH);
      applyDepth(startDepth + Math.round(travel / pixelsPerStep));
    });

    control.addEventListener("pointerup", (event) => finishScrub(event));
    control.addEventListener("pointercancel", (event) => finishScrub(event, true));

    control.addEventListener("click", (event) => {
      event.stopPropagation();
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }

      window.clearTimeout(singleClickTimer);
      singleClickTimer = window.setTimeout(() => {
        applyDepth((depth + 1) % (MAX_DEPTH + 1), { pulse: true });
      }, 210);
    });

    control.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(singleClickTimer);
      applyDepth(0, { force: true, pulse: true });
    });

    control.addEventListener("keydown", (event) => {
      let nextDepth = depth;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") nextDepth += 1;
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextDepth -= 1;
      else if (event.key === "PageUp") nextDepth += 4;
      else if (event.key === "PageDown") nextDepth -= 4;
      else if (event.key === "Home") nextDepth = 0;
      else if (event.key === "End") nextDepth = MAX_DEPTH;
      else return;

      event.preventDefault();
      event.stopPropagation();
      applyDepth(nextDepth, { pulse: true });
    });

    const availabilityObserver = new MutationObserver(() => {
      const unavailable = hud.dataset.eyeRecord === "active";
      control.disabled = unavailable;
      if (unavailable) plate.classList.remove("is-scrub-entering");
    });
    availabilityObserver.observe(hud, {
      attributes: true,
      attributeFilter: ["data-eye-record"],
    });

    control.disabled = hud.dataset.eyeRecord === "active";
    applyDepth(0, { force: true, skipTick: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStrataScrubber);
  } else {
    initStrataScrubber();
  }
})();
