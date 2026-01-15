document.addEventListener("DOMContentLoaded", () => {
  const box = document.querySelector('.block');
  const lines = document.querySelectorAll('.too-late-line');
  const textBlock = document.querySelector('.text-block'); // 获取 text-block
  const btnContainer = document.querySelector('.hidden');
  let currentIndex = 0;
  let isVisible = false;

  const observer = new IntersectionObserver((entries) => {
    isVisible = entries[0].isIntersecting;
  }, { threshold: 0.1 });
  observer.observe(box);

  document.addEventListener('click', (e) => {
    if (e.target.closest('.glitch-btn')) return;

    if (isVisible && currentIndex < lines.length) {
      if (currentIndex === 0) {
        box.classList.add('has-content');
      }

      const currentLine = lines[currentIndex];
      currentLine.classList.add('active');
      currentLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      currentIndex++;

      // --- 核心修改部分 ---
      if (currentIndex === lines.length) {
        // 1. 文字行出完后，立即（或延迟一小会儿）显示 text-block
        setTimeout(() => {
          textBlock.classList.add('show');
          textBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // 2. 在 text-block 显示 5 秒后，显示按钮
          setTimeout(() => {
            btnContainer.classList.add('show');
            btnContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 5000); //

        }, 800);
      }
      // --------------------
    }
  });
});