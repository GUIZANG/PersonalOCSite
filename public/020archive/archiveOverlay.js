// Archive interface-metamorphosis CREDITS overlay. Dwell at the top edge to
// freeze the observation system and remap its windows into the credit index.
// Move to the bottom edge to restore the original interface.
(function () {
  function initArchiveOverlay() {
    const overlay = document.getElementById("archiveOverlayPage");
    const overlayContent = overlay?.querySelector(".archive-overlay-page__inner");
    const scrollLine = document.getElementById("archiveOverlayScrollLine");
    const exitHint = overlay?.querySelector(".archive-overlay-exit-hint");
    const maskPath = document.getElementById("archiveOverlayMaskPath");
    const stage = document.getElementById("hypercube-stage");
    const topTriggerRail = stage?.querySelector(
      ".strata-edge-bus--top .strata-edge-bus__rail"
    );
    const creditItems = Array.from(
      overlay?.querySelectorAll(".archive-overlay-credits li") || []
    );
    if (!overlay || !maskPath || !stage || !creditItems.length) return;
    const retractThreshold = 60;
    const expandDwell = 2000;
    const expandDuration = 1180;
    const retractDuration = 1280;
    const morph = createMorphLayer();

    let dwellTimer = null;
    let progress = 0;
    let startProgress = 0;
    let targetProgress = 0;
    let animationStart = 0;
    let animationDuration = expandDuration;
    let animationFrame = null;
    let disabled = false;
    let creditsTriggerActive = false;
    let pointerPressed = false;
    let sourceRects = [];
    let targetRects = [];
    let copySourceRect = null;
    let copyTargetRect = null;

    render();
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerRelease);
    document.addEventListener("pointercancel", onPointerRelease);
    overlayContent?.addEventListener("scroll", updateScrollLine);
    window.addEventListener("resize", onResize, { passive: true });
    watchForBurst();

    function createMorphLayer() {
      const layer = document.createElement("div");
      layer.className = "archive-interface-morph";
      layer.setAttribute("aria-hidden", "true");

      const depthField = document.createElement("div");
      depthField.className = "archive-interface-morph__depth-field";
      layer.appendChild(depthField);

      const depthWatermark = document.createElement("div");
      depthWatermark.className = "archive-interface-morph__depth-watermark";
      depthWatermark.textContent = "CREDITS";
      layer.appendChild(depthWatermark);

      const cards = creditItems.map((item, index) => {
        const title = item.querySelector(":scope > span")?.textContent?.trim() || "";
        const link = item.querySelector("a")?.textContent?.trim() || "";
        const card = document.createElement("article");
        card.className = "archive-interface-morph__card";
        card.style.setProperty("--morph-order", index);
        card.innerHTML = [
          '<canvas class="archive-interface-morph__snapshot"></canvas>',
          '<span class="archive-interface-morph__source"></span>',
          '<span class="archive-interface-morph__resolved">',
          `<i>${title}</i>`,
          `<b>${link}</b>`,
          "</span>",
        ].join("");
        layer.appendChild(card);
        return {
          card,
          snapshot: card.querySelector(".archive-interface-morph__snapshot"),
          source: card.querySelector(".archive-interface-morph__source"),
          resolved: card.querySelector(".archive-interface-morph__resolved"),
        };
      });

      const copy = document.createElement("div");
      copy.className = "archive-interface-morph__copy";
      copy.innerHTML = [
        '<div class="archive-interface-morph__copy-source" aria-hidden="true"></div>',
        '<div class="archive-interface-morph__copy-resolved">',
        "<strong>ARCHIVE / ACKNOWLEDGEMENTS / 007</strong>",
        "<span>Precognitive Strata is an independent visual experiment assembled from public studies, interface references and original interaction work.</span>",
        "</div>",
      ].join("");
      layer.appendChild(copy);
      document.body.appendChild(layer);

      return {
        layer,
        depthField,
        depthWatermark,
        depthBands: [],
        depthNoise: null,
        cards,
        copy,
        copySource: copy.querySelector(".archive-interface-morph__copy-source"),
        copyResolved: copy.querySelector(".archive-interface-morph__copy-resolved"),
      };
    }

    function onPointerMove(event) {
      if (disabled) return;
      const height = window.innerHeight || document.documentElement.clientHeight;

      const topRailRect = topTriggerRail?.getBoundingClientRect();
      const expandThreshold = topRailRect
        ? topRailRect.top + topRailRect.height * 0.5
        : 10;
      const isInsideTrigger = event.clientY <= expandThreshold;
      const canRemap =
        !pointerPressed &&
        progress <= 0.001 &&
        targetProgress === 0;
      updateCreditsTrigger(isInsideTrigger && canRemap);

      if (isInsideTrigger && canRemap) {
        scheduleExpand();
      } else {
        cancelDwell();
        if (event.clientY >= height - retractThreshold) animateTo(0);
      }
    }

    function onPointerDown(event) {
      if (disabled) return;
      pointerPressed = true;
      cancelDwell();
      updateCreditsTrigger(false);

      if (event.pointerType === "mouse") return;
      const height = window.innerHeight || document.documentElement.clientHeight;
      const touchEdge = 44;

      if (event.clientY <= touchEdge && progress <= 0.001) {
        animateTo(1);
      } else if (event.clientY >= height - touchEdge && progress >= 0.999) {
        animateTo(0);
      }
    }

    function onPointerRelease() {
      pointerPressed = false;
    }

    function updateCreditsTrigger(active) {
      if (creditsTriggerActive === active) return;
      creditsTriggerActive = active;
      window.dispatchEvent(new CustomEvent("archive:credits-trigger", {
        detail: { active },
      }));
    }

    function scheduleExpand() {
      if (targetProgress === 1 || dwellTimer) return;
      dwellTimer = window.setTimeout(() => {
        dwellTimer = null;
        updateCreditsTrigger(false);
        animateTo(1);
      }, expandDwell);
    }

    function cancelDwell() {
      if (!dwellTimer) return;
      window.clearTimeout(dwellTimer);
      dwellTimer = null;
    }

    function animateTo(nextTarget) {
      if (targetProgress === nextTarget && animationFrame) return;
      if (targetProgress === nextTarget && progress === nextTarget) return;

      if (nextTarget === 1 && progress <= 0.001) captureMorphGeometry();
      if (nextTarget === 0 && progress >= 0.999) refreshDepthField();
      if (!sourceRects.length || !targetRects.length) captureMorphGeometry();

      startProgress = progress;
      targetProgress = nextTarget;
      animationDuration = nextTarget > startProgress ? expandDuration : retractDuration;
      animationStart = performance.now();
      startAnimation();
    }

    function startAnimation() {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick);
    }

    function tick(now) {
      const elapsed = now - animationStart;
      const amount = Math.min(elapsed / animationDuration, 1);
      const easedAmount = easeInOutCubic(amount);
      progress = startProgress + (targetProgress - startProgress) * easedAmount;
      render();

      if (amount < 1) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      progress = targetProgress;
      animationFrame = null;
      render();
    }

    function captureMorphGeometry() {
      const observationWindows = Array.from(
        stage.querySelectorAll(".archive-media-window")
      );
      const sourceCanvas = stage.querySelector(".archive-hypercube-source");
      const center = {
        left: window.innerWidth * 0.5 - 34,
        top: window.innerHeight * 0.5 - 20,
        width: 68,
        height: 40,
      };

      sourceRects = creditItems.map((_, index) => {
        const sourceWindow = observationWindows[index];
        if (!sourceWindow) {
          const offset = (index - observationWindows.length) * 18;
          morph.cards[index].source.textContent =
            index === 5 ? "SOURCE LINK / 06" : "REFERENCE NODE / 07";
          clearSnapshot(morph.cards[index].snapshot);
          return {
            left: center.left + offset,
            top: center.top + offset * 0.45,
            width: center.width,
            height: center.height,
          };
        }
        const rect = sourceWindow.getBoundingClientRect();
        morph.cards[index].source.textContent =
          sourceWindow.querySelector(
            ".archive-media-window__bar > span:first-of-type"
          )?.textContent?.trim() || `WINDOW / 0${index + 1}`;
        const barRect = sourceWindow
          .querySelector(".archive-media-window__bar")
          ?.getBoundingClientRect();
        morph.cards[index].card.style.setProperty(
          "--morph-bar-height",
          `${barRect?.height || 22}px`
        );
        captureWindowSnapshot(
          morph.cards[index].snapshot,
          sourceCanvas,
          sourceWindow.querySelector(".archive-media-window__viewport")
        );
        return rectToObject(rect);
      });

      targetRects = creditItems.map((item) => {
        const rect = item.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          width: Math.max(180, rect.width),
          height: Math.max(34, rect.height),
        };
      });

      const record = stage.querySelector(".strata__record");
      const targetCopy = overlay.querySelector(".archive-overlay-page__header");
      copySourceRect = record
        ? rectToObject(record.getBoundingClientRect())
        : { left: 30, top: window.innerHeight - 160, width: 420, height: 110 };
      copyTargetRect = targetCopy
        ? rectToObject(targetCopy.getBoundingClientRect())
        : { left: 80, top: window.innerHeight * 0.4, width: 420, height: 110 };
    }

    function render() {
      const closing = targetProgress === 0 && progress > 0.001;
      const closeAmount = 1 - progress;
      const pageOpacity = closing
        ? 1 - clamp01((closeAmount - 0.04) / 0.48)
        : clamp01((progress - 0.52) / 0.34);
      const isPageVisible = pageOpacity > 0.01;
      maskPath.setAttribute("d", "M0 0 H1 V1 H0 Z");
      overlay.style.setProperty("--archive-overlay-opacity", pageOpacity.toFixed(3));
      overlay.style.setProperty(
        "--archive-overlay-pointer-events",
        targetProgress === 1 && progress > 0.72 ? "auto" : "none"
      );
      overlay.style.setProperty(
        "--archive-overlay-readout-opacity",
        clamp01((progress - 0.72) / 0.2).toFixed(3)
      );
      document.body.classList.toggle("is-archive-overlay-open", isPageVisible);
      overlay.classList.toggle("is-depth-calibrating", closing);
      overlay.setAttribute("aria-hidden", isPageVisible ? "false" : "true");
      updateExitHint(closing, closeAmount);
      updateInterfaceMorph(progress);

      if (progress >= 0.9 && targetProgress === 1) {
        if (!overlay.classList.contains("is-credits-revealed")) {
          overlayContent?.scrollTo({ top: 0, behavior: "auto" });
          overlay.classList.add("is-credits-revealed");
        }
      } else if (progress <= 0.001) {
        overlay.classList.remove("is-credits-revealed");
      }

      updateScrollLine();
    }

    function updateExitHint(closing, closeAmount) {
      if (!exitHint) return;
      if (!closing) {
        exitHint.style.removeProperty("opacity");
        exitHint.style.removeProperty("transform");
        return;
      }

      const exitProgress = easeInOutCubic(clamp01(closeAmount / 0.22));
      exitHint.style.opacity = (1 - exitProgress).toFixed(3);
      exitHint.style.transform =
        `translate(-50%, ${(exitProgress * 5).toFixed(2)}px)`;
    }

    function updateInterfaceMorph(value) {
      const closing = targetProgress === 0 && value > 0.001;
      const closeAmount = 1 - value;
      const sourceFade = closing
        ? clamp01((closeAmount - 0.58) / 0.28)
        : 1 - clamp01((value - 0.025) / 0.12);
      stage.style.setProperty("--archive-morph-source-opacity", sourceFade.toFixed(3));
      stage.classList.toggle("is-credits-morphing", value > 0.001);
      morph.layer.style.opacity = value > 0.001 ? "1" : "0";
      morph.layer.classList.toggle("is-depth-calibrating", closing);

      if (closing) {
        updateClosingMorph(closeAmount);
        return;
      }

      const morphFade = 1 - clamp01((value - 0.87) / 0.12);
      morph.depthField.style.opacity = "0";
      morph.depthWatermark.style.opacity = "0";

      morph.cards.forEach((item, index) => {
        const source = sourceRects[index];
        const target = targetRects[index];
        if (!source || !target) return;

        const delay = index * 0.025;
        const local = easeInOutCubic(
          clamp01((value - 0.07 - delay) / Math.max(0.01, 0.76 - delay))
        );
        const generated = index >= 5
          ? clamp01((value - 0.16 - (index - 5) * 0.05) / 0.12)
          : clamp01(value / 0.07);
        const opacity = generated * morphFade;
        setRectStyle(item.card, interpolateRect(source, target, local));
        item.card.style.opacity = opacity.toFixed(3);
        item.card.style.setProperty("--morph-collapse", local.toFixed(3));

        const snapshotOpacity = index < 5
          ? 1 - clamp01((value - 0.38) / 0.22)
          : 0;
        const sourceOpacity = 1 - clamp01((value - 0.42) / 0.18);
        const resolvedOpacity = clamp01((value - 0.5) / 0.2);
        item.snapshot.style.opacity = snapshotOpacity.toFixed(3);
        item.source.style.opacity = sourceOpacity.toFixed(3);
        item.resolved.style.opacity = resolvedOpacity.toFixed(3);
      });

      if (copySourceRect && copyTargetRect) {
        const copyLocal = easeInOutCubic(clamp01((value - 0.08) / 0.72));
        setRectStyle(
          morph.copy,
          interpolateRect(copySourceRect, copyTargetRect, copyLocal)
        );
        morph.copy.style.opacity = morphFade.toFixed(3);
        morph.copySource.style.opacity =
          (1 - clamp01((value - 0.3) / 0.15)).toFixed(3);
        morph.copyResolved.style.opacity =
          clamp01((value - 0.38) / 0.18).toFixed(3);
      }
    }

    function updateClosingMorph(closeAmount) {
      const fieldFade = 1 - clamp01((closeAmount - 0.74) / 0.18);
      morph.depthField.style.opacity = fieldFade.toFixed(3);
      syncDepthField();

      const bandCount = Math.max(1, morph.depthBands.length);
      morph.depthBands.forEach(({ clone }, index) => {
        const depth = index / Math.max(1, bandCount - 1);
        const revealStart = 0.04 + depth * 0.43;
        const reveal = easeInOutCubic(
          clamp01((closeAmount - revealStart) / 0.14)
        );
        clone.style.opacity = reveal.toFixed(3);
      });

      if (morph.depthNoise) {
        const noiseReveal = clamp01((closeAmount - 0.34) / 0.24);
        morph.depthNoise.style.opacity =
          (noiseReveal * 0.55).toFixed(3);
      }

      const watermarkFade = 1 - clamp01((closeAmount - 0.22) / 0.38);
      const watermarkBlur =
        clamp01((closeAmount - 0.24) / 0.3) * 1.8;
      morph.depthWatermark.style.opacity = "0";
      overlay.style.setProperty(
        "--archive-depth-title-opacity",
        watermarkFade.toFixed(3)
      );
      overlay.style.setProperty(
        "--archive-depth-title-blur",
        `${watermarkBlur.toFixed(2)}px`
      );

      const headerFade = 1 - clamp01((closeAmount - 0.1) / 0.34);
      const headerShift = easeInOutCubic(
        clamp01((closeAmount - 0.1) / 0.36)
      );
      overlay.style.setProperty(
        "--archive-depth-header-opacity",
        headerFade.toFixed(3)
      );
      overlay.style.setProperty(
        "--archive-depth-header-x",
        `${(-headerShift * 4).toFixed(2)}px`
      );

      const footerFade = 1 - clamp01((closeAmount - 0.2) / 0.3);
      overlay.style.setProperty(
        "--archive-depth-footer-opacity",
        footerFade.toFixed(3)
      );
      overlay.style.setProperty(
        "--archive-depth-footer-x",
        `${(clamp01((closeAmount - 0.2) / 0.3) * 4).toFixed(2)}px`
      );

      morph.cards.forEach((item, index) => {
        const fadeStart = 0.12 + index * 0.025;
        const fade = 1 - clamp01((closeAmount - fadeStart) / 0.34);
        const depthShift = easeInOutCubic(
          clamp01((closeAmount - fadeStart) / 0.36)
        );
        const direction = index % 2 === 0 ? -1 : 1;
        creditItems[index]?.style.setProperty(
          "--archive-depth-item-opacity",
          fade.toFixed(3)
        );
        creditItems[index]?.style.setProperty(
          "--archive-depth-item-x",
          `${(direction * depthShift * (3 + index * 0.8)).toFixed(2)}px`
        );
        creditItems[index]?.style.setProperty(
          "--archive-depth-item-y",
          `${(depthShift * (index - 3) * 0.75).toFixed(2)}px`
        );
        item.card.style.opacity = "0";
        item.snapshot.style.opacity = "0";
        item.resolved.style.opacity = "0";
        item.source.style.opacity = "0";
      });

      morph.copy.style.opacity = "0";
      morph.copyResolved.style.opacity = "0";
      morph.copySource.style.opacity = "0";
    }

    function refreshDepthField() {
      const source = stage.querySelector(".strata-frames");
      const title = overlay.querySelector(".archive-overlay-page__backdrop-title");
      if (!source) return;

      const sourceRect = source.getBoundingClientRect();
      setRectStyle(morph.depthField, rectToObject(sourceRect));
      morph.depthField.replaceChildren();
      morph.depthBands = [];
      morph.depthNoise = null;

      Array.from(source.children).forEach((element) => {
        const clone = element.cloneNode(true);
        clone.removeAttribute("id");
        clone.style.opacity = "0";
        morph.depthField.appendChild(clone);
        if (element.classList.contains("strata-frames__noise")) {
          morph.depthNoise = clone;
        } else if (element.classList.contains("strata-frames__band")) {
          morph.depthBands.push({ source: element, clone });
        }
      });

      if (title) {
        const titleRect = title.getBoundingClientRect();
        const titleStyle = getComputedStyle(title);
        setRectStyle(morph.depthWatermark, rectToObject(titleRect));
        morph.depthWatermark.style.fontSize = titleStyle.fontSize;
        morph.depthWatermark.style.lineHeight = titleStyle.lineHeight;
        morph.depthWatermark.style.letterSpacing = titleStyle.letterSpacing;
      }
    }

    function syncDepthField() {
      morph.depthBands.forEach(({ source, clone }) => {
        clone.style.transform = source.style.transform;
        clone.style.background = source.style.background;
      });
      if (morph.depthNoise) {
        const sourceNoise = stage.querySelector(".strata-frames__noise");
        if (sourceNoise) {
          morph.depthNoise.style.backgroundImage =
            sourceNoise.style.backgroundImage;
        }
      }
    }

    function captureWindowSnapshot(snapshot, sourceCanvas, viewport) {
      if (!snapshot || !sourceCanvas || !viewport) {
        clearSnapshot(snapshot);
        return;
      }

      const sourceCanvasRect = sourceCanvas.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (
        sourceCanvasRect.width <= 0 ||
        sourceCanvasRect.height <= 0 ||
        viewportRect.width <= 0 ||
        viewportRect.height <= 0
      ) {
        clearSnapshot(snapshot);
        return;
      }

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(viewportRect.width * pixelRatio));
      const height = Math.max(1, Math.round(viewportRect.height * pixelRatio));
      const sourceScaleX = sourceCanvas.width / sourceCanvasRect.width;
      const sourceScaleY = sourceCanvas.height / sourceCanvasRect.height;
      const sourceX = (viewportRect.left - sourceCanvasRect.left) * sourceScaleX;
      const sourceY = (viewportRect.top - sourceCanvasRect.top) * sourceScaleY;
      const sourceWidth = viewportRect.width * sourceScaleX;
      const sourceHeight = viewportRect.height * sourceScaleY;

      snapshot.width = width;
      snapshot.height = height;
      const context = snapshot.getContext("2d");
      context?.clearRect(0, 0, width, height);
      try {
        context?.drawImage(
          sourceCanvas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          width,
          height
        );
      } catch {
        clearSnapshot(snapshot);
      }
    }

    function clearSnapshot(snapshot) {
      if (!snapshot) return;
      const context = snapshot.getContext("2d");
      context?.clearRect(0, 0, snapshot.width, snapshot.height);
      snapshot.width = 1;
      snapshot.height = 1;
    }

    function setRectStyle(element, rect) {
      element.style.left = `${rect.left.toFixed(2)}px`;
      element.style.top = `${rect.top.toFixed(2)}px`;
      element.style.width = `${Math.max(0, rect.width).toFixed(2)}px`;
      element.style.height = `${Math.max(0, rect.height).toFixed(2)}px`;
    }

    function interpolateRect(from, to, amount) {
      return {
        left: lerp(from.left, to.left, amount),
        top: lerp(from.top, to.top, amount),
        width: lerp(from.width, to.width, amount),
        height: lerp(from.height, to.height, amount),
      };
    }

    function rectToObject(rect) {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    function onResize() {
      captureMorphGeometry();
      refreshDepthField();
      render();
      updateScrollLine();
    }

    function easeInOutCubic(value) {
      return value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    function clamp01(value) {
      return Math.min(1, Math.max(0, value));
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
      overlay.style.setProperty(
        "--archive-overlay-scroll-progress",
        format(scrollProgress)
      );
      overlay.style.setProperty(
        "--archive-overlay-scroll-opacity",
        hasScroll && progress > 0.7 ? "1" : "0"
      );
    }

    function watchForBurst() {
      if (stage.classList.contains("is-hypercube-bursting")) {
        disableOverlay();
        return;
      }
      const observer = new MutationObserver(() => {
        if (!stage.classList.contains("is-hypercube-bursting")) return;
        disableOverlay();
        observer.disconnect();
      });
      observer.observe(stage, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function disableOverlay() {
      disabled = true;
      updateCreditsTrigger(false);
      cancelDwell();
      animateTo(0);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerRelease);
      document.removeEventListener("pointercancel", onPointerRelease);
      window.removeEventListener("resize", onResize);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initArchiveOverlay);
  } else {
    initArchiveOverlay();
  }
})();
