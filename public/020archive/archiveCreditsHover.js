(function () {
  const creditItems = document.querySelectorAll(".archive-overlay-credits li");
  const copyHeader = document.querySelector(".archive-overlay-page__header");
  const resetTimers = new WeakMap();
  const scrambleRuns = new WeakMap();

  function splitIntoCharacters(element, characterClass) {
    const label = element.textContent.replace(/\s+/g, " ").trim();
    element.setAttribute("aria-label", label);
    element.textContent = "";

    Array.from(label).forEach((character) => {
      if (character === " ") {
        element.append(document.createTextNode(" "));
        return;
      }

      const letter = document.createElement("i");
      letter.className = characterClass;
      letter.setAttribute("aria-hidden", "true");
      letter.dataset.originalGlyph = character;
      if (/[A-Za-z]/.test(character)) {
        letter.dataset.creditLetter = "";
      }
      letter.textContent = character;
      element.append(letter);
    });
  }

  function bindGlitch(target, classTarget, glitchClass, probability) {
    const triggerGlitch = () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      const currentTimer = resetTimers.get(classTarget);
      if (currentTimer) window.clearTimeout(currentTimer);

      const letters = Array.from(
        target.querySelectorAll("[data-credit-letter]")
      );
      letters.forEach((letter) => letter.classList.remove("is-mirrored"));
      classTarget.classList.remove(glitchClass);
      void classTarget.offsetWidth;

      const mirrorCount = probability
        ? Math.min(
            letters.length,
            Math.max(
              4,
              letters.reduce(
                (count) => count + (Math.random() < probability ? 1 : 0),
                0
              )
            )
          )
        : Math.min(letters.length, 2 + Math.floor(Math.random() * 2));
      const available = [...letters];
      const blinkDelays = [0.1, 0.2, 0.3].sort(() => Math.random() - 0.5);

      for (let index = 0; index < mirrorCount; index += 1) {
        const selectedIndex = Math.floor(Math.random() * available.length);
        const selectedLetter = available.splice(selectedIndex, 1)[0];
        selectedLetter?.style.setProperty(
          "--credit-blink-delay",
          `${blinkDelays[index % blinkDelays.length]}s`
        );
        selectedLetter?.classList.add("is-mirrored");
      }

      classTarget.classList.add(glitchClass);
      resetTimers.set(
        classTarget,
        window.setTimeout(() => {
          classTarget.classList.remove(glitchClass);
          letters.forEach((letter) => letter.classList.remove("is-mirrored"));
        }, 680)
      );
    };

    target.addEventListener("pointerenter", triggerGlitch);
    target.addEventListener("focus", triggerGlitch);
  }

  function bindScrambleEntry(target) {
    const overlay = target.closest(".archive-overlay-page");
    const elements = [
      {
        element: target.querySelector(".archive-overlay-page__kicker"),
        glyphs: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\#%",
        duration: 900,
        revealDelay: 220,
      },
      {
        element: target.querySelector(".archive-overlay-page__copy"),
        glyphs: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\#%",
        duration: 1180,
        revealDelay: 360,
      },
    ]
      .filter(({ element }) => element)
      .map((config) => {
        const original = config.element.textContent.replace(/\s+/g, " ").trim();
        const visual = document.createElement("span");
        visual.className = "archive-overlay-scramble-text";
        visual.setAttribute("aria-hidden", "true");
        visual.textContent = original;
        config.element.setAttribute("aria-label", original);
        config.element.replaceChildren(visual);
        return { ...config, original, visual };
      });
    let enabled = false;

    const clearRun = () => {
      const run = scrambleRuns.get(target);
      if (run) {
        window.clearInterval(run.interval);
        scrambleRuns.delete(target);
      }
      elements.forEach(({ original, visual }) => {
        visual.textContent = original;
      });
      target.style.removeProperty("height");
      target.classList.remove("is-copy-scrambling", "is-copy-scramble-complete");
    };

    const randomGlyph = (pool) =>
      pool[Math.floor(Math.random() * pool.length)];

    const renderScramble = (config, elapsed) => {
      const { original, glyphs, duration, revealDelay, visual } = config;
      if (elapsed >= duration) {
        visual.textContent = original;
        return true;
      }

      const revealProgress = Math.max(
        0,
        Math.min(1, (elapsed - revealDelay) / (duration - revealDelay))
      );
      const revealCount = Math.floor(original.length * revealProgress);
      let output = "";

      for (let index = 0; index < original.length; index += 1) {
        const character = original[index];
        if (character === " ") {
          output += " ";
        } else if (index < revealCount) {
          output += character;
        } else {
          output += randomGlyph(glyphs);
        }
      }

      visual.textContent = output;
      return false;
    };

    const runScramble = () => {
      if (!enabled) return;
      clearRun();
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        target.classList.add("is-copy-scramble-complete");
        return;
      }

      const stableHeight = target.getBoundingClientRect().height;
      if (stableHeight > 0) target.style.height = `${stableHeight}px`;
      void target.offsetWidth;
      target.classList.add("is-copy-scrambling");
      const startTime = performance.now();
      elements.forEach((config) => renderScramble(config, 0));

      const interval = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        let complete = true;
        elements.forEach((config) => {
          if (!renderScramble(config, elapsed)) complete = false;
        });
        if (!complete) return;

        window.clearInterval(interval);
        target.classList.remove("is-copy-scrambling");
        target.classList.add("is-copy-scramble-complete");
        target.style.removeProperty("height");
        scrambleRuns.delete(target);
      }, 46);

      scrambleRuns.set(target, { interval });
    };

    const syncEnabled = () => {
      const nextEnabled = Boolean(
        overlay?.classList.contains("is-credits-revealed")
      );
      if (nextEnabled === enabled) return;

      enabled = nextEnabled;
      clearRun();
      if (enabled) runScramble();
    };

    if (overlay) {
      const observer = new MutationObserver(syncEnabled);
      observer.observe(overlay, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    syncEnabled();
  }

  creditItems.forEach((item) => {
    const link = item.querySelector("a");
    if (!link) return;

    splitIntoCharacters(link, "archive-overlay-credit-char");
    bindGlitch(link, item, "is-credit-glitching", 0);
  });

  if (copyHeader) {
    bindScrambleEntry(copyHeader);
  }
})();
