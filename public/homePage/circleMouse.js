class GlitchEffect {
    constructor() {
        this.root = document.body;
        this.cursor = document.querySelector(".curzr-glitch-effect");

        this.distanceX = 0;
        this.distanceY = 0;
        this.pointerX = 0;
        this.pointerY = 0;
        this.previousPointerX = 0;
        this.previousPointerY = 0;
        this.cursorSize = 15;
        
        this.cursorStyle = {
            boxSizing: 'border-box',
            position: 'fixed',
            top: `${this.cursorSize / -2}px`,
            left: `${this.cursorSize / -2}px`,
            zIndex: '2147483647',
            width: `${this.cursorSize}px`,
            height: `${this.cursorSize}px`,
            borderRadius: '50%',
            // --- 核心修改：增加过渡时间，并使用具有弹性感的贝塞尔曲线 ---
            transition: 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1), height 0.3s cubic-bezier(0.25, 1, 0.5, 1), top 0.3s cubic-bezier(0.25, 1, 0.5, 1), left 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s',
            // 注意：transform 这里不需要 transition，否则移动时会有延迟感
            userSelect: 'none',
            pointerEvents: 'none'
        };
        
        if (CSS.supports("backdrop-filter", "invert(1)")) {
            // 0-360deg
            this.cursorStyle.backdropFilter = 'invert(1) hue-rotate(135deg) brightness(1.2)';
            this.cursorStyle.backgroundColor = '#fff0';
        } else {
            this.cursorStyle.backgroundColor = '#000';
        }

        this.init(this.cursor, this.cursorStyle);
    }

    init(el, style) {
        Object.assign(el.style, style);
        setTimeout(() => {
            this.cursor.removeAttribute("hidden");
            this.cursor.style.opacity = 1;
        }, 500);
    }

    move(event) {
        this.pointerX = event.clientX;
        this.pointerY = event.clientY;
    
        const isHovering = event.target.closest('a') ||
                           event.target.closest('button') ||
                           event.target.classList.contains('curzr-hover');
    
        this.isHovering = isHovering;
    
        if (!this.isPressed) {
            // Hover 时放大到 2.5，平时为 1
            const scale = isHovering ? 2.5 : 1;
            this.cursor.style.transform = `translate3d(${this.pointerX}px, ${this.pointerY}px, 0) scale(${scale})`;
        } else {
            // 按下状态：保持 0.4 的缩小倍率，仅更新坐标
            this.cursor.style.transform = `translate3d(${this.pointerX}px, ${this.pointerY}px, 0) scale(0.4)`;
        }
    }
    
    hover() {
        // 放大倍率和偏移量同步平滑过渡
        this.cursor.style.width = '60px';
        this.cursor.style.height = '60px';
        this.cursor.style.top = '-30px';
        this.cursor.style.left = '-30px';
    }
    
    hoverout() {
        this.cursor.style.width = '15px';
        this.cursor.style.height = '15px';
        this.cursor.style.top = '-7.5px';
        this.cursor.style.left = '-7.5px';
    }
    
    press() {
        this.isPressed = true;
        // 增加到 0.4，稍微大一圈，更有“按压感”
        this.cursor.style.transition = 'transform 0.1s ease-in, opacity 0.2s';
        this.cursor.style.transform = `translate3d(${this.pointerX}px, ${this.pointerY}px, 0) scale(0.4)`;
        this.cursor.style.opacity = '0.7'; // 稍微提高点透明度，让这个“点”更扎实
    }
    
    release() {
        this.isPressed = false;
        // 回弹过渡
        this.cursor.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s';
        this.cursor.style.opacity = '1';
        
        // 弹回目标大小：如果是 hover 则弹回 2.5，否则弹回 1
        const scale = this.isHovering ? 2.5 : 1;
        this.cursor.style.transform = `translate3d(${this.pointerX}px, ${this.pointerY}px, 0) scale(${scale})`;
    }

    stop() {
        if (!this.moving) {
            this.moving = true;
            setTimeout(() => {
                this.cursor.style.boxShadow = '';
                this.moving = false;
            }, 50);
        }
    }
}

const cursor = new GlitchEffect();
document.onmousemove = function (event) {
    cursor.move(event);
};
document.onmousedown = function () {
    cursor.press();
};

document.onmouseup = function () {
    cursor.release();
};