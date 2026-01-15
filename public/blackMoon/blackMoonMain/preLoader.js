// preLoader.js

async function runTypewriter() {
  const preElement = document.getElementById('ascii-pre');
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&/\\|{}[];:<>?.";
  
  // 1. 物理屬性獲取
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const testSpan = document.createElement('span');
  testSpan.style.font = "1rem SupplyMono, monospace";
  testSpan.textContent = "M";
  document.body.appendChild(testSpan);
  const charWidth = testSpan.getBoundingClientRect().width;
  document.body.removeChild(testSpan);

  const cols = Math.floor(window.innerWidth / charWidth);
  const rows = Math.floor((window.innerHeight * 1.5) / fontSize);
  
  // 2. 初始化行數據
  const lines = [];
  for (let i = 0; i < rows; i++) {
    lines.push({
      targetLength: cols,
      currentLength: 0,
      // 關鍵修改：不再用 growthRate 判定機率
      // 改用 startDelay，讓每一行在隨機的幀數後才開始啟動
      // 這樣每一行跑的速度都是 35ms/格，但因為起點不同，會產生極其漂亮的長短不一感
      startDelay: Math.floor(Math.random() * 50),
      contentArray: [],
      isDone: false
    });
  }

  const threshold = Math.floor(rows * 0.95);
  let currentFrame = 0; // 記錄當前跑了多少幀

  return new Promise((resolve) => {
    const typingInterval = setInterval(() => {
      let frameDisplay = "";
      let finishedLinesCount = 0;
      currentFrame++;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // --- A. 生長邏輯：當前幀超過延遲幀數時，每一幀必定增長一個字符 ---
        if (currentFrame > line.startDelay) {
          if (line.currentLength < line.targetLength) {
            line.currentLength++;
            line.contentArray.push(charset[Math.floor(Math.random() * charset.length)]);
          } else {
            line.isDone = true;
          }
        }

        if (line.isDone) finishedLinesCount++;

        // --- B. 亂碼動畫：每一幀都瘋狂變換已有的字符 (35ms 頻率) ---
        for (let j = 0; j < line.contentArray.length; j++) {
            if (Math.random() > 0.15) {
                line.contentArray[j] = charset[Math.floor(Math.random() * charset.length)];
            }
        }
        
        frameDisplay += line.contentArray.join('') + "\n";
      }

      preElement.textContent = frameDisplay;
      
      if (finishedLinesCount >= threshold) {
        clearInterval(typingInterval);
        document.dispatchEvent(new CustomEvent('preloadingComplete'));
        resolve();
      }
    }, 35); // 嚴格 35ms 週期
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.fonts.ready.then(runTypewriter);
});