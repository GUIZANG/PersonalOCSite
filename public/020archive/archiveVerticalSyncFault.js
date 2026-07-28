(function () {
  const INITIAL_MIN_DELAY = 250;
  const INITIAL_MAX_DELAY = 4000;
  const MIN_DELAY = 8000;
  const MAX_DELAY = 15000;
  const SHIFT = 300;
  const FAULT_DURATION = 78;
  const SVG_NS = "http://www.w3.org/2000/svg";

  function initVerticalSyncFault() {
    const stage = document.getElementById("hypercube-stage");
    if (!stage) return;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "fixed";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.pointerEvents = "none";

    const defs = document.createElementNS(SVG_NS, "defs");
    const filter = document.createElementNS(SVG_NS, "filter");
    const filterId = "archive-ambient-vertical-sync";
    filter.id = filterId;
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const shifted = document.createElementNS(SVG_NS, "feOffset");
    shifted.setAttribute("in", "SourceGraphic");
    shifted.setAttribute("result", "shifted");

    const wrapped = document.createElementNS(SVG_NS, "feOffset");
    wrapped.setAttribute("in", "SourceGraphic");
    wrapped.setAttribute("result", "wrapped");

    const merge = document.createElementNS(SVG_NS, "feMerge");
    const shiftedNode = document.createElementNS(SVG_NS, "feMergeNode");
    const wrappedNode = document.createElementNS(SVG_NS, "feMergeNode");
    shiftedNode.setAttribute("in", "shifted");
    wrappedNode.setAttribute("in", "wrapped");
    merge.append(shiftedNode, wrappedNode);

    filter.append(shifted, wrapped, merge);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.setAttribute("aria-hidden", "true");
    noiseCanvas.style.position = "fixed";
    noiseCanvas.style.inset = "0";
    noiseCanvas.style.zIndex = "2147483645";
    noiseCanvas.style.width = "100%";
    noiseCanvas.style.height = "100%";
    noiseCanvas.style.opacity = "0";
    noiseCanvas.style.pointerEvents = "none";
    noiseCanvas.style.imageRendering = "pixelated";
    noiseCanvas.style.mixBlendMode = "normal";
    document.body.appendChild(noiseCanvas);

    let active = false;
    let nextTimer = 0;
    let clearTimer = 0;
    let staticRefreshTimer = 0;
    let activeTargets = [];
    let hasTriggered = false;

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function getTargets() {
      return [
        stage,
        document.getElementById("archiveOverlayPage"),
        document.querySelector(".archive-interface-morph"),
      ].filter(Boolean);
    }

    function restoreTargets() {
      activeTargets.forEach(({ element, previousFilter }) => {
        element.style.filter = previousFilter;
      });
      activeTargets = [];
      noiseCanvas.style.opacity = "0";
      active = false;
    }

    function drawSignalEye(context, width, height, bands) {
      const anchorBand = [...bands].sort(
        (a, b) => b.strength * b.height - a.strength * a.height
      )[0];
      const eyeWidth = Math.min(width * randomBetween(0.24, 0.34), 230);
      const eyeHeight = eyeWidth * randomBetween(0.2, 0.25);
      const centerX = width * randomBetween(0.38, 0.65);
      const centerY = Math.min(
        height - eyeHeight,
        Math.max(
          eyeHeight,
          anchorBand.top + anchorBand.height * randomBetween(0.35, 0.7)
        )
      );
      const left = centerX - eyeWidth * 0.5;
      const top = centerY - eyeHeight * 0.5;
      const sliceCount = 8;
      const sliceHeight = eyeHeight / sliceCount;

      for (let index = 0; index < sliceCount; index += 1) {
        const sliceY = top + index * sliceHeight;
        const jitterX = randomBetween(-7, 7);

        context.save();
        context.beginPath();
        context.rect(
          left - 12,
          sliceY,
          eyeWidth + 24,
          sliceHeight + 1
        );
        context.clip();
        context.translate(jitterX, 0);

        context.lineCap = "butt";
        context.lineWidth = randomBetween(1, 2.4);
        context.strokeStyle =
          `rgba(236, 236, 236, ${randomBetween(0.13, 0.24)})`;
        context.beginPath();
        context.moveTo(left, centerY);
        context.quadraticCurveTo(
          centerX,
          centerY - eyeHeight,
          left + eyeWidth,
          centerY
        );
        context.quadraticCurveTo(
          centerX,
          centerY + eyeHeight * 0.86,
          left,
          centerY
        );
        context.stroke();

        context.lineWidth = randomBetween(1, 2);
        context.strokeStyle =
          `rgba(0, 0, 0, ${randomBetween(0.18, 0.34)})`;
        context.beginPath();
        context.ellipse(
          centerX + randomBetween(-2, 2),
          centerY,
          eyeHeight * 0.42,
          eyeHeight * 0.46,
          0,
          0,
          Math.PI * 2
        );
        context.stroke();

        context.fillStyle =
          `rgba(0, 0, 0, ${randomBetween(0.2, 0.38)})`;
        context.beginPath();
        context.ellipse(
          centerX + randomBetween(-1.5, 1.5),
          centerY,
          eyeHeight * 0.14,
          eyeHeight * 0.32,
          0,
          0,
          Math.PI * 2
        );
        context.fill();
        context.restore();
      }

      // Break the recognizable outline back into the signal field. These
      // streaks obscure enough structure that the eye is perceived only after
      // it has already disappeared.
      for (let index = 0; index < 11; index += 1) {
        const gray = Math.random() < 0.5 ? 12 : 226;
        context.fillStyle =
          `rgba(${gray}, ${gray}, ${gray}, ${randomBetween(0.12, 0.3)})`;
        context.fillRect(
          left + randomBetween(-10, eyeWidth * 0.25),
          top + Math.random() * eyeHeight,
          eyeWidth * randomBetween(0.24, 0.88),
          randomBetween(0.7, 2.2)
        );
      }
    }

    function renderAnalogStatic(width, height, revealEye = false) {
      const rasterWidth = Math.min(720, Math.max(320, Math.round(width * 0.42)));
      const rasterHeight = Math.min(405, Math.max(180, Math.round(height * 0.42)));
      if (
        noiseCanvas.width !== rasterWidth ||
        noiseCanvas.height !== rasterHeight
      ) {
        noiseCanvas.width = rasterWidth;
        noiseCanvas.height = rasterHeight;
      }

      const context = noiseCanvas.getContext("2d", { alpha: true });
      if (!context) return;

      const broadBands = Array.from({ length: 5 }, () => ({
        top: Math.floor(Math.random() * rasterHeight),
        height: Math.max(5, Math.floor(randomBetween(0.025, 0.11) * rasterHeight)),
        strength: randomBetween(0.32, 0.86),
      }));
      const rowStrength = new Float32Array(rasterHeight);

      broadBands.forEach((band) => {
        const bottom = Math.min(rasterHeight, band.top + band.height);
        for (let y = band.top; y < bottom; y += 1) {
          const edge = Math.min(y - band.top, bottom - y - 1);
          const edgeFade = Math.min(1, Math.max(0.18, edge / 5));
          rowStrength[y] = Math.max(rowStrength[y], band.strength * edgeFade);
        }
      });

      for (let y = 0; y < rasterHeight; y += 1) {
        if (Math.random() < 0.085) {
          rowStrength[y] = Math.max(rowStrength[y], randomBetween(0.18, 0.5));
        }
      }

      const image = context.createImageData(rasterWidth, rasterHeight);
      for (let y = 0; y < rasterHeight; y += 1) {
        const strength = Math.max(0.025, rowStrength[y]);
        for (let x = 0; x < rasterWidth; x += 1) {
          const index = (y * rasterWidth + x) * 4;
          const streak =
            Math.random() < 0.16
              ? Math.random() < 0.5 ? 0 : 255
              : Math.floor(randomBetween(42, 214));
          const alpha =
            strength *
            randomBetween(0.16, 0.88) *
            (Math.random() < 0.055 ? 1.5 : 1);
          image.data[index] = streak;
          image.data[index + 1] = streak;
          image.data[index + 2] = streak;
          image.data[index + 3] = Math.min(255, Math.round(alpha * 255));
        }
      }
      context.putImageData(image, 0, 0);

      if (revealEye) {
        drawSignalEye(context, rasterWidth, rasterHeight, broadBands);
      }

      // Broad dropout bars anchor the random snow so the result reads as an
      // unstable television field rather than a generic grain overlay.
      const dropoutCount = 3 + Math.floor(Math.random() * 3);
      for (let index = 0; index < dropoutCount; index += 1) {
        const barY = Math.floor(Math.random() * rasterHeight);
        const barHeight = Math.max(2, Math.floor(randomBetween(0.01, 0.055) * rasterHeight));
        const gray = Math.random() < 0.48
          ? Math.floor(randomBetween(0, 28))
          : Math.floor(randomBetween(210, 255));
        context.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${randomBetween(0.48, 0.9)})`;
        context.fillRect(0, barY, rasterWidth, barHeight);
      }

      context.fillStyle = "rgba(255, 255, 255, 0.14)";
      for (
        let y = Math.floor(Math.random() * 5);
        y < rasterHeight;
        y += 5 + Math.floor(Math.random() * 4)
      ) {
        context.fillRect(0, y, rasterWidth, 1);
      }

      const streakCount = 12 + Math.floor(Math.random() * 12);
      for (let index = 0; index < streakCount; index += 1) {
        const gray = Math.random() < 0.5 ? 8 : 238;
        context.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${randomBetween(0.18, 0.5)})`;
        context.fillRect(
          Math.floor(Math.random() * rasterWidth * 0.3),
          Math.floor(Math.random() * rasterHeight),
          Math.floor(randomBetween(0.2, 0.95) * rasterWidth),
          1 + Math.floor(Math.random() * 3)
        );
      }
    }

    function scheduleNext() {
      window.clearTimeout(nextTimer);
      const delay = hasTriggered
        ? randomBetween(MIN_DELAY, MAX_DELAY)
        : randomBetween(INITIAL_MIN_DELAY, INITIAL_MAX_DELAY);
      nextTimer = window.setTimeout(
        triggerFault,
        delay
      );
    }

    function triggerFault() {
      if (
        document.hidden ||
        active ||
        document.body.classList.contains("is-screen-glitching")
      ) {
        nextTimer = window.setTimeout(
          triggerFault,
          hasTriggered
            ? randomBetween(700, 1300)
            : randomBetween(120, 360)
        );
        return;
      }

      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        hasTriggered = true;
        scheduleNext();
        return;
      }

      hasTriggered = true;
      active = true;
      const shift = SHIFT;
      const width = window.innerWidth || document.documentElement.clientWidth;
      const height = window.innerHeight || document.documentElement.clientHeight;

      filter.setAttribute("x", "0");
      filter.setAttribute("y", "0");
      filter.setAttribute("width", String(width));
      filter.setAttribute("height", String(height));
      shifted.setAttribute("dx", "0");
      shifted.setAttribute("dy", String(-shift));
      wrapped.setAttribute("dx", "0");
      wrapped.setAttribute("dy", String(height - shift));

      activeTargets = getTargets().map((element) => ({
        element,
        previousFilter: element.style.filter,
      }));
      activeTargets.forEach(({ element }) => {
        element.style.filter = `url("#${filterId}")`;
      });
      renderAnalogStatic(width, height, true);
      noiseCanvas.style.opacity = "0.58";

      staticRefreshTimer = window.setTimeout(() => {
        renderAnalogStatic(width, height, false);
        noiseCanvas.style.opacity = "0.5";
      }, 34);

      clearTimer = window.setTimeout(() => {
        window.clearTimeout(staticRefreshTimer);
        restoreTargets();
        scheduleNext();
      }, FAULT_DURATION);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.clearTimeout(nextTimer);
        window.clearTimeout(clearTimer);
        window.clearTimeout(staticRefreshTimer);
        restoreTargets();
        return;
      }
      scheduleNext();
    });

    scheduleNext();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVerticalSyncFault);
  } else {
    initVerticalSyncFault();
  }
})();
