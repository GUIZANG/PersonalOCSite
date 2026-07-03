const scrollFill = document.getElementById('scrollFill');
// 获取所有的标记位
const markers = document.querySelectorAll('.scroll-marker');
const storageKey = 'homepage.txt';
let saveTimer = null;

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
});

// 初始状态：进度为 0，点亮 Void
setActiveLabel(labelForProgress(0));
