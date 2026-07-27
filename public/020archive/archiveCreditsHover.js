(function () {
  const creditItems = document.querySelectorAll(".archive-overlay-credits li");
  const resetTimers = new WeakMap();

  creditItems.forEach((item) => {
    const link = item.querySelector("a");
    if (!link) return;

    const label = link.textContent.trim();
    link.setAttribute("aria-label", label);
    link.textContent = "";

    Array.from(label).forEach((character) => {
      if (character === " ") {
        link.append(document.createTextNode(" "));
        return;
      }

      const letter = document.createElement("i");
      letter.className = "archive-overlay-credit-char";
      letter.setAttribute("aria-hidden", "true");
      if (/[A-Za-z]/.test(character)) letter.dataset.creditLetter = "";
      letter.textContent = character;
      link.append(letter);
    });

    const triggerGlitch = () => {
      const currentTimer = resetTimers.get(item);
      if (currentTimer) window.clearTimeout(currentTimer);

      const letters = Array.from(link.querySelectorAll("[data-credit-letter]"));
      letters.forEach((letter) => letter.classList.remove("is-mirrored"));
      item.classList.remove("is-credit-glitching");
      void item.offsetWidth;

      const mirrorCount = Math.min(letters.length, 2 + Math.floor(Math.random() * 2));
      const available = [...letters];
      const blinkDelays = [0.1, 0.2, 0.3].sort(() => Math.random() - 0.5);
      for (let index = 0; index < mirrorCount; index += 1) {
        const selectedIndex = Math.floor(Math.random() * available.length);
        const selectedLetter = available.splice(selectedIndex, 1)[0];
        selectedLetter?.style.setProperty("--credit-blink-delay", `${blinkDelays[index]}s`);
        selectedLetter?.classList.add("is-mirrored");
      }

      item.classList.add("is-credit-glitching");
      resetTimers.set(item, window.setTimeout(() => {
        item.classList.remove("is-credit-glitching");
        letters.forEach((letter) => letter.classList.remove("is-mirrored"));
      }, 680));
    };

    link.addEventListener("pointerenter", triggerGlitch);
    link.addEventListener("focus", triggerGlitch);
  });
})();
