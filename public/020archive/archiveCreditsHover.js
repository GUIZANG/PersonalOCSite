(function () {
  const creditItems = document.querySelectorAll(".archive-overlay-credits li");
  const copyHeader = document.querySelector(".archive-overlay-page__header");
  const resetTimers = new WeakMap();

  function splitIntoCharacters(element, characterClass) {
    const label = element.textContent.trim();
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
      if (/[A-Za-z]/.test(character)) letter.dataset.creditLetter = "";
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
      resetTimers.set(classTarget, window.setTimeout(() => {
        classTarget.classList.remove(glitchClass);
        letters.forEach((letter) => letter.classList.remove("is-mirrored"));
      }, 680));
    };

    target.addEventListener("pointerenter", triggerGlitch);
    target.addEventListener("focus", triggerGlitch);
  }

  creditItems.forEach((item) => {
    const link = item.querySelector("a");
    if (!link) return;

    splitIntoCharacters(link, "archive-overlay-credit-char");
    bindGlitch(link, item, "is-credit-glitching", 0);
  });

  if (copyHeader) {
    copyHeader
      .querySelectorAll(
        ".archive-overlay-page__kicker, .archive-overlay-page__copy"
      )
      .forEach((element) => {
        splitIntoCharacters(
          element,
          "archive-overlay-credit-char archive-overlay-copy-char"
        );
      });
    bindGlitch(
      copyHeader,
      copyHeader,
      "is-copy-hover-glitching",
      0.22
    );
  }
})();
