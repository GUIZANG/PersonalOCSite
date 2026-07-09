class GlitchEffect {
    constructor() {
        this.wrapper = document.querySelector(".curzr-cursor-wrap");
        this.cursor = this.wrapper?.querySelector(".curzr-glitch-effect")
            || document.querySelector(".curzr-glitch-effect");

        if (!this.wrapper) {
            this.wrapper = document.createElement("div");
            this.wrapper.className = "curzr-cursor-wrap";
            this.cursor.parentNode.insertBefore(this.wrapper, this.cursor);
            this.wrapper.appendChild(this.cursor);
        }

        this.cursorSize = 15;
        this.hoverScale = 2.5;
        this.ringOvershoot = 1.16;
        this.pointerX = 0;
        this.pointerY = 0;
        this.renderX = 0;
        this.renderY = 0;
        this.currentScale = 1;
        this.targetScale = 1;
        this.invertHold = 0;
        this.invertHoldTarget = 0;
        this.positionEase = 0.12;
        this.scaleEase = 0.16;
        this.invertEase = 0.06;
        this.isHovering = false;
        this.isLeftPressed = false;
        this.isRightPressed = false;
        this.hasPointer = false;
        this.isLoopRunning = false;
        this.supportsBackdrop = CSS.supports("backdrop-filter", "invert(1)");

        this.pulseRing = document.createElement("div");
        this.pulseRing.className = "curzr-pulse-ring";
        if (this.supportsBackdrop) {
            this.pulseRing.classList.add("curzr-pulse-ring--filtered");
        }
        this.wrapper.appendChild(this.pulseRing);

        this.cursorStyle = {
            boxSizing: "border-box",
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: `${this.cursorSize / -2}px`,
            marginLeft: `${this.cursorSize / -2}px`,
            width: `${this.cursorSize}px`,
            height: `${this.cursorSize}px`,
            borderRadius: "50%",
            transition: "opacity 0.5s",
            userSelect: "none",
            pointerEvents: "none"
        };

        if (this.supportsBackdrop) {
            this.cursorStyle.backdropFilter = "invert(1) hue-rotate(135deg) brightness(1.2)";
            this.cursorStyle.backgroundColor = "#fff0";
        } else {
            this.cursorStyle.backgroundColor = "#000";
        }

        this.updatePulseRingSize();
        this.init(this.cursor, this.cursorStyle);
        this.bindEvents();
    }

    init(el, style) {
        Object.assign(el.style, style);
        setTimeout(() => {
            this.wrapper.removeAttribute("hidden");
            this.wrapper.style.opacity = 1;
        }, 500);
    }

    bindEvents() {
        document.addEventListener("mousemove", (event) => this.move(event));
        document.addEventListener("mouseenter", () => {
            this.hasPointer = true;
            this.startLoop();
        });
        document.addEventListener("mouseleave", () => {
            this.hasPointer = false;
            this.setPulseActive(false);
        });
        document.addEventListener("mousedown", (event) => this.onMouseDown(event));
        document.addEventListener("mouseup", (event) => this.onMouseUp(event));
        document.addEventListener("contextmenu", (event) => event.preventDefault());
        document.addEventListener("selectstart", (event) => {
            if (this.isRightPressed) event.preventDefault();
        });
    }

    onMouseDown(event) {
        if (event.button === 0) {
            this.pressLeft();
        } else if (event.button === 2) {
            event.preventDefault();
            this.pressRight();
        }
    }

    onMouseUp(event) {
        if (event.button === 0) {
            this.releaseLeft();
        } else if (event.button === 2) {
            this.releaseRight();
        }
    }

    move(event) {
        this.hasPointer = true;
        this.pointerX = event.clientX;
        this.pointerY = event.clientY;

        const isHovering = event.target.closest("a") ||
            event.target.closest("button") ||
            event.target.classList.contains("curzr-hover");

        this.isHovering = isHovering;
        this.setPulseActive(isHovering && !this.isLeftPressed && !this.isRightPressed);

        if (!this.isLeftPressed && !this.isRightPressed) {
            this.setTargetScale(isHovering ? this.hoverScale : 1);
        }

        this.startLoop();
    }

    updatePulseRingSize() {
        const size = this.cursorSize * this.hoverScale * this.ringOvershoot;
        this.pulseRing.style.width = `${size}px`;
        this.pulseRing.style.height = `${size}px`;
    }

    setPulseActive(active) {
        this.pulseRing.classList.toggle("is-active", active);
    }

    setTargetScale(scale) {
        this.targetScale = scale;
        this.startLoop();
    }

    applyCursorVisuals() {
        this.cursor.style.filter = `invert(${this.invertHold})`;
    }

    applyTransform() {
        this.wrapper.style.transform = `translate3d(${this.renderX}px, ${this.renderY}px, 0)`;
        this.cursor.style.transform = `scale(${this.currentScale})`;
        this.applyCursorVisuals();
    }

    startLoop() {
        if (this.isLoopRunning) return;
        this.isLoopRunning = true;

        const tick = () => {
            const dx = this.pointerX - this.renderX;
            const dy = this.pointerY - this.renderY;
            const scaleDiff = this.targetScale - this.currentScale;
            const invertDiff = this.invertHoldTarget - this.invertHold;

            this.renderX += dx * this.positionEase;
            this.renderY += dy * this.positionEase;
            this.currentScale += scaleDiff * this.scaleEase;
            this.invertHold += invertDiff * this.invertEase;

            if (Math.abs(dx) < 0.4) this.renderX = this.pointerX;
            if (Math.abs(dy) < 0.4) this.renderY = this.pointerY;
            if (Math.abs(scaleDiff) < 0.01) this.currentScale = this.targetScale;
            if (Math.abs(invertDiff) < 0.01) this.invertHold = this.invertHoldTarget;

            this.applyTransform();

            const positionDone =
                Math.abs(this.pointerX - this.renderX) < 0.5 &&
                Math.abs(this.pointerY - this.renderY) < 0.5;
            const scaleDone = Math.abs(this.targetScale - this.currentScale) < 0.01;
            const invertDone = Math.abs(this.invertHoldTarget - this.invertHold) < 0.01;

            if (this.hasPointer || !positionDone || !scaleDone || !invertDone) {
                requestAnimationFrame(tick);
                return;
            }

            this.isLoopRunning = false;
        };

        requestAnimationFrame(tick);
    }

    pressLeft() {
        this.isLeftPressed = true;
        this.setPulseActive(false);
        this.cursor.style.transition = "opacity 0.2s";
        this.setTargetScale(0.4);
        this.cursor.style.opacity = "0.7";
    }

    releaseLeft() {
        this.isLeftPressed = false;
        this.cursor.style.transition = "opacity 0.5s";
        this.cursor.style.opacity = "1";

        if (!this.isRightPressed) {
            this.setTargetScale(this.isHovering ? this.hoverScale : 1);
            this.setPulseActive(this.isHovering);
        }
    }

    pressRight() {
        this.isRightPressed = true;
        this.invertHoldTarget = 1;
        this.setPulseActive(false);
        this.startLoop();
    }

    releaseRight() {
        this.isRightPressed = false;
        this.invertHoldTarget = 0;
        this.setPulseActive(this.isHovering && !this.isLeftPressed);
        this.startLoop();
    }
}

new GlitchEffect();
