(function () {
    const audio = document.getElementById("bgm");
    const btn = document.getElementById("musicBtn");
    let userPaused = false;

    function setPlayingState(playing, animate) {
        btn.classList.toggle("is-playing", playing);

        if (!animate) return;

        btn.classList.remove("morph-to-play", "morph-to-pause");
        void btn.offsetWidth;
        btn.classList.add(playing ? "morph-to-play" : "morph-to-pause");
    }

    function syncUI(animate = false) {
        setPlayingState(!audio.paused, animate);
    }

    async function playAudio() {
        if (userPaused) return;

        try {
            await audio.play();
        } catch {
            // Browser autoplay policy may block until user interaction.
        } finally {
            syncUI(false);
        }
    }

    function toggle() {
        if (audio.paused) {
            userPaused = false;
            playAudio();
            setPlayingState(true, true);
        } else {
            userPaused = true;
            audio.pause();
            setPlayingState(false, true);
        }
    }

    function unlockAudio() {
        if (!userPaused) playAudio();
    }

    btn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggle();
    });

    btn.addEventListener("animationend", (event) => {
        if (event.target.classList.contains("symbol-triangle")) {
            btn.classList.remove("morph-to-play", "morph-to-pause");
        }
    });

    audio.addEventListener("play", () => syncUI(false));
    audio.addEventListener("pause", () => syncUI(false));
    audio.addEventListener("canplay", unlockAudio);

    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((eventName) => {
        document.addEventListener(eventName, unlockAudio, { once: true, passive: true });
    });

    window.addEventListener("load", unlockAudio);
    syncUI(false);
    playAudio();
})();
