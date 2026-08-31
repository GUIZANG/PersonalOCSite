(function () {
  const root = document.documentElement;
  const body = document.body;
  const preloader = document.getElementById("archivePreloader");
  const brain = document.getElementById("archivePreloaderBrain");
  const exitBands = document.getElementById("archivePreloaderExitBands");
  const spectrum = document.getElementById("archivePreloaderSpectrum");
  const value = document.getElementById("archivePreloaderValue");
  const state = document.getElementById("archivePreloaderState");
  const telemetry = document.getElementById("archivePreloaderTelemetry");

  if (!preloader || !brain || !exitBands || !spectrum || !value || !state || !telemetry) return;

  const SLICE_COUNT = 12;
  const SLICE_OFFSETS = [-48, 32, -24, 55, -37, 21, -58, 44, -17, 35, -28, 51];
  const FAULT_ATTACK = 40;
  const FAULT_HOLD = 50;
  const FAULT_DECAY = 120;
  const slices = [];
  const spectrumFaultLines = [];
  let targetProgress = 4;
  let renderProgress = 0;
  let sceneReady = false;
  let modelReady = false;
  let modelRequested = false;
  let finished = false;
  let lastTime = performance.now();
  let frame = 0;
  let nextFaultAt = lastTime + 520;
  let faultStartedAt = -Infinity;
  let faultSliceIndices = [];

  body.classList.add("archive-is-loading");
  root.style.setProperty("--archive-load-progress", "0");

  spectrum
    .querySelectorAll(".archive-preloader__spectrum")
    .forEach((bank, bankIndex) => {
      for (let index = 0; index < 19; index += 1) {
        const line = document.createElement("i");
        const centerDistance = Math.abs(index - 9) / 9;
        const lineWidth = 24 + centerDistance * 58 + ((index * 17) % 21);
        line.className = "archive-preloader__spectrum-line";
        line.style.setProperty("--spectrum-line-width", `${lineWidth}%`);
        line.style.setProperty(
          "--spectrum-line-alpha",
          (0.12 + (1 - centerDistance) * 0.2).toFixed(3)
        );
        line.style.setProperty(
          "--spectrum-line-speed",
          `${1.15 + ((index * 13) % 8) * 0.12}s`
        );
        line.style.setProperty(
          "--spectrum-line-origin",
          bankIndex ? "left" : "right"
        );
        line.style.setProperty(
          "--spectrum-line-direction",
          bankIndex ? "90deg" : "270deg"
        );
        line.style.animationDelay = `${-((index * 0.17 + bankIndex * 0.31) % 1.4)}s`;
        line.style.setProperty("--spectrum-fault", "0");
        if (index === 5 || index === 14) spectrumFaultLines.push(line);
        bank.appendChild(line);
      }
    });

  for (let index = 0; index < SLICE_COUNT; index += 1) {
    const band = document.createElement("i");
    band.style.setProperty("--band-index", index);
    band.style.setProperty("--band-top", `${(index / SLICE_COUNT) * 100}%`);
    band.style.setProperty("--band-height", `${100 / SLICE_COUNT + 0.08}%`);
    exitBands.appendChild(band);
  }

  for (let index = 0; index < SLICE_COUNT; index += 1) {
    const slice = document.createElement("i");
    slice.className = "archive-preloader__brain-slice";
    slice.style.setProperty("--slice-top", `${(index / SLICE_COUNT) * 100}%`);
    slice.style.setProperty(
      "--slice-bottom",
      `${100 - ((index + 1) / SLICE_COUNT) * 100}%`
    );
    slice.style.setProperty("--slice-shift", `${SLICE_OFFSETS[index]}px`);
    slice.style.setProperty("--slice-index", index);
    brain.appendChild(slice);
    slices.push(slice);
  }

  const setTarget = (progress) => {
    targetProgress = Math.max(targetProgress, Math.min(100, progress));
  };

  const requestModel = () => {
    if (modelRequested) return;
    modelRequested = true;
    state.textContent = "Calibrating archive model";
    setTarget(64);
    window.dispatchEvent(new CustomEvent("archive:preload-card-model"));
  };

  const resolveState = (progress) => {
    if (progress < 24) return "Acquiring neural strata";
    if (progress < 58) return "Registering memory slices";
    if (progress < 90) return "Calibrating archive model";
    if (progress < 100) return "Resolving central suture";
    return "Identity coherent";
  };

  const scheduleNextFault = (progress, time) => {
    let minimumInterval = 900;
    let intervalRange = 300;

    if (progress >= 30 && progress < 72) {
      minimumInterval = 520;
      intervalRange = 260;
    } else if (progress >= 72) {
      minimumInterval = 760;
      intervalRange = 260;
    }

    nextFaultAt = time + minimumInterval + Math.random() * intervalRange;
  };

  const beginFaultPulse = (progress, time) => {
    const availableIndices = Array.from(
      { length: SLICE_COUNT },
      (_, index) => index
    );
    const sliceCount = Math.random() < 0.24 ? 3 : 2;

    faultSliceIndices = [];
    while (faultSliceIndices.length < sliceCount) {
      const availableIndex = Math.floor(Math.random() * availableIndices.length);
      const sliceIndex = availableIndices.splice(availableIndex, 1)[0];
      const direction = Math.random() < 0.5 ? -1 : 1;
      const shift = direction * (3 + Math.random() * 4);

      faultSliceIndices.push(sliceIndex);
      slices[sliceIndex]?.style.setProperty(
        "--slice-fault-shift",
        `${shift.toFixed(2)}px`
      );
    }

    faultStartedAt = time;
    scheduleNextFault(progress, time);
  };

  const updateFaultPulse = (progress, time) => {
    if (progress >= 86) {
      faultSliceIndices = [];
      return { indices: faultSliceIndices, strength: 0 };
    }

    if (time >= nextFaultAt) beginFaultPulse(progress, time);

    const elapsed = time - faultStartedAt;
    const holdEnd = FAULT_ATTACK + FAULT_HOLD;
    const pulseEnd = holdEnd + FAULT_DECAY;
    let strength = 0;

    if (elapsed >= 0 && elapsed < FAULT_ATTACK) {
      strength = elapsed / FAULT_ATTACK;
    } else if (elapsed >= FAULT_ATTACK && elapsed < holdEnd) {
      strength = 1;
    } else if (elapsed >= holdEnd && elapsed < pulseEnd) {
      const decay = (elapsed - holdEnd) / FAULT_DECAY;
      strength = 1 - decay * decay * (3 - 2 * decay);
    } else {
      faultSliceIndices = [];
    }

    return { indices: faultSliceIndices, strength };
  };

  const updateSlices = (progress, time) => {
    const normalized = progress / 100;
    const faultPulse = updateFaultPulse(progress, time);
    let locked = 0;

    slices.forEach((slice, index) => {
      const local = Math.max(0, Math.min(1, (normalized - index * 0.035) / 0.62));
      const eased = 1 - Math.pow(1 - local, 3);
      const offset = SLICE_OFFSETS[index] * (1 - eased);
      const fault = faultPulse.indices.includes(index)
        ? faultPulse.strength
        : 0;

      slice.style.setProperty("--slice-shift", `${offset.toFixed(2)}px`);
      slice.style.setProperty("--slice-lock", eased.toFixed(3));
      slice.style.setProperty("--slice-fault", fault);
      if (eased > 0.98) locked += 1;
    });

    spectrumFaultLines.forEach((line, index) => {
      const active = faultPulse.indices.length
        ? faultPulse.indices[0] % spectrumFaultLines.length === index
        : false;
      line.style.setProperty(
        "--spectrum-fault",
        active ? faultPulse.strength.toFixed(3) : "0"
      );
    });

    telemetry.innerHTML =
      `Slice / ${String(locked).padStart(2, "0")}—12<br>` +
      `Drift / +${((1 - normalized) * 7.43).toFixed(2)}<br>` +
      `Integrity / ${(progress * 0.984).toFixed(1)}`;
  };

  const complete = async () => {
    if (finished || !sceneReady || !modelReady) return;
    finished = true;

    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch (_) {
      // Font failure should not strand the archive behind the preloader.
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Readiness is binary at this point. Close the final few display points in
    // one beat so the counter cannot linger in the nineties after all work ends.
    renderProgress = Math.max(renderProgress, 99.94);
    setTarget(100);
  };

  const openArchive = () => {
    state.textContent = "Identity coherent";
    preloader.classList.add("is-registered");

    window.setTimeout(() => {
      preloader.classList.add("is-open");
      body.classList.remove("archive-is-loading");
      window.dispatchEvent(new CustomEvent("archive:preloader-complete"));
    }, 280);

    window.setTimeout(() => preloader.remove(), 1700);
  };

  const tick = (time) => {
    const delta = Math.min(64, time - lastTime);
    lastTime = time;

    // Ease toward real readiness milestones. A small crawl prevents a frozen
    // number while large local resources are being parsed or shaders compile.
    if (!sceneReady && targetProgress < 54) {
      targetProgress = Math.min(54, targetProgress + delta * 0.0028);
    } else if (sceneReady && !modelReady && targetProgress < 91) {
      targetProgress = Math.min(91, targetProgress + delta * 0.0017);
    }

    const catchup = 1 - Math.pow(0.0008, delta / 1000);
    renderProgress += (targetProgress - renderProgress) * catchup;
    if (targetProgress === 100 && 100 - renderProgress < 0.08) renderProgress = 100;

    const rounded = Math.floor(renderProgress);
    value.textContent = String(rounded).padStart(2, "0");
    state.textContent = resolveState(rounded);
    root.style.setProperty("--archive-load-progress", renderProgress.toFixed(3));
    updateSlices(renderProgress, time);

    if (renderProgress >= 100) {
      openArchive();
      return;
    }

    frame = requestAnimationFrame(tick);
  };

  window.addEventListener("DOMContentLoaded", () => setTarget(12), { once: true });

  window.addEventListener("archive:scene-ready", () => {
    sceneReady = true;
    setTarget(60);
    // Give the first WebGL scene one clean frame before constructing the next.
    requestAnimationFrame(() => requestAnimationFrame(requestModel));
  }, { once: true });

  window.addEventListener("archive:model-progress", (event) => {
    const loaded = Number(event.detail?.loaded) || 0;
    const total = Number(event.detail?.total) || 0;
    if (total > 0) setTarget(64 + Math.min(1, loaded / total) * 28);
    else if (loaded > 0) setTarget(74);
  });

  window.addEventListener("archive:model-ready", () => {
    modelReady = true;
    setTarget(96);
    complete();
  }, { once: true });

  // A model failure already emits archive:model-ready in degraded mode. This
  // guard only covers an unexpected script/network failure and keeps navigation usable.
  window.setTimeout(() => {
    if (!sceneReady) sceneReady = true;
    if (!modelRequested) requestModel();
  }, 9000);
  window.setTimeout(() => {
    if (!modelReady) {
      modelReady = true;
      complete();
    }
  }, 10000);

  frame = requestAnimationFrame(tick);

  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
})();
