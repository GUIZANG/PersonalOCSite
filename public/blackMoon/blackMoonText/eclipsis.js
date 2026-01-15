const containers = document.querySelectorAll('.text-container');

containers.forEach(container => {
  const mask = container.querySelector('.mask');

  let isHover = false;
  let isAnimating = false;
  let direction = 'idle'; 

  function forceReflow() {
    // 关键：强制浏览器结算当前帧
    mask.offsetHeight;
  }

  function playForward() {
    if (isAnimating || direction === 'forward') return;
    direction = 'forward';
    isAnimating = true;

    container.classList.remove('reverse');
    forceReflow();
    container.classList.add('forward');
  }

  function playReverse() {
    if (isAnimating || direction === 'reverse') return;
    direction = 'reverse';
    isAnimating = true;

    container.classList.remove('forward');
    forceReflow();
    container.classList.add('reverse');
  }

  container.addEventListener('mouseenter', () => {
    isHover = true;
    playForward();
  });

  container.addEventListener('mouseleave', () => {
    isHover = false;
    if (!isAnimating && direction === 'forward + done') {
      playReverse();
    }
  });

  mask.addEventListener('transitionend', e => {
    if (!e.propertyName.includes('mask-position')) return;

    isAnimating = false;

    if (direction === 'forward') {
      direction = 'forward + done';
      if (!isHover) {
        playReverse();
      }
    }

    if (direction === 'reverse') {
      direction = 'idle';
    }
  });
});
