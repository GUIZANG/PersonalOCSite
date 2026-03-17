(function() {
    const audio = document.getElementById("bgm");
    const btn = document.getElementById("musicBtn");
    const bars = document.querySelectorAll(".bar");
    
    let audioCtx, analyser, dataArray;
    let initialized = false;
    let lastHeights = [4, 4, 4, 4];

    function initAudioVisualizer() {
        if (initialized) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; // 提高分辨率，把低频和中频分得更开
        
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        initialized = true;
        renderFrame();
    }

    function renderFrame() {
        if (!audio.paused) {
            analyser.getByteFrequencyData(dataArray);

        for (let i = 0; i < bars.length; i++) {
            const start = i * 4;
            const end = start + 4;
        
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += dataArray[j];
            }
        
            const value = sum / 4;
            const height = Math.max(6, (value / 255) * 20);
            bars[i].style.height = height + "px";
            }
        } else {
            // 停止时缓缓回位
            bars.forEach((bar, i) => {
                lastHeights[i] += (6 - lastHeights[i]) * 0.1;
                bar.style.height = lastHeights[i] + 'px';
            });
        }
        requestAnimationFrame(renderFrame);
    }

    // 事件绑定逻辑
    const toggle = () => {
        initAudioVisualizer();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        audio.paused ? audio.play() : audio.pause();
    };

    btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    document.addEventListener('click', () => { if(audio.paused) toggle(); }, { once: true });
})();