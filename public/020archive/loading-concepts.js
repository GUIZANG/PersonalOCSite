(() => {
  const concepts = Array.from(document.querySelectorAll(".concept"));
  const sliceOffsets = [-48, 32, -24, 55, -37, 21, -58, 44, -17, 35, -28, 51];

  concepts.forEach((concept) => {
    const brain = concept.querySelector(".brain");
    const spectrumBanks = concept.querySelectorAll(".spectrum");
    for (let index = 0; index < 12; index += 1) {
      const slice = document.createElement("i");
      slice.className = "brain-slice";
      slice.style.setProperty("--slice-top", `${(index / 12) * 100}%`);
      slice.style.setProperty("--slice-bottom", `${100 - ((index + 1) / 12) * 100}%`);
      slice.style.setProperty("--slice-shift", `${sliceOffsets[index]}px`);
      slice.style.setProperty("--slice-lock", "0");
      slice.style.setProperty("--slice-fault", "0");
      brain.appendChild(slice);
    }

    spectrumBanks.forEach((bank, bankIndex) => {
      for (let index = 0; index < 19; index += 1) {
        const line = document.createElement("i");
        const centerDistance = Math.abs(index - 9) / 9;
        const width = 24 + centerDistance * 58 + ((index * 17) % 21);
        line.style.setProperty("--line-width", `${width}%`);
        line.style.setProperty("--line-alpha", `${0.12 + (1 - centerDistance) * 0.2}`);
        line.style.setProperty("--line-speed", `${1.15 + ((index * 13) % 8) * 0.12}s`);
        line.style.setProperty("--line-origin", bankIndex ? "left" : "right");
        line.style.setProperty("--line-direction", bankIndex ? "90deg" : "270deg");
        if (index === 5 || index === 14) line.classList.add("is-fault");
        bank.appendChild(line);
      }
    });

    const expand = () => {
      const expanded = concept.classList.toggle("is-expanded");
      document.querySelector(".concept-board").classList.toggle("has-expanded", expanded);
      concept.querySelector("header em").textContent = expanded ? "CLOSE" : "OPEN";
    };
    concept.addEventListener("click", expand);
    concept.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        expand();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const expanded = document.querySelector(".concept.is-expanded");
    if (!expanded) return;
    expanded.classList.remove("is-expanded");
    expanded.querySelector("header em").textContent = "OPEN";
    document.querySelector(".concept-board").classList.remove("has-expanded");
  });

  const startedAt = performance.now();
  const render = (time) => {
    const phase = ((time - startedAt) % 6200) / 6200;
    const progress = Math.min(100, Math.round(phase * 108));
    concepts.forEach((concept, conceptIndex) => {
      concept.querySelector(".load-index strong").textContent = String(progress).padStart(2, "0");
      concept.querySelector(".telemetry").innerHTML =
        `SLICE / ${String(Math.min(12, Math.floor(progress / 8.34))).padStart(2, "0")}—12<br>` +
        `DRIFT / +${(7.43 - progress * 0.052).toFixed(2)}<br>` +
        `INTEGRITY / ${progress.toFixed(1)}`;
      const slices = concept.querySelectorAll(".brain-slice");
      slices.forEach((slice, index) => {
        const threshold = (index + 1) / slices.length;
        const lock = Math.max(0, Math.min(1, (phase - threshold * 0.74) * 4.4));
        slice.style.setProperty("--slice-lock", lock.toFixed(3));
        slice.style.setProperty("--slice-shift", `${sliceOffsets[index] * (1 - lock)}px`);
        const faultWindow = (Math.floor(time / 470) + conceptIndex) % 12;
        const fault = faultWindow === index && progress < 94 ? 0.8 : 0;
        slice.style.setProperty("--slice-fault", String(fault));
        slice.style.setProperty("--slice-fault-shift", `${index % 2 ? -5 : 5}px`);
      });
    });
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
})();
