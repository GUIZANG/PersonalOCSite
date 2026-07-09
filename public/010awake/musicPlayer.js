(function () {
    const audio = document.getElementById("bgm");
    const btn = document.getElementById("musicBtn");
    let userPaused = false;

    function setPlayingState(playing) {
        btn.classList.toggle("is-playing", playing);
    }

    function syncUI() {
        setPlayingState(!audio.paused);
    }

    async function playAudio() {
        if (userPaused) return;

        try {
            await audio.play();
        } catch {
            // Browser autoplay policy may block until user interaction.
        } finally {
            syncUI();
        }
    }

    function toggle() {
        if (audio.paused) {
            userPaused = false;
            playAudio();
            setPlayingState(true);
        } else {
            userPaused = true;
            audio.pause();
            setPlayingState(false);
        }
    }

    function unlockAudio() {
        if (!userPaused) playAudio();
    }

    btn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggle();
    });

    audio.addEventListener("play", () => syncUI());
    audio.addEventListener("pause", () => syncUI());
    audio.addEventListener("canplay", unlockAudio);

    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((eventName) => {
        document.addEventListener(eventName, unlockAudio, { once: true, passive: true });
    });

    window.addEventListener("load", unlockAudio);
    syncUI();
    playAudio();
})();
