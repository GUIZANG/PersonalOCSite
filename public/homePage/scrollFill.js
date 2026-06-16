const scrollFill = document.getElementById('scrollFill');
// 获取所有的标记位
const markers = document.querySelectorAll('.scroll-marker');
const storageKey = 'homepage.txt';
let saveTimer = null;
let forcedLabel = null;

function saveCurrentLabel(label) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(storageKey, label);
  }, 300);
}

function setActiveLabel(label) {
  const classByLabel = {
    Void: 'past',
    Dazed: 'present',
    Lucid: 'future'
  };

  markers.forEach(marker => marker.classList.remove('active'));
  document.querySelector(`.scroll-marker.${classByLabel[label]}`)?.classList.add('active');
  saveCurrentLabel(label);
}

window.setHomepageLabel = (label) => {
  forcedLabel = label;
  setActiveLabel(label);
};

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;
  const scrollable = docHeight - winHeight;
  
  const scrolled = scrollable > 0 ? (scrollTop / scrollable) * 100 : 0;
  
  // 1. 更新进度条高度
  scrollFill.style.height = `${scrolled}%`;

  if (forcedLabel) {
    setActiveLabel(forcedLabel);
    return;
  }

  // 2. 处理标记位亮起的逻辑
  if (scrolled > 98) {
    // 当滑动接近底部（>98%）时，全部变亮
    markers.forEach(marker => marker.classList.add('active'));
    saveCurrentLabel('Lucid');
  } else if (scrolled < 2) {
    // 当在顶部时，只有第一行 Void 亮起（可选）
    setActiveLabel('Void');
  } else {
    // 在中间滚动时，根据进度决定谁亮（原本的逻辑）
    if (scrolled < 40) {
      setActiveLabel('Void');
    } else if (scrolled >= 40 && scrolled < 80) {
      setActiveLabel('Dazed');
    } else {
      setActiveLabel('Lucid');
    }
  }
});