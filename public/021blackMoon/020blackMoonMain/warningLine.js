function startGlitchEffect() {
    const chars = "01io"; // 你要求的 10io 随机变动范围
    const textElements = document.querySelectorAll('.random-text');
    
    setInterval(() => {
        textElements.forEach(el => {
            let result = '';
            for (let i = 0; i < 8; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            el.innerText = result;
        });
    }, 100); // 30ms 变动频率
}

// 页面加载后启动
window.onload = () => {
    startGlitchEffect();
    // 如果你有其他的 ASCII 生成函数，也可以在这里调用
};