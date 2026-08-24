(function () {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("archive-is-loading")) {
      window.addEventListener("archive:preloader-complete", initCursor, { once: true });
      return;
    }

    initCursor();
  });

  function initCursor() {
    const cursor = document.querySelector(".curzr");
    const interactionLabel = cursor?.querySelector(".curzr__interaction-state");
    const screenGlitch = document.querySelector(".screen-glitch");
    if (!cursor) return;

    const isTouchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isTouchDevice) {
      cursor.remove();
      screenGlitch?.remove();
      return;
    }

    const glitchColorB = "#00feff";
    const glitchColorR = "#ff4f71";
    const defaultShadow = `0 0 0 ${glitchColorB}, 0 0 0 ${glitchColorR}`;
    const desktopReferenceHeight = 1080;
    const desktopOuterSize = 25;
    const desktopDotSize = 8;
    let targetX = 0;
    let targetY = 0;
    let physicalPointerX = 0;
    let physicalPointerY = 0;
    let dotX = 0;
    let dotY = 0;
    let outerX = 0;
    let outerY = 0;
    let previousTargetX = 0;
    let previousTargetY = 0;
    let hoverScale = 1;
    let renderHoverScale = 1;
    let isClicking = false;
    let isMoving = false;
    let isPressing = false;
    let isPressGlitching = false;
    let pressGlitchUntil = 0;
    let isScreenPressing = false;
    let screenGlitchUntil = 0;
    let isHypercubePressing = false;
    let hypercubePressProgress = 0;
    let isDragging = false;
    let isGrabTarget = false;
    let isStrataScrubTarget = false;
    let isHovering = false;
    let isCreditsTriggerActive = false;
    let isLedgerHoverTarget = false;
    let snapActive = false;
    let snapX = 0;
    let snapY = 0;
    let hasPointerPosition = false;
    let animationFrame = null;
    let cursorOuterSize = desktopOuterSize;

    cursor.removeAttribute("hidden");
    screenGlitch?.removeAttribute("hidden");
    // Pointer events continue firing while a window title bar is being dragged.
    // Mouse compatibility events can be suppressed after pointerdown.preventDefault(),
    // which previously left the custom cursor frozen at the drag start position.
    document.addEventListener("pointermove", moveCursor, { passive: true });
    document.addEventListener("pointerdown", startPressGlitch);
    document.addEventListener("pointerup", endPressGlitch);
    document.addEventListener("pointercancel", endPressGlitch);
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("archive:hypercube-long-press", updateHypercubePressCursor);
    window.addEventListener("archive:cursor-snap", updateCursorSnap);
    window.addEventListener("archive:hypercube-burst", resetCursorAfterBurst);
    window.addEventListener("archive:observation-drag-start", startDragCursorState);
    window.addEventListener("archive:observation-drag-end", endDragCursorState);
    window.addEventListener("archive:credits-trigger", updateCreditsTriggerState);
    window.addEventListener("resize", updateCursorSize);
    window.addEventListener("blur", endPressGlitch);
    updateCursorSize();

    function moveCursor(event) {
      const nextPointerX = event.clientX;
      const nextPointerY = event.clientY;
      physicalPointerX = nextPointerX;
      physicalPointerY = nextPointerY;

      if (!hasPointerPosition) {
        syncPointer(nextPointerX, nextPointerY);
        return;
      }

      if (snapActive || isHypercubePressing) return;

      previousTargetX = targetX;
      previousTargetY = targetY;
      targetX = nextPointerX;
      targetY = nextPointerY;

      const distanceX = clamp(previousTargetX - targetX, -10, 10);
      const distanceY = clamp(previousTargetY - targetY, -10, 10);
      updatePointerInteraction(event.target);
      updateInteractionState();

      if (distanceX || distanceY) {
        cursor.style.setProperty("--cursor-shadow", `
          ${distanceX}px ${distanceY}px 0 ${glitchColorB},
          ${-distanceX}px ${-distanceY}px 0 ${glitchColorR}
        `);
        stopGlitch();
      }
    }

    function startPressGlitch(event) {
      if (event.button !== 0 && event.button !== 2) return;

      if (!hasPointerPosition) {
        syncPointer(event.clientX, event.clientY);
      }

      if (event.button === 2) {
        cursor.classList.toggle(
          "is-ledger-context-pressing",
          cursor.classList.contains("is-cardstream-cursor") &&
            !document.body.classList.contains("is-archive-overlay-open")
        );
        isScreenPressing = true;
        screenGlitchUntil = performance.now() + 140;
        applyScreenGlitch();
        return;
      }

      isPressing = true;
      pressGlitchUntil = performance.now() + 140;
      isClicking = true;
      cursor.classList.toggle(
        "is-ledger-pressing",
        cursor.classList.contains("is-cardstream-cursor") &&
          !document.body.classList.contains("is-archive-overlay-open")
      );
      applyPressGlitch(performance.now());
      renderCursor();

      setTimeout(() => {
        isClicking = false;
        renderCursor();
      }, 35);
    }

    function endPressGlitch() {
      cursor.classList.remove(
        "is-ledger-pressing",
        "is-ledger-context-pressing"
      );

      if (isScreenPressing) {
        isScreenPressing = false;
        screenGlitchUntil = Math.max(screenGlitchUntil, performance.now() + 110);
      }

      if (!isPressing) return;

      isPressing = false;
      pressGlitchUntil = Math.max(pressGlitchUntil, performance.now() + 90);
    }

    function renderCursor() {
      const clickScale = isClicking ? 0.75 : 1;
      const renderScale = renderHoverScale * clickScale;
      const renderOuterSize = snapEvenPixel(cursorOuterSize * renderScale);
      const snappedRenderScale = renderOuterSize / cursorOuterSize;

      cursor.style.setProperty("--dot-x", `${Math.round(dotX)}px`);
      cursor.style.setProperty("--dot-y", `${Math.round(dotY)}px`);
      cursor.style.setProperty("--outer-x", `${Math.round(outerX)}px`);
      cursor.style.setProperty("--outer-y", `${Math.round(outerY)}px`);
      cursor.style.setProperty("--cursor-render-scale", snappedRenderScale);
      cursor.style.setProperty("--cursor-outer-scaled-half-size", `${renderOuterSize / 2}px`);
      cursor.style.setProperty(
        "--cursor-outer-diagonal-offset",
        `${Math.round(renderOuterSize / (2 * Math.SQRT2))}px`
      );
    }

    function updateHypercubePressCursor(event) {
      const detail = event.detail || {};
      const wasHoldLocked = snapActive || isHypercubePressing;
      isHypercubePressing = Boolean(detail.active);
      hypercubePressProgress = isHypercubePressing ? clamp(Number(detail.progress) || 0, 0, 1) : 0;

      cursor.classList.toggle("is-hypercube-pressing", isHypercubePressing);
      cursor.style.setProperty("--press-progress", hypercubePressProgress.toFixed(3));
      cursor.style.setProperty("--cursor-outer-color", mixColor("#f7f8fa", "#ff0d1a", hypercubePressProgress));
      updateInteractionState();
      if (wasHoldLocked && !snapActive && !isHypercubePressing) {
        releaseHoldLock();
      }
      if (!isHypercubePressing && !isPressing && !isPressGlitching) {
        cursor.style.setProperty("--cursor-shadow", defaultShadow);
      }
    }

    function resetCursorAfterBurst() {
      // Keep the custom cursor exactly where the hold completed. Releasing the
      // magnetic snap used to retarget it to the slightly offset physical
      // pointer, which produced a visible nudge during the Card Stream reveal.
      targetX = dotX;
      targetY = dotY;
      previousTargetX = dotX;
      previousTargetY = dotY;
      outerX = dotX;
      outerY = dotY;
      snapActive = false;
      isPressing = false;
      isClicking = false;
      isPressGlitching = false;
      isHypercubePressing = false;
      hypercubePressProgress = 0;
      isDragging = false;
      isGrabTarget = false;
      isStrataScrubTarget = false;
      isHovering = false;
      isCreditsTriggerActive = false;
      isLedgerHoverTarget = false;
      pressGlitchUntil = 0;
      cursor.classList.remove("is-hypercube-pressing");
      cursor.classList.add("is-cardstream-cursor");
      cursor.classList.remove(
        "is-ledger-hovering",
        "is-ledger-pressing",
        "is-ledger-context-pressing"
      );
      cursor.style.setProperty("--press-progress", "0");
      cursor.style.setProperty("--cursor-shadow", defaultShadow);
      updateInteractionState();
    }

    function startDragCursorState() {
      isDragging = true;
      isGrabTarget = false;
      isHovering = false;
      hoverScale = 1;
      snapActive = false;
      updateInteractionState();
    }

    function endDragCursorState() {
      isDragging = false;
      const target = document.elementFromPoint(targetX, targetY);
      updatePointerInteraction(target);
      updateInteractionState();
    }

    function updateCreditsTriggerState(event) {
      isCreditsTriggerActive = Boolean(event.detail?.active);
      updateInteractionState();
    }

    function updatePointerInteraction(target) {
      const stage = document.getElementById("hypercube-stage");
      const isCardStreamActive = Boolean(
        stage?.classList.contains("is-hypercube-bursting")
      );
      const isCardStreamCursorActive =
        isCardStreamActive &&
        !document.body.classList.contains("is-archive-overlay-open");
      isGrabTarget =
        !isDragging &&
        target instanceof Element &&
        Boolean(target.closest(".archive-media-window__bar"));
      isStrataScrubTarget =
        !isDragging &&
        target instanceof Element &&
        Boolean(target.closest(".strata__fault-control"));
      isHovering =
        !isDragging &&
        Boolean(stage?.classList.contains("is-hypercube-hovered"));
      isLedgerHoverTarget =
        isCardStreamCursorActive &&
        !isDragging &&
        target instanceof Element &&
        Boolean(target.closest(".archive-card-model"));
      cursor.classList.toggle(
        "is-ledger-hovering",
        isLedgerHoverTarget
      );
      hoverScale =
        !isCardStreamCursorActive && !isDragging && isHoverElement(target)
          ? 1.8
          : 1;
    }

    function updateInteractionState() {
      const state = isDragging
        ? "drag"
        : isStrataScrubTarget
          ? "scrub"
        : isGrabTarget
          ? "grab"
          : (snapActive || isHypercubePressing)
            ? "hold"
            : isCreditsTriggerActive
              ? "stay"
              : isHovering
                ? "hover"
                : "";

      cursor.dataset.interaction = state;
      if (interactionLabel) {
        interactionLabel.textContent =
          state === "hold" ? "HOLD" :
          state === "drag" ? "DRAG" :
          state === "scrub" ? "SCRUB" :
          state === "grab" ? "GRAB" :
          state === "hover" ? "HOVER" :
          state === "stay" ? "STAY" : "";
      }
    }

    function updateCursorSnap(event) {
      const detail = event.detail || {};
      const wasHoldLocked = snapActive || isHypercubePressing;
      snapActive = Boolean(detail.active);

      if (snapActive) {
        snapX = Number(detail.x) || 0;
        snapY = Number(detail.y) || 0;
      }
      if (wasHoldLocked && !snapActive && !isHypercubePressing) {
        releaseHoldLock();
      }
      updateInteractionState();
    }

    function releaseHoldLock() {
      previousTargetX = targetX;
      previousTargetY = targetY;
      targetX = physicalPointerX;
      targetY = physicalPointerY;
    }

    function updateCursorSize() {
      const scale = window.innerHeight / desktopReferenceHeight;
      const outerSize = snapEvenPixel(desktopOuterSize * scale);
      const dotSize = snapEvenPixel(desktopDotSize * scale);
      cursorOuterSize = outerSize;

      cursor.style.setProperty("--cursor-outer-size", `${outerSize}px`);
      cursor.style.setProperty("--cursor-outer-half-size", `${outerSize / 2}px`);
      cursor.style.setProperty("--cursor-outer-scaled-half-size", `${(outerSize * renderHoverScale) / 2}px`);
      cursor.style.setProperty("--cursor-dot-size", `${dotSize}px`);
      cursor.style.setProperty("--cursor-dot-half-size", `${dotSize / 2}px`);
    }

    function animateCursor() {
      const isHoldLocked = snapActive || isHypercubePressing;
      if (snapActive) {
        targetX = snapX;
        targetY = snapY;
      }

      dotX += (targetX - dotX) * 0.34;
      dotY += (targetY - dotY) * 0.34;
      if (isHoldLocked) {
        // Pin the outer ring (long-press range) onto the inner dot so the two
        // cursor circles stay concentric with the snapped red center dot.
        outerX = dotX;
        outerY = dotY;
      } else {
        outerX += (dotX - outerX) * 0.18;
        outerY += (dotY - outerY) * 0.18;
      }
      renderHoverScale += (hoverScale - renderHoverScale) * 0.16;

      if (Math.abs(targetX - dotX) < 0.01) dotX = targetX;
      if (Math.abs(targetY - dotY) < 0.01) dotY = targetY;
      if (Math.abs(dotX - outerX) < 0.01) outerX = dotX;
      if (Math.abs(dotY - outerY) < 0.01) outerY = dotY;
      if (Math.abs(hoverScale - renderHoverScale) < 0.001) renderHoverScale = hoverScale;

      renderCursor();
      updatePressGlitch(performance.now());
      updateScreenGlitch(performance.now());
      animationFrame = requestAnimationFrame(animateCursor);
    }

    function startAnimation() {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(animateCursor);
    }

    function stopGlitch() {
      if (isMoving) return;

      isMoving = true;
      setTimeout(() => {
        if (isPressing || performance.now() < pressGlitchUntil) {
          isMoving = false;
          return;
        }

        cursor.style.setProperty("--cursor-shadow", defaultShadow);
        isMoving = false;
      }, 50);
    }

    function syncPointer(x, y) {
      physicalPointerX = x;
      physicalPointerY = y;
      targetX = x;
      targetY = y;
      dotX = targetX;
      dotY = targetY;
      outerX = targetX;
      outerY = targetY;
      previousTargetX = targetX;
      previousTargetY = targetY;
      hasPointerPosition = true;
      renderCursor();
      startAnimation();
    }

    function updatePressGlitch(now) {
      if (isPressing || now < pressGlitchUntil) {
        applyPressGlitch(now);
        return;
      }

      if (isPressGlitching) {
        cursor.style.setProperty("--cursor-shadow", defaultShadow);
        isPressGlitching = false;
      }
    }

    function applyPressGlitch(now) {
      const x = Math.round(Math.sin(now * 0.095) * 5 + Math.sin(now * 0.033) * 2);
      const y = Math.round(Math.cos(now * 0.081) * 4 + Math.sin(now * 0.047) * 2);
      cursor.style.setProperty("--cursor-shadow", `
        ${x}px ${y}px 0 #00F5FF,
        ${-x}px ${-y}px 0 #FF2DA6
      `);
      isPressGlitching = true;
    }

    function updateScreenGlitch(now) {
      if (isScreenPressing || now < screenGlitchUntil) {
        applyScreenGlitch();
        return;
      }

      screenGlitch?.classList.remove("is-active");
      document.body.classList.remove("is-screen-glitching");
    }

    function applyScreenGlitch() {
      screenGlitch?.classList.add("is-active");
      document.body.classList.add("is-screen-glitching");
    }

    function isHoverElement(target) {
      if (isDragging || document.getElementById("hypercube-stage")?.classList.contains("is-observation-dragging")) {
        return false;
      }
      if (!(target instanceof Element)) return false;

      return Boolean(
        target.closest("button, a, .hoverable, .curzr-hover")
      );
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function snapEvenPixel(value) {
      return Math.max(2, Math.round(value / 2) * 2);
    }

    function mixColor(from, to, amount) {
      const a = hexToRgb(from);
      const b = hexToRgb(to);
      const t = clamp(amount, 0, 1);
      const r = Math.round(a.r + (b.r - a.r) * t);
      const g = Math.round(a.g + (b.g - a.g) * t);
      const blue = Math.round(a.b + (b.b - a.b) * t);

      return `rgb(${r}, ${g}, ${blue})`;
    }

    function hexToRgb(hex) {
      const value = Number.parseInt(hex.replace("#", ""), 16);

      return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
      };
    }
  }
})();
