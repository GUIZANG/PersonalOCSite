(() => {
  const messages = [
    "UNAUTHORIZED ACCESS",
    "SECURITY PROTOCOL ACTIVE",
    "INTRUSION DETECTED",
    "YOU HAVE BEEN WARNED"
  ];
  const charset = "0123456789!@$&#%=+-^*/?]>×ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const glitchElement = document.getElementById("warning");

  let currentStage = 0;
  let glitchInterval = null;
  let recoverTimer = null;
  let scrollTimeout = null;
  let lastScrollRatio = 0;
  
  // 状态锁：如果正在切换大句子，禁止其他干扰
  let isTransitioning = false;

  function getStage(scrollRatio) {
    if (scrollRatio < 1.75) return 0;
    if (scrollRatio < 3.5) return 1;
    if (scrollRatio < 5.25) return 2;
    return 3;
  }

  // 清除所有定时器
  function clearAllTimers() {
    if (glitchInterval) clearInterval(glitchInterval);
    if (recoverTimer) clearInterval(recoverTimer);
    glitchInterval = null;
    recoverTimer = null;
  }

  // 1. 切换句子的核心动画
  function playGlitchAnimation(newStage, direction) {
    isTransitioning = true;
    clearAllTimers();

    const oldMsg = messages[currentStage];
    const newMsg = messages[newStage];
    
    // 获取新旧字符串的最大长度，确保容器不会突然收缩
    const maxLen = Math.max(oldMsg.length, newMsg.length);
    
    let step = 0;
    // 增加一点缓冲长度，让扫描彻底完成
    const totalSteps = maxLen + 2;

    function glitchFrame() {
      // 动画结束条件：扫描进度超过了最长字符串
      if (step >= totalSteps) {
        currentStage = newStage;
        glitchElement.textContent = newMsg; // 最终校准为新句子
        isTransitioning = false;
        
        // 动画结束，如果用户还在滚动，恢复扰动逻辑
        if (lastScrollRatio !== (window.scrollY / window.innerHeight)) {
           startGlitchInterval();
        }
        return;
      }

      let result = "";
      for (let i = 0; i < maxLen; i++) {
        // 1. 如果扫描线已经过了这一位，显示新句子的字符
        if (i < step) {
          result += newMsg[i] || ""; // 如果新句较短，超出部分自然消失
        }
        // 2. 如果扫描线刚好在这一位，或者还没到，显示随机乱码
        else {
          // 只有当这一位原本有字符或即将有字符时，才显示乱码闪烁
          if (i < oldMsg.length || i < newMsg.length) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
          }
        }
      }

      glitchElement.textContent = result;
      
      // 控制扫描速度：1 是每帧移动一位，0.5 是每两帧移动一位
      step += 0.7;
      requestAnimationFrame(glitchFrame);
    }

    requestAnimationFrame(glitchFrame);
  }

  // 2. 平时滚动的扰动
  function startGlitchInterval() {
    if (isTransitioning || glitchInterval || recoverTimer) return;

    glitchInterval = setInterval(() => {
      let baseStr = messages[currentStage];
      let arr = baseStr.split("");
      const glitchCount = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < glitchCount; i++) {
        const idx = Math.floor(Math.random() * arr.length);
        arr[idx] = charset.charAt(Math.floor(Math.random() * charset.length));
      }
      glitchElement.textContent = arr.join("");
    }, 30);
  }

  // 3. 停止滚动后的恢复
  function startRecovery() {
    if (isTransitioning || recoverTimer) return;
    
    if (glitchInterval) {
      clearInterval(glitchInterval);
      glitchInterval = null;
    }

    let baseStr = messages[currentStage];
    let length = baseStr.length;
    let recoveringCount = 0;

    recoverTimer = setInterval(() => {
      let display = "";
      recoveringCount++;
      for (let i = 0; i < length; i++) {
        display += (i < recoveringCount) ? baseStr[i] : charset.charAt(Math.floor(Math.random() * charset.length));
      }
      glitchElement.textContent = display;

      if (recoveringCount >= length) {
        clearInterval(recoverTimer);
        recoverTimer = null;
      }
    }, 30);
  }

  window.addEventListener("scroll", () => {
    const scrollRatio = window.scrollY / window.innerHeight;
    const newStage = getStage(scrollRatio);
    const direction = scrollRatio > lastScrollRatio ? 1 : -1;

    if (newStage !== currentStage) {
      // 跨阶段切换
      playGlitchAnimation(newStage, direction);
    } else if (!isTransitioning) {
      // 同阶段滚动，开启扰动
      startGlitchInterval();
    }

    // 处理停止滚动逻辑
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (!isTransitioning) {
        startRecovery();
      }
    }, 300);

    lastScrollRatio = scrollRatio;
  });

  // 初始化
  glitchElement.textContent = messages[0];
})();