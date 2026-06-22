(function () {
  class MainCardStream {
    constructor() {
      this.stream = document.getElementById("mainCardStream");
      this.line = document.getElementById("mainCardLine");
      this.cards = [
        { kicker: "Archive 01", title: "Signal", meta: "Memory / A" },
        { kicker: "Archive 02", title: "Vector", meta: "Trace / B" },
        { kicker: "Archive 03", title: "Oracle", meta: "Index / C" },
        { kicker: "Archive 04", title: "Noesis", meta: "Loop / D" },
      ];
      this.position = 0;
      this.velocity = -58;
      this.active = false;
      this.lastTime = performance.now();
      this.isDragging = false;
      this.isHoveringCard = false;
      this.lastPointerX = 0;
      this.singleCycleWidth = 0;

      this.animate = this.animate.bind(this);
      this.populate();
      this.setupEvents();
      this.fitAsciiContent();
      this.calculateCycleWidth();
      this.position = -this.singleCycleWidth;
      this.animate();
    }

    activate() {
      this.active = true;
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

      if (this.active && !this.isDragging && !this.isHoveringCard) {
        this.position += this.velocity * dt;
        this.velocity += ((this.velocity < 0 ? -58 : 58) - this.velocity) * 0.018;
      }

      this.wrapPosition();
      this.line.style.transform = `translate3d(${this.position}px, 0, 0)`;
      this.updateScanning();
      requestAnimationFrame(this.animate);
    }

    wrapPosition() {
      if (!this.singleCycleWidth) return;
      const min = -this.singleCycleWidth * 2;
      const max = 0;

      if (this.position < min) {
        this.position += this.singleCycleWidth;
      } else if (this.position > max) {
        this.position -= this.singleCycleWidth;
      }
    }

    calculateCycleWidth() {
      const wrappers = this.line.querySelectorAll(".main-card-wrapper");
      if (wrappers.length < this.cards.length) return;
      const first = wrappers[0].getBoundingClientRect();
      const fifth = wrappers[this.cards.length].getBoundingClientRect();
      this.singleCycleWidth = Math.max(fifth.left - first.left, 1);
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
      const scannerWidth = 8;
      const scannerLeft = scannerX - scannerWidth / 2;
      const scannerRight = scannerX + scannerWidth / 2;

      this.line.querySelectorAll(".main-card-wrapper").forEach((wrapper) => {
        const rect = wrapper.getBoundingClientRect();
        const normal = wrapper.querySelector(".main-card-normal");
        const ascii = wrapper.querySelector(".main-card-ascii");
        const centerDistance = Math.abs(rect.left + rect.width / 2 - scannerX);
        const edgeAmount = Math.min(centerDistance / (window.innerWidth / 2), 1);
        wrapper.style.transform = `scaleX(${1 + edgeAmount * 0.1})`;

        if (rect.left < scannerRight && rect.right > scannerLeft) {
          const scanLeft = Math.max(scannerLeft - rect.left, 0);
          const scanRight = Math.min(scannerRight - rect.left, rect.width);
          normal.style.setProperty("--clip-right", `${(scanLeft / rect.width) * 100}%`);
          ascii.style.setProperty("--clip-left", `${(scanRight / rect.width) * 100}%`);

          if (!wrapper.dataset.scanned && scanLeft > 0) {
            wrapper.dataset.scanned = "true";
            const flash = document.createElement("div");
            flash.className = "main-scan-effect";
            normal.appendChild(flash);
            setTimeout(() => flash.remove(), 700);
          }
        } else {
          if (rect.right < scannerLeft) {
            normal.style.setProperty("--clip-right", "100%");
            ascii.style.setProperty("--clip-left", "100%");
          } else if (rect.left > scannerRight) {
            normal.style.setProperty("--clip-right", "0%");
            ascii.style.setProperty("--clip-left", "0%");
          }
          delete wrapper.dataset.scanned;
        }
      });
    }

    generateCode(card, index, width = 54, height = 20) {
      const seeds = [
        `const ${card.title.toLowerCase()} = archive.open(${index + 1});`,
        "for (let i = 0; i < memory.length; i++) scan(memory[i]);",
        "if (signal.visible) route('precognitive-strata');",
        "return glyph.map(node => node.frequency).join(' ');",
        "entropy += vector.x * vector.y - threshold;",
      ];
      let text = "";
      for (let row = 0; row < height; row++) {
        const seed = seeds[(row + index) % seeds.length];
        const noise = ` // ${hash(row * 17 + index).toString().slice(2, 10)}`;
        text += (seed + noise).padEnd(width, " ").slice(0, width);
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
