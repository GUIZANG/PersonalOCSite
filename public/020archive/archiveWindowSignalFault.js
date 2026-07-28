(function () {
  const IMAGE_SOURCES = [
    "../assets/images/eye.jpg",
    "../assets/images/fullEye.png",
    "../assets/images/mansus.png",
    "../assets/images/moon-letter.jpg",
    "../assets/images/moon.jpg",
    "../assets/images/ChatGPT%20Image%202026%E5%B9%B42%E6%9C%8821%E6%97%A5%2020_50_14.png",
  ];
  const FIRST_DELAY = [4000, 8000];
  const REPEAT_DELAY = [9000, 18000];
  const FAULT_DURATION = 720;

  let timer = 0;
  let previousPairKey = "";

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function chooseRandomPair(windows) {
    const pairs = windows.flatMap((frame) =>
      IMAGE_SOURCES.map((source) => ({
        frame,
        source,
        key: `${frame.dataset.windowId}:${source}`,
      }))
    );
    const choices = pairs.filter(({ key }) => key !== previousPairKey);
    return choices[Math.floor(Math.random() * choices.length)] || pairs[0];
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
    layer.innerHTML = '<img alt="" decoding="async" />';
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

    previousPairKey = selection.key;

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

    viewport.classList.remove("is-signal-incursion");
    void viewport.offsetWidth;
    viewport.classList.add("is-signal-incursion");

    window.setTimeout(() => {
      viewport.classList.remove("is-signal-incursion");
      schedule(stage, ...REPEAT_DELAY);
    }, FAULT_DURATION);
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
