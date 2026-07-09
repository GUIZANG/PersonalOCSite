// Homepage top-edge overlay. Same interaction/mask/readout logic as the Main
// scene overlay (awakeOverlay.js): move the pointer to the top edge to pull the
// panel down, to the bottom edge to retract it. The only difference is the
// background: instead of a CSS star field it renders the shared horizon scene
// locked to the Twilight preset.
import { createHorizonScene } from "./horizonScene.js";

function initHomepageOverlay() {
  const overlay = document.getElementById("awakeOverlayPage");
  const overlayContent = overlay?.querySelector(".awake-overlay-page__inner");
  const scrollLine = document.getElementById("awakeOverlayScrollLine");
  const scrollPercent = document.getElementById("awakeOverlayScrollPercent");
  const coordReadout = document.getElementById("awakeOverlayCoordReadout");
  const scanReadoutState = document.getElementById("awakeOverlayScanReadoutState");
  const maskPath = document.getElementById("awakeOverlayMaskPath");
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
  let horizon = null;

  setupHorizonBackground();
  render();
  document.addEventListener("pointermove", onPointerMove);
  overlayContent?.addEventListener("scroll", updateScrollLine);
  window.addEventListener("resize", () => {
    render();
    updateScrollLine();
  });

  function onPointerMove(event) {
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
    overlay.style.setProperty("--awake-overlay-edge-y", `${shape.edgeY * 100}%`);
    overlay.style.setProperty("--awake-overlay-edge-shadow", progress > 0.03 && progress < 0.98 ? "0.9" : "0");
    overlay.style.setProperty("--awake-overlay-opacity", isOpen ? "1" : "0");
    overlay.style.setProperty("--awake-overlay-pointer-events", isOpen ? "auto" : "none");
    overlay.style.setProperty("--awake-overlay-readout-opacity", isOpen ? "1" : "0");
    document.body.classList.toggle("is-awake-overlay-open", isOpen);
    // Only render the horizon background while the overlay is visible.
    if (isOpen) horizon?.start();
    else horizon?.stop();
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

    overlay.style.setProperty("--awake-overlay-scroll-progress", format(scrollProgress));
    overlay.style.setProperty("--awake-overlay-scroll-opacity", hasScroll && progress > 0.01 ? "1" : "0");
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

  function setupHorizonBackground() {
    const bg = document.createElement("div");
    bg.className = "awake-overlay-horizon";
    overlay.insertBefore(bg, overlay.firstElementChild);
    horizon = createHorizonScene({ container: bg });
    horizon.applyPreset("Twilight");
    horizon.stop();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomepageOverlay);
} else {
  initHomepageOverlay();
}
