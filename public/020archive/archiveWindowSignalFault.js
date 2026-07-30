(function () {
  const IMAGE_SOURCES = [
    "../assets/images/forArchive/01stormEye.jpg",
    "../assets/images/forArchive/02oracleHands.jpg",
    "../assets/images/forArchive/03redSeraph.jpg",
    "../assets/images/forArchive/04blackLilies.jpg",
    "../assets/images/forArchive/05blueLotus.jpg",
    "../assets/images/forArchive/06manyArmedSigil.jpg",
    "../assets/images/forArchive/07flashTree.jpg",
    "../assets/images/forArchive/08redactedPortrait.jpg",
    "../assets/images/forArchive/09cellularSpiral.png",
  ];
  const FIRST_DELAY = [4000, 8000];
  const REPEAT_DELAY = [9000, 18000];
  const FAULT_DURATION = 720;

  let timer = 0;
  let imageQueue = [];
  let previousSource = "";
  let frameQueue = [];
  let framePoolSignature = "";
  let previousFrameId = "";
  const removalTimers = new WeakMap();

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function refillImageQueue() {
    imageQueue = [...IMAGE_SOURCES];
    for (let index = imageQueue.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [imageQueue[index], imageQueue[swapIndex]] = [
        imageQueue[swapIndex],
        imageQueue[index],
      ];
    }

    const nextSource = imageQueue[imageQueue.length - 1];
    if (nextSource === previousSource && imageQueue.length > 1) {
      [imageQueue[0], imageQueue[imageQueue.length - 1]] = [
        imageQueue[imageQueue.length - 1],
        imageQueue[0],
      ];
    }
  }

  function takeNextImage() {
    if (!imageQueue.length) {
      refillImageQueue();
    }
    const source = imageQueue.pop();
    previousSource = source;
    return source;
  }

  function shuffle(values) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }

  function keepFirstFrameDifferent(group, previousId) {
    if (group.length < 2 || group[0] !== previousId) return;
    const swapIndex = 1 + Math.floor(Math.random() * (group.length - 1));
    [group[0], group[swapIndex]] = [group[swapIndex], group[0]];
  }

  function refillFrameQueue(frameIds) {
    frameQueue = [];
    let previousId = previousFrameId;

    for (let groupIndex = 0; groupIndex < 2; groupIndex += 1) {
      const group = shuffle(frameIds);
      keepFirstFrameDifferent(group, previousId);
      frameQueue.push(...group);
      previousId = group[group.length - 1];
    }
  }

  function takeNextFrame(windows) {
    const framesById = new Map(
      windows.map((frame, index) => [
        frame.dataset.windowId || `frame-${index}`,
        frame,
      ])
    );
    const frameIds = [...framesById.keys()];
    const signature = [...frameIds].sort().join("|");

    if (signature !== framePoolSignature) {
      framePoolSignature = signature;
      frameQueue = [];
    }
    if (!frameQueue.length) {
      refillFrameQueue(frameIds);
    }

    const frameId = frameQueue.shift();
    previousFrameId = frameId;
    return framesById.get(frameId);
  }

  function chooseRandomPair(windows) {
    return {
      frame: takeNextFrame(windows),
      source: takeNextImage(),
    };
  }

  function isArchiveVisible(stage) {
    return (
      document.visibilityState === "visible" &&
      !document.body.classList.contains("is-archive-overlay-open") &&
      !stage.classList.contains("is-hypercube-bursting") &&
      !stage.classList.contains("is-credits-morphing")
    );
  }

  function ensureSignalLayer(viewport) {
    let layer = viewport.querySelector(".archive-window-signal-incursion");
    if (layer) return layer;

    layer = document.createElement("div");
    layer.className = "archive-window-signal-incursion";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML =
      '<img alt="" decoding="async" />' +
      '<span class="archive-window-signal-incursion__grade"></span>';
    viewport.appendChild(layer);
    return layer;
  }

  function triggerFault(stage) {
    const windows = Array.from(
      stage.querySelectorAll(
        '.archive-media-window.is-reveal-complete:not([data-window-id="main"])'
      )
    );

    if (!windows.length || !isArchiveVisible(stage)) {
      schedule(stage, 1200, 2600);
      return;
    }

    const selection = chooseRandomPair(windows);
    const { frame, source } = selection;
    const viewport = frame.querySelector(".archive-media-window__viewport");
    if (!viewport) {
      schedule(stage, ...REPEAT_DELAY);
      return;
    }

    const layer = ensureSignalLayer(viewport);
    const image = layer.querySelector("img");
    image.src = source;
    layer.style.setProperty(
      "--signal-image-position",
      `${Math.round(randomBetween(38, 62))}% ${Math.round(randomBetween(35, 65))}%`
    );
    layer.style.setProperty(
      "--signal-shift-a",
      `${Math.round(randomBetween(4, 9))}px`
    );
    layer.style.setProperty(
      "--signal-shift-b",
      `${Math.round(randomBetween(-10, -5))}px`
    );
    layer.style.setProperty(
      "--signal-red-grade",
      randomBetween(0.24, 0.38).toFixed(2)
    );
    layer.style.setProperty(
      "--signal-red-flare",
      randomBetween(0.52, 0.72).toFixed(2)
    );

    viewport.classList.remove("is-signal-incursion");
    void viewport.offsetWidth;
    viewport.classList.add("is-signal-incursion");

    window.clearTimeout(removalTimers.get(viewport));
    const removalTimer = window.setTimeout(() => {
      viewport.classList.remove("is-signal-incursion");
      removalTimers.delete(viewport);
      schedule(stage, ...REPEAT_DELAY);
    }, FAULT_DURATION);
    removalTimers.set(viewport, removalTimer);
  }

  function schedule(stage, minDelay, maxDelay) {
    window.clearTimeout(timer);
    timer = window.setTimeout(
      () => triggerFault(stage),
      randomBetween(minDelay, maxDelay)
    );
  }

  function preloadImages() {
    IMAGE_SOURCES.forEach((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    });
  }

  function init(attempt = 0) {
    const stage = document.getElementById("hypercube-stage");
    const observationWindows = stage?.querySelector(".archive-media-windows");
    if (!stage || !observationWindows) {
      if (attempt < 180) {
        window.requestAnimationFrame(() => init(attempt + 1));
      }
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    preloadImages();
    schedule(stage, ...FIRST_DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})();
