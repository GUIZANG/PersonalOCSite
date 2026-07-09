const scrollFill = document.getElementById('scrollFill');
const scrollHint = document.getElementById('scrollHint');
// 获取所有的标记位
const markers = document.querySelectorAll('.scroll-marker');
const storageKey = 'awake.txt';
let saveTimer = null;
let scrollHintTimer = null;
let scrollHintSettleTimer = null;
let scrollHintArrowTween = null;
let scrollHintArrowPath = null;
let isScrollHintAnimating = false;
let hasScrollInput = false;
let scrollHintDirection = 'down';

const arrowPathByDirection = {
  down: 'M1.75 2.65C2.75 3.85 3.42 4.58 4 5.05C4.58 4.58 5.25 3.85 6.25 2.65',
  up: 'M1.75 5.35C2.75 4.15 3.42 3.42 4 2.95C4.58 3.42 5.25 4.15 6.25 5.35'
};

const classByLabel = {
  Void: 'past',
  Dazed: 'present',
  Lucid: 'future'
};

// 仅负责“保存数据”：把当前心境标签存起来，供别处以后调用。
// 这只是一份数据记录，不决定哪个标记亮起。
function saveCurrentLabel(label) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(storageKey, label);
  }, 300);
}

// 仅负责“点亮”：高亮某一个标记，纯视觉，不做保存。
function setActiveLabel(label) {
  markers.forEach(marker => marker.classList.remove('active'));
  document.querySelector(`.scroll-marker.${classByLabel[label]}`)?.classList.add('active');
}

// 剧情进度（切换次数）只用来保存数据，不覆盖“按进度点亮”的逻辑。
window.setHomepageLabel = (label) => {
  saveCurrentLabel(label);
};

// 亮哪个只取决于进度条位置：前 1/3 Void，中间 1/3 Dazed，最后 1/3 Lucid。
function labelForProgress(percent) {
  if (percent < 100 / 3) return 'Void';
  if (percent < 200 / 3) return 'Dazed';
  return 'Lucid';
}

function initScrollHintArrow() {
  if (!scrollHint) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const arrow = document.createElementNS(svgNamespace, 'svg');
  const arrowPath = document.createElementNS(svgNamespace, 'path');

  arrow.setAttribute('class', 'scroll-hint-arrow');
  arrow.setAttribute('viewBox', '0 0 8 8');
  arrow.setAttribute('aria-hidden', 'true');
  arrowPath.setAttribute('d', arrowPathByDirection.down);
  arrow.appendChild(arrowPath);
  scrollHint.appendChild(arrow);
  scrollHintArrowPath = arrowPath;
  setScrollHintDirection('down');

  if (!window.gsap) return;

  const pathLength = arrowPath.getTotalLength();
  window.gsap.set(arrowPath, {
    strokeDasharray: pathLength,
    strokeDashoffset: pathLength
  });

  window.gsap.to(arrowPath, {
    strokeDashoffset: 0,
    duration: 0.85,
    ease: 'power2.out',
    delay: 0.1,
    onComplete: () => {
      scrollHintArrowTween = window.gsap.to(arrowPath, {
        opacity: 0.62,
        duration: 1.35,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      });
    }
  });
}

function setScrollHintDirection(direction) {
  if (!scrollHint) return;

  scrollHintDirection = direction === 'up' ? 'up' : 'down';
  scrollHint.classList.toggle('is-up', scrollHintDirection === 'up');
  scrollHint.classList.toggle('is-down', scrollHintDirection === 'down');

  if (!scrollHintArrowPath) return;

  scrollHintArrowPath.setAttribute('d', arrowPathByDirection[scrollHintDirection]);

  if (window.gsap) {
    const pathLength = scrollHintArrowPath.getTotalLength();

    window.gsap.set(scrollHintArrowPath, {
      strokeDasharray: pathLength,
      strokeDashoffset: 0
    });
  }
}

function resetScrollHintArrow() {
  if (!scrollHintArrowPath || !window.gsap) return;

  window.gsap.set(scrollHintArrowPath, {
    clearProps: 'transform',
    opacity: 1
  });
}

function setScrollHintBreathing(isBreathing) {
  if (!scrollHintArrowTween) return;

  if (isBreathing) {
    resetScrollHintArrow();
    scrollHintArrowTween.play();
    return;
  }

  scrollHintArrowTween.pause();
  resetScrollHintArrow();
}

function transmitScrollHint(direction = scrollHintDirection) {
  if (!scrollHint) return;
  if (isScrollHintAnimating) return;

  isScrollHintAnimating = true;
  setScrollHintDirection(direction);

  if (scrollHintSettleTimer) {
    clearTimeout(scrollHintSettleTimer);
    scrollHint.classList.remove('is-settling');
    scrollHint.classList.remove('is-release-up');
  }

  scrollHint.classList.add('is-transmitting');
  setScrollHintBreathing(false);

  if (scrollHintTimer) clearTimeout(scrollHintTimer);
  scrollHintTimer = setTimeout(() => {
    const shouldReleaseUp = scrollHintDirection === 'up';
    scrollHint.classList.remove('is-transmitting');
    scrollHint.classList.toggle('is-release-up', shouldReleaseUp);
    setScrollHintDirection('down');
    scrollHint.classList.add('is-settling');
    resetScrollHintArrow();
    scrollHintSettleTimer = setTimeout(() => {
      scrollHint.classList.remove('is-settling');
      scrollHint.classList.remove('is-release-up');
      resetScrollHintArrow();
      setScrollHintBreathing(true);
      isScrollHintAnimating = false;
    }, 1020);
  }, 960);
}

function updateScrollHintState(scrollTop) {
  if (!scrollHint) return;

  const isUserScrolled = hasScrollInput && scrollTop > 2;
  scrollHint.classList.toggle('is-scrolled', isUserScrolled);
  setScrollHintBreathing(!isScrollHintAnimating);
}

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;
  const scrollable = docHeight - winHeight;

  const scrolled = scrollable > 0 ? (scrollTop / scrollable) * 100 : 0;

  // 更新进度条高度
  scrollFill.style.height = `${scrolled}%`;

  // 按进度点亮，并把当前标签作为数据保存起来
  const label = labelForProgress(scrolled);
  setActiveLabel(label);
  saveCurrentLabel(label);
  updateScrollHintState(scrollTop);
});

window.addEventListener('wheel', (event) => {
  hasScrollInput = true;
  transmitScrollHint(event.deltaY < 0 ? 'up' : 'down');
}, { passive: true });

window.addEventListener('keydown', (event) => {
  const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];

  if (scrollKeys.includes(event.key)) {
    hasScrollInput = true;
    const isUp = event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home' || (event.key === ' ' && event.shiftKey);
    transmitScrollHint(isUp ? 'up' : 'down');
  }
}, { passive: true });

// 初始状态：进度为 0，点亮 Void
initScrollHintArrow();
setActiveLabel(labelForProgress(0));
updateScrollHintState(window.pageYOffset || document.documentElement.scrollTop);
