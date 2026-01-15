(function() {
    // 立即锁定函数，不等待 DOM 完备
    const body = document.documentElement;
    
    function forceCenter() {
        const container = document.getElementById('ascii-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetY = rect.top + scrollTop + (rect.height / 2.4) - (window.innerHeight / 2);
            window.scrollTo(0, targetY);
        }
    }

    // 1. 严格拦截所有滚动行为
    const lockHandler = (e) => {
        e.preventDefault();
        forceCenter();
    };

    window.addEventListener('wheel', lockHandler, { passive: false });
    window.addEventListener('touchmove', lockHandler, { passive: false });
    window.addEventListener('scroll', forceCenter);

    // 2. 当 DOM 加载完成
    document.addEventListener('DOMContentLoaded', () => {
        const asciiText = document.getElementById('ascii-text');
        
        // 确保 ASCII 内容已经存在，如果没有，可以先填入占位符
        if (asciiText && asciiText.innerText.trim() === "") {
            asciiText.innerText = "LOADING ECLIPSE...";
        }

        // 执行定位
        forceCenter();

        // 定位完成后，显示 body
        setTimeout(() => {
            document.body.classList.add('ready');
        }, 50);
    });

    // 3. 10秒后彻底释放
    setTimeout(() => {
        window.removeEventListener('wheel', lockHandler);
        window.removeEventListener('touchmove', lockHandler);
        window.removeEventListener('scroll', forceCenter);
        document.body.classList.remove('lock-scroll');
        console.log("SYSTEM RELEASED");
    }, 23000);
})();