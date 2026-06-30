(function () {
  document.addEventListener("DOMContentLoaded", initCursor);

  function initCursor() {
    const cursor = document.querySelector(".curzr");
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
    const desktopDotSize = 6;
    let targetX = 0;
    let targetY = 0;
    let dotX = 0;
    let dotY = 0;
    let outerX = 0;
    let outerY = 0;
    let previousTargetX = 0;
    let previousTargetY = 0;
    let hoverScale = 1;
    let isClicking = false;
    let isMoving = false;
    let isPressing = false;
    let isPressGlitching = false;
    let pressGlitchUntil = 0;
    let isScreenPressing = false;
    let screenGlitchUntil = 0;
    let hasPointerPosition = false;
    let animationFrame = null;
    let cursorOuterSize = desktopOuterSize;

    cursor.removeAttribute("hidden");
    screenGlitch?.removeAttribute("hidden");
    document.addEventListener("mousemove", moveCursor);
    document.addEventListener("pointerdown", startPressGlitch);
    document.addEventListener("pointerup", endPressGlitch);
    document.addEventListener("pointercancel", endPressGlitch);
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("resize", updateCursorSize);
    window.addEventListener("blur", endPressGlitch);
    updateCursorSize();

    function moveCursor(event) {
      const nextPointerX = event.clientX;
      const nextPointerY = event.clientY;

      if (!hasPointerPosition) {
        syncPointer(nextPointerX, nextPointerY);
        return;
      } else {
        previousTargetX = targetX;
        previousTargetY = targetY;
        targetX = nextPointerX;
        targetY = nextPointerY;
      }

      const distanceX = clamp(previousTargetX - targetX, -10, 10);
      const distanceY = clamp(previousTargetY - targetY, -10, 10);
      hoverScale = isHoverTarget(event) ? 1.8 : 1;

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
        isScreenPressing = true;
        screenGlitchUntil = performance.now() + 140;
        applyScreenGlitch();
        return;
      }

      isPressing = true;
      pressGlitchUntil = performance.now() + 140;
      isClicking = true;
      applyPressGlitch(performance.now());
      renderCursor();

      setTimeout(() => {
        isClicking = false;
        renderCursor();
      }, 35);
    }

    function endPressGlitch() {
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
      const renderScale = hoverScale * clickScale;
      cursor.style.setProperty("--dot-x", `${dotX}px`);
      cursor.style.setProperty("--dot-y", `${dotY}px`);
      cursor.style.setProperty("--outer-x", `${outerX}px`);
      cursor.style.setProperty("--outer-y", `${outerY}px`);
      cursor.style.setProperty("--cursor-render-scale", renderScale);
      cursor.style.setProperty("--cursor-outer-scaled-half-size", `${(cursorOuterSize * renderScale) / 2}px`);
    }

    function updateCursorSize() {
      const scale = window.innerHeight / desktopReferenceHeight;
      const outerSize = desktopOuterSize * scale;
      const dotSize = desktopDotSize * scale;
      cursorOuterSize = outerSize;

      cursor.style.setProperty("--cursor-outer-size", `${outerSize}px`);
      cursor.style.setProperty("--cursor-outer-half-size", `${outerSize / 2}px`);
      cursor.style.setProperty("--cursor-outer-scaled-half-size", `${(outerSize * hoverScale) / 2}px`);
      cursor.style.setProperty("--cursor-dot-size", `${dotSize}px`);
      cursor.style.setProperty("--cursor-dot-half-size", `${dotSize / 2}px`);
    }

    function animateCursor() {
      dotX += (targetX - dotX) * 0.34;
      dotY += (targetY - dotY) * 0.34;
      outerX += (dotX - outerX) * 0.18;
      outerY += (dotY - outerY) * 0.18;

      if (Math.abs(targetX - dotX) < 0.01) dotX = targetX;
      if (Math.abs(targetY - dotY) < 0.01) dotY = targetY;
      if (Math.abs(dotX - outerX) < 0.01) outerX = dotX;
      if (Math.abs(dotY - outerY) < 0.01) outerY = dotY;

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
      const x = Math.round(Math.sin(now * 0.095) * 9 + Math.sin(now * 0.033) * 4);
      const y = Math.round(Math.cos(now * 0.081) * 7 + Math.sin(now * 0.047) * 3);

      cursor.style.setProperty("--cursor-shadow", `
        ${x}px ${y}px 0 ${glitchColorB},
        ${-x}px ${-y}px 0 ${glitchColorR}
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

    function isHoverTarget(event) {
      const target = event.target;
      if (!(target instanceof Element)) return false;

      return Boolean(
        target.closest("button, a, .hoverable, .curzr-hover") ||
          document.querySelector(".is-hypercube-hovered")
      );
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
  }
})();
