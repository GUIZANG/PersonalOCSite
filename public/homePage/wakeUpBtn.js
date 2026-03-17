const textEl = document.querySelector("#wake-up-btn .text");
const text = textEl.textContent.trim();
textEl.textContent = "";

const total = text.length;

text.split("").forEach((char, i) => {
  const span = document.createElement("span");
  span.className = "char";
  span.dataset.char = char;
  span.textContent = char === " " ? "\u00A0" : char;

  // 计算延迟：i / total 产生 0 到 1 的线性增长
  // 乘以 0.3s 让整个动作在 0.3s 内先后完成，显得紧凑
  const delay = (i / total) * 0.3;
  span.style.setProperty('--delay', `${delay}s`);

  textEl.appendChild(span);
});