const text = "ẼÇŁĪẞŞÎŚ";
const container = document.getElementById("container");

// 定义方向及对应class名
const directions = [
  { name: "up", oldClass: "old-up", newClass: "new-up" },
  { name: "down", oldClass: "old-down", newClass: "new-down" },
  { name: "left", oldClass: "old-left", newClass: "new-left" },
  { name: "right", oldClass: "old-right", newClass: "new-right" }
];

// 初始化每个字母
const letters = [];

for(let i=0; i<text.length; i++){
  const wrapper = document.createElement("div");
  wrapper.classList.add("letter-wrapper");

  // 旧字母span，初始在中间
  const oldLetter = document.createElement("span");
  oldLetter.classList.add("letter");
  oldLetter.textContent = text[i];

  wrapper.appendChild(oldLetter);
  container.appendChild(wrapper);

  letters.push({wrapper, oldLetter, currentLetter: text[i]});
}

// 随机整数
function randomInt(min,max){
  return Math.floor(Math.random()*(max-min+1)) + min;
}

function startLoop(){
  const delay = randomInt(900,1500);
  setTimeout(() => {
    const idx = randomInt(0, letters.length-1);
    const dir = directions[randomInt(0, directions.length-1)];

    animateSwap(idx, dir);

    startLoop();
  }, delay);
}

function animateSwap(idx, dir){
  const obj = letters[idx];
  const {wrapper, oldLetter} = obj;

  // 新字母元素，从对应方向外面进来
  const newLetter = document.createElement("span");
  newLetter.classList.add("letter", dir.newClass);
  newLetter.textContent = obj.currentLetter;

  // 旧字母动画class
  oldLetter.classList.add(dir.oldClass);

  wrapper.appendChild(newLetter);

  // 动画结束处理
  function cleanup(){
    // 旧字母移除动画并复位位置
    oldLetter.classList.remove(dir.oldClass);
    oldLetter.style.transform = "none";
    // 删除新字母
    wrapper.removeChild(newLetter);
    oldLetter.removeEventListener("animationend", cleanup);
  }

  newLetter.addEventListener("animationend", cleanup);
}

startLoop();

const bottomBar = document.getElementById("bottom-bar");
const containerEl = document.getElementById("container");

let locked = false;

function checkBottomBar() {
  if (locked) return;

  const rect = bottomBar.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  if (rect.bottom >= viewportHeight) {
    bottomBar.classList.add("fixed-bottom");
    containerEl.style.display = "none";
    locked = true;
  }
}

/* 监听滚动（兜底） */
window.addEventListener("scroll", checkBottomBar);
window.addEventListener("resize", checkBottomBar);

/* 监听布局变化（关键） */
const resizeObserver = new ResizeObserver(() => {
  checkBottomBar();
});

/* 观察会影响布局的元素 */
resizeObserver.observe(document.body);

/* 初始立即检测 */
checkBottomBar();
