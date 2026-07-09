const extraChars = "月眼看逃躲藏离走怕".split('');
const randomPool = "月眼看逃躲藏离走怕";

document.querySelectorAll('.short-line').forEach(container => {
    const text = container.innerText;
    const match = text.match(/\[(.*)\]/);
    if (!match) return;

    const targetContent = match[1];
    const targetLen = targetContent.length;
    let baseWord = "悬停以查看".split('');

    // --- 改进后的增减逻辑 ---
    if (targetLen > baseWord.length) {
        // 增字：在随机位置插入
        while (baseWord.length < targetLen) {
            const randIdx = Math.floor(Math.random() * (baseWord.length + 1));
            const randChar = extraChars[Math.floor(Math.random() * extraChars.length)];
            baseWord.splice(randIdx, 0, randChar);
        }
    } else if (targetLen < baseWord.length) {
        // 删字：利用洗牌算法随机选出要保留的索引
        let indices = Array.from({length: baseWord.length}, (_, i) => i);
        // 洗牌
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        // 取前 targetLen 个索引并排序，保证剩下的字顺序是对的
        const keepIndices = indices.slice(0, targetLen).sort((a, b) => a - b);
        baseWord = keepIndices.map(i => baseWord[i]);
    }
    // --- 逻辑结束 ---

    // 重新构建 DOM
    container.innerHTML = `&gt;[<span class="slot-wrapper"></span>]&lt;`;
    const wrapper = container.querySelector('.slot-wrapper');

    targetContent.split('').forEach((targetChar, i) => {
        const column = document.createElement('div');
        column.className = 'slot-column';
        const track = document.createElement('div');
        track.className = 'slot-track';
        
        const iterations = 15;
        let trackHTML = `<div>${baseWord[i] || ' '}</div>`; // 初始字
        for (let j = 0; j < iterations - 1; j++) {
            trackHTML += `<div>${randomPool[Math.floor(Math.random() * randomPool.length)]}</div>`;
        }
        trackHTML += `<div>${targetChar}</div>`; // 目标字
        
        track.innerHTML = trackHTML;

        // 这里的速度和延迟保持之前的优雅设置
        track.style.setProperty('--target-offset', `-${iterations}em`);
        track.style.setProperty('--speed', `${1.5 + i * 0.3}s`);
        track.style.setProperty('--delay', `${i * 0.05}s`);

        column.appendChild(track);
        wrapper.appendChild(column);
    });
});