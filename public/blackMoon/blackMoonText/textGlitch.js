const GLITCH_CHARS = "0123456789<>/|[]{}!@#$%^&*-=+_";

let glitchTimers = new Map();  // 元素 => timerId
let originalTexts = new Map(); // 元素 => 原始文本

function glitchText(el) {
  const originalText = originalTexts.get(el);
  if (!originalText) return;

  const text = originalText.split("");
  const count = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * text.length);
    text[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  }

  el.textContent = text.join("");
}

function startGlitch(el) {
  if (glitchTimers.has(el)) return; // 已经在闪了

  originalTexts.set(el, el.textContent);
  const timer = setInterval(() => glitchText(el), 200);
  glitchTimers.set(el, timer);
}

function stopGlitch(el) {
  if (!glitchTimers.has(el)) return;

  clearInterval(glitchTimers.get(el));
  glitchTimers.delete(el);

  if (originalTexts.has(el)) {
    el.textContent = originalTexts.get(el);
    originalTexts.delete(el);
  }
}

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) {
    // 取消所有闪烁
    for (const el of glitchTimers.keys()) {
      stopGlitch(el);
    }
    return;
  }

  const range = selection.getRangeAt(0);

  // 找出选区内所有被选的 .text-line 元素
  const selectedLines = [];

  // 获取选区父节点的公共祖先
  const commonAncestor = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;

  // 找所有 .text-line 子元素
  const candidates = commonAncestor.querySelectorAll(".text-line");

  candidates.forEach(el => {
    const elRange = document.createRange();
    elRange.selectNodeContents(el);

    // 判断elRange和选区range是否相交
    if (
      range.compareBoundaryPoints(Range.END_TO_START, elRange) < 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, elRange) > 0
    ) {
      selectedLines.push(el);
    }
  });

  // 先停止之前没被选中的元素闪烁
  for (const el of [...glitchTimers.keys()]) {
    if (!selectedLines.includes(el)) {
      stopGlitch(el);
    }
  }

  // 启动被选中的闪烁
  selectedLines.forEach(el => {
    startGlitch(el);
  });
});
