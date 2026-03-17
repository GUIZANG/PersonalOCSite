document.addEventListener("DOMContentLoaded", () => {
  const box = document.querySelector('.block');
  const lines = document.querySelectorAll('.too-late-line');
  const btnContainer = document.querySelector('.hidden');
  const glitchBtn = document.querySelector('.glitch-btn');

  let currentIndex = 0;
  let isVisible = false;
  let glitchShown = false; // 防止重复触发

  // 返回页面时清理崩溃状态
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      document.body.classList.remove('crash-effect');
    }
  });

  // 监听 block 是否进入视口
  const observer = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0].isIntersecting;
    },
    { threshold: 0.1 }
  );
  observer.observe(box);

  // 点击推进文本
  document.addEventListener('click', (e) => {
    if (e.target.closest('.glitch-btn')) return;
    if (!isVisible) return;
    if (currentIndex >= lines.length) return;

    const currentLine = lines[currentIndex];

    // 第一行出现时给 block 标记
    if (currentIndex === 0) {
      box.classList.add('has-content');
    }

    // 颜色渐变
    const total = lines.length;
    const ratio = total > 1 ? currentIndex / (total - 1) : 1;

    const r = Math.floor(255 - (255 - 139) * ratio);
    const g = Math.floor(255 * (1 - ratio));
    const b = Math.floor(255 * (1 - ratio));

    currentLine.style.setProperty('--line-color', `rgb(${r}, ${g}, ${b})`);

    // 激活当前行
    currentLine.classList.add('active');
    currentLine.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 如果这一行里包含 text-block，立刻展开
    const innerTextBlock = currentLine.querySelector('.text-block');
    if (innerTextBlock) {
      innerTextBlock.classList.add('show');
    }

    // ⭐ 如果这是最后一条 too-late-line
    if (currentIndex === lines.length - 1 && btnContainer && !glitchShown) {
      glitchShown = true;

      setTimeout(() => {
        btnContainer.classList.add('show');
        btnContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 3000);
    }

    currentIndex++;
  });

  // glitch 按钮点击
  if (glitchBtn) {
    glitchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.add('crash-effect');

      setTimeout(() => {
        window.location.href = "../blackMoonMain/blackMoon.html";
      }, 500);
    });
  }
});
