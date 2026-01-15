(() => {
  const imageUrl = "../../../pics/eye.jpg";

  // 字符集保持不变
  const charset = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
  "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n",
  "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "{", "|", "}",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "@", "!", "#", "$", "%",
  "&", "[", "]", "^", "_", "~","'" , "(", ")", "*", "+", ",", "-", ".", "/",
  ":", ";", "<", "=", ">", "?"];

  const asciiContainer = document.getElementById('ascii-container');
  const asciiText = document.getElementById('ascii-text');

  let charWidth = 0;
  let charHeight = 0;

  function measureCharSize() {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '1rem SupplyMono, monospace';
    const metrics = ctx.measureText('M');
    charWidth = metrics.width;
    charHeight = 1.2 * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function getScreenSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  function calcCharSize(screenW, screenH) {
    const cols = Math.floor(screenW / charWidth);
    const rows = Math.floor(screenH / charHeight);
    return {cols, rows};
  }

  function loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => res(img);
      img.onerror = e => rej(e);
      img.src = url;
    });
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  function scaleImageToFitWidth(img, targetWidth) {
    const scale = targetWidth / img.width;
    return {
      width: targetWidth,
      height: Math.round(img.height * scale),
      scale
    };
  }

  function getPixelBrightness(r, g, b) {
    return (r + g + b) / 3;
  }

  function imageToAscii(imageData, cols, rows) {
    const {width, height, data} = imageData;
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    const asciiArray = [];

    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const startX = Math.floor(x * cellWidth);
        const startY = Math.floor(y * cellHeight);
        const endX = Math.min(Math.floor((x + 1) * cellWidth), width);
        const endY = Math.min(Math.floor((y + 1) * cellHeight), height);

        let totalBrightness = 0;
        let rSum = 0, gSum = 0, bSum = 0;
        let count = 0;

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const idx = (py * width + px) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a === 0) continue;

            const brightness = getPixelBrightness(r, g, b);
            totalBrightness += brightness;
            rSum += r;
            gSum += g;
            bSum += b;
            count++;
          }
        }

        if (count === 0) {
          row.push({charIndex: charset.length - 1, color: {r: 0, g: 0, b: 0}});
          continue;
        }

        const avgBrightness = totalBrightness / count;
        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);

        const charIdx = charset.length - 1 - Math.min(
          charset.length - 1,
          Math.floor((avgBrightness / 255) * (charset.length - 1))
        );

        row.push({
          charIndex: charIdx,
          color: {r: avgR, g: avgG, b: avgB}
        });
      }
      asciiArray.push(row);
    }
    return asciiArray;
  }

  function generateFullAscii(asciiImg, asciiCols, asciiRows, totalRows) {
    const topRowsCount = Math.floor((totalRows - asciiRows) / 2);
    const bottomRowsCount = totalRows - asciiRows - topRowsCount;

    const topRows = [];
    for (let i = 0; i < topRowsCount; i++) {
      topRows.push(asciiImg[0]);
    }
    const bottomRows = [];
    for (let i = 0; i < bottomRowsCount; i++) {
      bottomRows.push(asciiImg[asciiRows - 1]);
    }

    return [...topRows, ...asciiImg, ...bottomRows];
  }

  function asciiToStringAndColors(asciiArray) {
    let str = "";
    const colors = [];

    for (const row of asciiArray) {
      for (const cell of row) {
        str += charset[cell.charIndex];
        colors.push(cell.color);
      }
      str += "\n";
      colors.push(null);
    }
    return {str, colors};
  }

  function rgbToCss(c) {
    return `rgb(${c.r},${c.g},${c.b})`;
  }

  function interpolateColor(c1, c2, t) {
    return {
      r: Math.min(255, Math.max(0, Math.round(c1.r + (c2.r - c1.r) * t))),
      g: Math.min(255, Math.max(0, Math.round(c1.g + (c2.g - c1.g) * t))),
      b: Math.min(255, Math.max(0, Math.round(c1.b + (c2.b - c1.b) * t)))
    };
  }

  function randomChar() {
    const chars = charset.join('');
    return chars[Math.floor(Math.random() * chars.length)];
  }

  let asciiChars = "";
  let asciiColors = [];
  let glitchRate = 1;
  const glitchStep = 0.005;
  const frameInterval = 20;
  const colorStart = {r: 255, g: 255, b: 255};

  function generateColoredHtml(rate) {
    let html = "";
    for (let i = 0; i < asciiChars.length; i++) {
      const ch = asciiChars[i];
      if (ch === "\n") {
        html += "<br>";
        continue;
      }

      if (rate > 0 && Math.random() < rate) {
        html += `<span style="color: rgb(255,255,255)">` + randomChar() + "</span>";
      } else {
        const colorEnd = asciiColors[i];
        if (colorEnd) {
          const c = rate > 0 ? interpolateColor(colorStart, colorEnd, 1 - rate) : colorEnd;
          html += `<span style="color: rgb(${c.r},${c.g},${c.b})">` + ch + "</span>";
        } else {
          html += ch;
        }
      }
    }
    return html;
  }

  function renderFrame() {
    if (glitchRate > 0.5){
      asciiText.style.letterSpacing = ( Math.random() * 0.2) + "rem";
    }
    if (glitchRate > 0.25) {
      asciiText.style.letterSpacing = ( Math.random() * 0.1) + "rem";
    } else if (glitchRate > 0.015){
      asciiText.style.letterSpacing = ( Math.random() * 0.02) + "rem";
    } else {
      asciiText.style.letterSpacing = "0";
    }
  
    asciiText.innerHTML = generateColoredHtml(glitchRate);
    glitchRate -= glitchStep;
    if (glitchRate < 0) glitchRate = 0;

    if (glitchRate > 0) {
      setTimeout(() => {
        requestAnimationFrame(renderFrame);
      }, frameInterval);
    } else {
      asciiText.innerHTML = generateColoredHtml(0);
    }
  }

  // --- 整合后的 Init 函数，增加了监听逻辑 ---
  async function init() {
    // 监听来自 preLoader.js 的自定义完成信号
    document.addEventListener('preloadingComplete', async () => {
      try {
        // 1. 显示动图容器并确保它覆盖底层
        asciiText.style.display = "block";
        
        // 2. 测量并计算
        measureCharSize();
        const screen = getScreenSize();
        const totalCols = Math.floor(screen.width / charWidth);
        const totalRows = Math.floor((screen.height * 2) / charHeight);

        const img = await loadImage(imageUrl);
        const {width: scaledW, height: scaledH} = scaleImageToFitWidth(img, screen.width);

        canvas.width = scaledW;
        canvas.height = scaledH;
        ctx.clearRect(0, 0, scaledW, scaledH);
        ctx.drawImage(img, 0, 0, scaledW, scaledH);

        const imgCols = totalCols;
        const imgRows = Math.floor(scaledH / charHeight);

        const asciiImg = imageToAscii(ctx.getImageData(0, 0, scaledW, scaledH), imgCols, imgRows);
        const fullAsciiArray = generateFullAscii(asciiImg, imgCols, imgRows, totalRows);
        const {str, colors} = asciiToStringAndColors(fullAsciiArray);

        asciiChars = str;
        asciiColors = colors;

        // 3. 开启渲染帧
        renderFrame();

      } catch (e) {
        console.error("blackMoon.js error:", e);
        asciiText.textContent = "FATAL ERROR: RELOAD REQUIRED";
      }
    });
  }

  window.addEventListener("resize", () => {
    // 保持你的原逻辑，不动态调整
  });

  // 确保字体加载后初始化监听器
  document.fonts.ready.then(() => {
    init();
  });

})();