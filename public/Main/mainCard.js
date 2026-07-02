(function () {
  class MainCardStream {
    constructor() {
      this.stream = document.getElementById("mainCardStream");
      this.line = document.getElementById("mainCardLine");
      this.hudLeft = document.getElementById("mainScannerHudLeft");
      this.hudRight = document.getElementById("mainScannerHudRight");
      this.cards = [
        { kicker: "Archive 01", title: "Signal", meta: "Memory / A" },
        { kicker: "Archive 02", title: "Vector", meta: "Trace / B" },
        { kicker: "Archive 03", title: "Oracle", meta: "Index / C" },
        { kicker: "Archive 04", title: "Noesis", meta: "Loop / D" },
      ];
      this.position = 0;
      this.velocity = -58;
      this.active = false;
      this.revealAmount = 0;
      this.revealTarget = 0;
      this.lastTime = performance.now();
      this.isDragging = false;
      this.isHoveringCard = false;
      this.lastPointerX = 0;
      this.singleCycleWidth = 0;
      this.hasStarted = false;
      this.isIntroEntering = false;

      this.animate = this.animate.bind(this);
      this.populate();
      this.setupEvents();
      this.fitAsciiContent();
      this.calculateCycleWidth();
      this.position = -this.singleCycleWidth;
      this.bindVFX();
      this.animate();
    }

    activate() {
      this.active = true;
      this.revealTarget = 1;

      if (!this.hasStarted) {
        this.position = this.getIntroStartPosition();
        this.isIntroEntering = true;
        this.hasStarted = true;
      }
    }

    getIntroStartPosition() {
      return window.innerWidth * (2 / 3);
    }

    bindVFX() {
      if (!window.MainCardVFX) return;
      this.line.querySelectorAll(".main-card-wrapper").forEach((wrapper) => {
        const normal = wrapper.querySelector(".main-card-normal");
        if (!normal) return;
        window.MainCardVFX.bind(
          normal,
          () => (typeof wrapper._scanQ === "number" ? wrapper._scanQ : -1),
          () => this.revealAmount,
          () => wrapper._dissolveSeed
        );
      });
    }

    populate() {
      const loops = 3;
      this.line.innerHTML = "";
      for (let loop = 0; loop < loops; loop++) {
        this.cards.forEach((card, index) => {
          this.line.appendChild(this.createCard(card, index));
        });
      }
    }

    createCard(card, index) {
      const wrapper = document.createElement("article");
      wrapper.className = "main-card-wrapper hoverable";
      wrapper.dataset.cardIndex = index;
      wrapper._scanQ = -1;
      wrapper._previousScanQ = -1;
      wrapper._dissolveSeed = Math.random();

      const normal = document.createElement("div");
      normal.className = "main-card main-card-normal";
      normal.innerHTML = `
        <span class="main-card-kicker">${card.kicker}</span>
        <h2 class="main-card-title">${card.title}</h2>
        <div class="main-card-meta">
          <span>${card.meta}</span>
          <span>${String(index + 1).padStart(2, "0")} / 04</span>
        </div>
      `;

      const ascii = document.createElement("div");
      ascii.className = "main-card main-card-ascii";
      const asciiContent = document.createElement("pre");
      asciiContent.className = "main-ascii-content";
      ascii.appendChild(asciiContent);

      wrapper.appendChild(normal);
      wrapper.appendChild(ascii);
      return wrapper;
    }

    setupEvents() {
      this.line.addEventListener("pointerdown", (event) => this.startDrag(event));
      this.line.addEventListener("pointerover", (event) => this.onCardHover(event));
      this.line.addEventListener("pointerout", (event) => this.onCardLeave(event));
      this.line.addEventListener("pointerleave", () => {
        this.isHoveringCard = false;
      });
      this.line.addEventListener("contextmenu", (event) => event.preventDefault());
      window.addEventListener("pointermove", (event) => this.onDrag(event));
      window.addEventListener("pointerup", () => this.endDrag());
      window.addEventListener("resize", () => {
        this.fitAsciiContent();
        this.calculateCycleWidth();
        if (this.isIntroEntering) {
          this.position = this.getIntroStartPosition();
        }
      });
      this.line.addEventListener("wheel", (event) => {
        if (!this.active) return;
        event.preventDefault();
      }, { passive: false });
    }

    startDrag(event) {
      if (!this.active || event.button === 2) return;
      this.isDragging = true;
      this.lastPointerX = event.clientX;
      this.line.classList.add("dragging");
      this.line.setPointerCapture?.(event.pointerId);
    }

    onDrag(event) {
      if (!this.isDragging) return;
      const delta = event.clientX - this.lastPointerX;
      this.position += delta;
      this.lastPointerX = event.clientX;
    }

    endDrag() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.isHoveringCard = Boolean(this.line.querySelector(".main-card-wrapper:hover"));
      this.line.classList.remove("dragging");
    }

    onCardHover(event) {
      const card = event.target.closest(".main-card-wrapper");
      if (!card || card.contains(event.relatedTarget)) return;
      this.isHoveringCard = true;
    }

    onCardLeave(event) {
      const card = event.target.closest(".main-card-wrapper");
      if (!card || card.contains(event.relatedTarget)) return;
      this.isHoveringCard = false;
    }

    animate() {
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      if (this.active && !this.isDragging) {
        this.position += this.velocity * dt;
        this.velocity += ((this.velocity < 0 ? -58 : 58) - this.velocity) * 0.018;
      }

      this.revealAmount += (this.revealTarget - this.revealAmount) * 0.06;

      this.wrapPosition();
      this.line.style.transform = `translate3d(${this.position}px, 0, 0)`;
      this.updateScanning();
      requestAnimationFrame(this.animate);
    }

    wrapPosition() {
      if (!this.singleCycleWidth) return;
      const min = -this.singleCycleWidth * 2;
      const max = 0;

      if (this.isIntroEntering) {
        if (this.position > max) return;
        this.isIntroEntering = false;
      }

      if (this.position < min) {
        this.position += this.singleCycleWidth;
      } else if (this.position > max) {
        this.position -= this.singleCycleWidth;
      }
    }

    calculateCycleWidth() {
      const wrappers = this.line.querySelectorAll(".main-card-wrapper");
      if (wrappers.length < this.cards.length) return;
      const first = wrappers[0];
      const fifth = wrappers[this.cards.length];
      this.singleCycleWidth = Math.max(fifth.offsetLeft - first.offsetLeft, 1);
    }

    fitAsciiContent() {
      const baseWidth = 380;
      const baseHeight = 240;
      const baseFontSize = 12;
      const baseLineHeight = 14.4;
      const minPadding = 2;

      const firstWrapper = this.line.querySelector(".main-card-wrapper");
      if (!firstWrapper) return;

      const cardWidth = firstWrapper.offsetWidth;
      const cardHeight = firstWrapper.offsetHeight;
      if (!cardWidth || !cardHeight) return;

      const scale = Math.min(cardWidth / baseWidth, cardHeight / baseHeight);
      const fontSize = baseFontSize * scale;
      const lineHeight = baseLineHeight * scale;
      const verticalPadding = minPadding * scale;
      const availableHeight = Math.max(cardHeight - verticalPadding * 2, lineHeight);
      const rows = Math.max(Math.floor(availableHeight / lineHeight), 1);
      const fittedPadding = Math.max((cardHeight - rows * lineHeight) / 2, 0);
      const firstAsciiContent = firstWrapper.querySelector(".main-ascii-content");
      if (!firstAsciiContent) return;

      const charWidth = this.measureAsciiCharWidth(firstAsciiContent, fontSize, lineHeight);
      const columns = Math.max(Math.floor(cardWidth / charWidth), 1);

      this.line.querySelectorAll(".main-card-wrapper").forEach((wrapper) => {
        const asciiContent = wrapper.querySelector(".main-ascii-content");
        if (!asciiContent) return;

        const cardIndex = Number(wrapper.dataset.cardIndex) || 0;
        const card = this.cards[cardIndex % this.cards.length];

        asciiContent.style.fontSize = `${fontSize}px`;
        asciiContent.style.lineHeight = `${lineHeight}px`;
        asciiContent.style.padding = `${fittedPadding}px 0`;
        asciiContent.textContent = this.generateCode(card, cardIndex, columns, rows);
      });
    }

    measureAsciiCharWidth(asciiContent, fontSize, lineHeight) {
      const probe = document.createElement("span");
      probe.textContent = "M".repeat(20);
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "pre";
      probe.style.fontFamily = getComputedStyle(asciiContent).fontFamily;
      probe.style.fontSize = `${fontSize}px`;
      probe.style.lineHeight = `${lineHeight}px`;
      document.body.appendChild(probe);

      const charWidth = probe.getBoundingClientRect().width / 20;
      probe.remove();

      return Math.max(charWidth, 1);
    }

    updateScanning() {
      if (!this.active) return;
      const scannerX = window.innerWidth / 2;
      let nearestCard = null;
      let nearestDistance = Infinity;

      this.line.querySelectorAll(".main-card-wrapper").forEach((wrapper) => {
        const rect = wrapper.getBoundingClientRect();
        const ascii = wrapper.querySelector(".main-card-ascii");
        const centerDistance = Math.abs(rect.left + rect.width / 2 - scannerX);
        const edgeAmount = Math.min(centerDistance / (window.innerWidth / 2), 1);
        wrapper.style.transform = `scaleX(${1 + edgeAmount * 0.1})`;
        if (centerDistance < nearestDistance) {
          nearestDistance = centerDistance;
          nearestCard = wrapper;
        }

        // Unclamped scanner position across the card in UV space, fed to the
        // vfx dissolve shader. <0 = card fully right (intact), >1 = fully left (gone).
        wrapper._scanQ = rect.width > 0 ? (scannerX - rect.left) / rect.width : -1;
        const scanAmount = Math.min(Math.max(wrapper._scanQ, 0), 1) * 100;
        wrapper.style.setProperty("--clip-right", `${scanAmount}%`);
        ascii.style.setProperty("--clip-left", `${scanAmount}%`);
        wrapper.style.setProperty("--scan-fade-x", `${wrapper._scanQ * 100}%`);
        wrapper.classList.toggle("is-scan-fading", wrapper._scanQ >= 0 && wrapper._scanQ <= 1);

        if (wrapper._previousScanQ < 0 && wrapper._scanQ >= 0) {
          wrapper._dissolveSeed = Math.random();
          const flash = document.createElement("div");
          flash.className = "main-scan-effect";
          wrapper.appendChild(flash);
          setTimeout(() => flash.remove(), 700);
        }
        wrapper._previousScanQ = wrapper._scanQ;
      });

      this.updateScannerHud(nearestCard, nearestDistance, scannerX);
    }

    updateScannerHud(wrapper, distance, scannerX) {
      if (!this.hudLeft || !this.hudRight || !wrapper) return;
      const cardIndex = Number(wrapper.dataset.cardIndex) || 0;
      const scanQ = typeof wrapper._scanQ === "number" ? wrapper._scanQ : 0;
      const scanPercent = Math.round(Math.min(Math.max(scanQ, 0), 1) * 100);
      const distancePercent = Math.round(Math.min(distance / Math.max(window.innerWidth / 2, 1), 1) * 100);

      this.hudLeft.textContent = `${this.cards[cardIndex]?.kicker || "Archive"} / Q${String(scanPercent).padStart(3, "0")}`;
      this.hudRight.textContent = `X${String(Math.round(scannerX)).padStart(4, "0")} / D${String(distancePercent).padStart(3, "0")}`;
    }

    generateCode(card, index, width = 54, height = 20) {
      const passage =
        "If someone sees the One of Proper Enlightenment as liberated and free from all outflows, and as not being attached to all worlds, that person still has not certified to the Way-eye. If someone knows that the Thus Come One’s body and marks do not exist, and cultivates and attains this understanding, then that person will quickly become a Buddha. If one can look upon this world with a mind that is unmoving, and see Buddhas and living beings as the same, then such a one will accomplish supreme wisdom. If, with regard to the Buddha and the Dharma, one’s mind is completely level and equal, and the two thoughts do not manifest, then one will realize the position which is hard to conceive of. If there is someone who sees the Buddha and living beings as level and equal, and peacefully dwelling, yet without dwelling and without a place of entering, then that person will become one who is difficult to encounter. Forms and feelings are without number; thinking, processes, and consciousness are also like this. If one is able to know this, then one can become a great muni. If worldly and world-transcending views are leapt far beyond, and if one is well able to know all Dharmas, then such a one will accomplish great brilliance. If someone produces a mind of transference toward all-wisdom, and sees the mind as not being produced, then such a one will obtain great renown. Living beings are without production and also without extinction. If one is able to obtain this kind of wisdom, then one will accomplish the Unsurpassed Way. Within one there are the limitless, and within the limitless there is one. If one understands that they mutually arise, then one will accomplish fearlessness.";
      const lines = [];

      for (const sentence of passage.split("\n")) {
        const words = sentence.split(" ");
        let current = "";

        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (candidate.length <= width) {
            current = candidate;
          } else {
            if (current) lines.push(current);
            current = word.slice(0, width);
          }
        }
        if (current) lines.push(current);
      }

      let text = "";
      for (let row = 0; row < height; row++) {
        const line = lines[(row + index) % lines.length] || "";
        const raggedStart = Math.floor(width / 2);
        const raggedRange = Math.max(width - raggedStart, 1);
        const visibleWidth = raggedStart + Math.floor(hash(index * 131 + row * 29) * raggedRange);
        const cutAt = line.length > visibleWidth ? line.lastIndexOf(" ", visibleWidth) : line.length;
        const displayLine = line.slice(0, cutAt > 0 ? cutAt : line.length);

        text += displayLine.padEnd(width, " ").slice(0, width);
        if (row < height - 1) text += "\n";
      }
      return text;
    }
  }

  function hash(value) {
    const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;

    return x - Math.floor(x);
  }

  window.MainCardStream = MainCardStream;
})();
