(() => {
  const messages = [
    "UNAUTHORIZED ACCESS",
    "SECURITY PROTOCOL ACTIVE",
    "INTRUSION DETECTED",
    "YOU HAVE BEEN WARNED"
  ];

  const charset = "0123456789!@$&#%=+-^*/?]>×ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const glitchElement = document.getElementById("warning");

  let viewportHeight = window.innerHeight;
  let lastScrollRatio = 0;
  let currentStage = 0; // 0~3对应messages索引
  let isScrolling = false;
  let scrollTimeout = null;
  let glitchInterval = null;

  // 当前显示文字数组（单个字符），方便逐字替换
  let displayedChars = [];
  // 当前文字是否处于“恢复中”，恢复的字母数量
  let recoveringCount = 0;
  // 恢复动画最大步骤（等于字符串长度）
  let maxRecoverStep = 0;
  // 恢复动画的定时器ID
  let recoverTimer = null;

  // 计算当前scrollRatio(0~1)和对应阶段(0-3)
  function getStage(scrollRatio) {
    if (scrollRatio < 0.75) return 0;
    if (scrollRatio < 1.5) return 1;
    if (scrollRatio < 2.25) return 2;
    return 3;
  }

  // 生成指定长度的乱码字符串
  function genGlitchString(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  // 文字切换时播放乱码动画
  // direction: 1 向下滚动切换，用新句长度; -1 向上滚动切换，用旧句长度
  function playGlitchAnimation(newStage, direction) {
    const newMsg = messages[newStage];
    const oldMsg = messages[currentStage];
    const glitchLen = direction === 1 ? newMsg.length : oldMsg.length;

    // 停止任何现有恢复动画和扰动
    if (recoverTimer) {
      clearInterval(recoverTimer);
      recoverTimer = null;
    }
    if (glitchInterval) {
      clearInterval(glitchInterval);
      glitchInterval = null;
    }

    let frameCount = 0;
    const maxFrames = 15; // 15帧约450ms动画

    function glitchFrame() {
      if (frameCount >= maxFrames) {
        // 动画结束，切换文字为纯新句
        currentStage = newStage;
        displayedChars = newMsg.split("");
        glitchElement.textContent = newMsg;
        startGlitchInterval();
        return;
      }
      let glitchStr = "";
      for (let i = 0; i < glitchLen; i++) {
        // 动画后半部分逐步恢复正常字母
        if (frameCount > maxFrames / 2 && i < (frameCount - maxFrames / 2) * 2) {
          // 逐渐恢复字母（用对应句的字符，若长度不够则用空格）
          let ch = (direction === 1 ? newMsg : oldMsg).charAt(i) || " ";
          glitchStr += ch;
        } else {
          glitchStr += charset.charAt(Math.floor(Math.random() * charset.length));
        }
      }
      glitchElement.textContent = glitchStr;
      frameCount++;
      requestAnimationFrame(glitchFrame);
    }
    glitchFrame();
  }

  // 鼠标滚动时文字轻微扰动，4~9个字符变乱码，30ms刷新一次
  function startGlitchInterval() {
    if (glitchInterval) return; // 避免重复启动

    glitchInterval = setInterval(() => {
      if (recoverTimer) return; // 恢复动画时不扰动

      let baseStr = messages[currentStage];
      let arr = baseStr.split("");
      const len = arr.length;
      // 干扰4~9个字符
      const glitchCount = 4 + Math.floor(Math.random() * 6);
      const indices = [];
      while (indices.length < glitchCount) {
        const idx = Math.floor(Math.random() * len);
        if (!indices.includes(idx)) indices.push(idx);
      }
      for (let idx of indices) {
        arr[idx] = charset.charAt(Math.floor(Math.random() * charset.length));
      }
      glitchElement.textContent = arr.join("");
    }, 30);
  }

  // 停止扰动，开始恢复动画
  function startRecovery() {
    if (recoverTimer) return;

    // 停止扰动
    if (glitchInterval) {
      clearInterval(glitchInterval);
      glitchInterval = null;
    }

    let baseStr = messages[currentStage];
    let length = baseStr.length;
    let glitchStrArr = [];
    // 全乱码初始化
    for (let i = 0; i < length; i++) {
      glitchStrArr.push(charset.charAt(Math.floor(Math.random() * charset.length)));
    }
    glitchElement.textContent = glitchStrArr.join("");

    recoveringCount = 0;
    maxRecoverStep = length;

    recoverTimer = setInterval(() => {
      recoveringCount++;
      for (let i = 0; i < length; i++) {
        if (i < recoveringCount) {
          glitchStrArr[i] = baseStr.charAt(i);
        } else {
          glitchStrArr[i] = charset.charAt(Math.floor(Math.random() * charset.length));
        }
      }
      glitchElement.textContent = glitchStrArr.join("");
      if (recoveringCount >= maxRecoverStep) {
        clearInterval(recoverTimer);
        recoverTimer = null;
        glitchElement.textContent = baseStr; // 确保全部恢复
      }
    }, 30);
  }

  // 初始化显示第一条消息，默认无扰动
  function init() {
    currentStage = 0;
    glitchElement.textContent = messages[0];
  }

  // 监听滚动，检测分界点跨越，切换文字或扰动
  window.addEventListener("scroll", () => {
    viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollRatio = scrollTop / viewportHeight;

    // 判断新阶段
    const newStage = getStage(scrollRatio);

    // 判断方向
    const direction = scrollRatio > lastScrollRatio ? 1 : -1;

    if (newStage !== currentStage) {
      // 跨分界点切换文字，播放乱码动画
      playGlitchAnimation(newStage, direction);
    } else {
      // 同一阶段，启动扰动
      if (!glitchInterval && !recoverTimer) {
        startGlitchInterval();
      }
    }

    // 取消恢复动画延时
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // 监听停止滚动（300ms无scroll事件视为停止）
    scrollTimeout = setTimeout(() => {
      // 停止滚动，开始恢复动画
      if (glitchInterval) {
        clearInterval(glitchInterval);
        glitchInterval = null;
      }
      startRecovery();
    }, 300);

    lastScrollRatio = scrollRatio;
  });

  window.addEventListener("resize", () => {
    viewportHeight = window.innerHeight;
  });

  init();
})();
