document.querySelectorAll('.glitch-checkbox-container input').forEach(checkbox => {

  // 初始化：如果页面加载时已经是 checked，则直接锁定
  if (checkbox.checked) {
    checkbox.dataset.locked = 'true';
  }

  checkbox.addEventListener('click', function (e) {

    // 已锁定：彻底拦截
    if (this.dataset.locked === 'true') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 第一次成功勾选 → 锁定
    if (this.checked) {
      this.dataset.locked = 'true';
    }
  });
});


document.addEventListener("DOMContentLoaded", () => {

  const sections = Array.from(
    document.querySelectorAll(".section-wrapper")
  );

  const steps = sections.map(sec => {
    let next = sec.nextElementSibling;
    return next && next.classList.contains("step-content") ? next : null;
  });

  // 初始只显示第一个 section
  sections.forEach((sec, i) => {
    if (i === 0) {
      sec.classList.add("is-visible");
    }
  });

  sections.forEach((section, index) => {

    const checkbox = section.querySelector("input[type='checkbox']");
    const step = steps[index];
    const nextSection = sections[index + 1];

    if (!checkbox) return;

    checkbox.addEventListener("click", () => {
      
      if (checkbox.dataset.locked !== 'true') return;

      // 展开当前 step（只会执行一次）
      if (step && !step.classList.contains("is-visible")) {
        step.classList.add("is-visible");
      }

      // 解锁下一个 section（只会执行一次）
      if (nextSection && !nextSection.classList.contains("is-visible")) {
        nextSection.classList.add("is-visible");
      }
    });
  });
});
