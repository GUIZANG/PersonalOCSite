/*const downPhrases = [
    "There is nothing. Only warm, primordial blackness.",
    "Your conscience ferments in it.",
    "You don't have to do anything anymore.",
    "Ever.",
    "Never ever.",
    "Never ever ever.",
    "An inordinate amount of time passes.",
    "It is utterly void of struggle.",
    "No vestige of tenderness is contained within it.",
    "Your conscience clings to...the so-called *SENSATION*.",
    "The four-limbed, headed machine of pain,",
    "the undignified suffering, is firing up again.",
    "It is hurting.",
    "Longing.",
    "Wanting to walk upon the flowing water.",
    "You call for help, for *YOU* are trapped inside...",
    "something attached to your sore neck.",
    "However, no one answers.",
    "Yes. Yes. You are poured into the desperate...",
    "*REALITY*",
    "Cruelly.",
    "Achingly."
];*/
const downPhrases = [
    "*REALITY*",
    "Cruelly.",
    "Achingly."
];

const upPhrases = [
    "It seems that you have plunged yourself back into the fathomless deep.",
    "Just simply keep on non-existing...",
    "Forget the sensation of a ball of meat surrounding you...",
    "Never...",
    "Wake up?",
    "No. No. It is not something you can take.",
    "But you have to.",
    "So...",
];

const textBox = document.getElementById('text-box');
const btn = document.getElementById('wake-up-btn');
const body = document.body;

let isAnimating = false;
let downIndex = -1;
let upIndex = -1;
let virtualProgress = 0;
let wheelDelta = 0;
let wheelDirection = 0;
let wheelResetTimer = null;
let phraseChangeCount = 0;
let isFinished = false;

const wheelThreshold = 260;
const dazedChangeThreshold = 5;
const progressAnimationDuration = 900;

function getNextProgress(direction, nextIndex) {
    const phrases = direction === 'up' ? upPhrases : downPhrases;
    const remainingStateCount = phrases.length - nextIndex + 1;

    if (remainingStateCount <= 0) return virtualProgress;

    if (direction === 'up') {
        return Math.max(0, virtualProgress - (virtualProgress / remainingStateCount));
    }

    return Math.min(1, virtualProgress + ((1 - virtualProgress) / remainingStateCount));
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animateToProgress(progress) {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const html = document.documentElement;
    const previousScrollBehavior = html.style.scrollBehavior;
    const startY = window.scrollY;
    const targetY = progress * scrollable;

    html.style.scrollBehavior = 'auto';

    return new Promise(resolve => {
        const startTime = performance.now();

        function frame(now) {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / progressAnimationDuration);
            const eased = easeOutCubic(t);
            const nextY = startY + (targetY - startY) * eased;

            window.scrollTo({ top: nextY, behavior: 'auto' });

            if (t < 1) {
                requestAnimationFrame(frame);
                return;
            }

            window.scrollTo({ top: targetY, behavior: 'auto' });
            html.style.scrollBehavior = previousScrollBehavior;
            resolve();
        }

        requestAnimationFrame(frame);
    });
}

function updateMentalState() {
    if (phraseChangeCount > dazedChangeThreshold && window.setHomepageLabel) {
        window.setHomepageLabel('Dazed');
    }
}

function normalizeWheelDelta(event) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
    }

    return event.deltaY;
}

function hideWakeUpButton() {
    btn.classList.remove('show');
}

function showWakeUpButton() {
    textBox.classList.add('fade-out');
    btn.classList.add('show');
}

async function finishOnWakeUp(direction) {
    isAnimating = true;
    isFinished = true;
    body.classList.add('locked');

    virtualProgress = direction === 'up' ? 0 : 1;
    await animateToProgress(virtualProgress);
    await fadeCurrentText();
    showWakeUpButton();
}

async function fadeCurrentText() {
    if (textBox.innerHTML === "") return;

    const letters = textBox.querySelectorAll("span");

    letters.forEach((span, i) => {
        span.style.animationDelay = (i * 0.03) + "s";
    });

    textBox.classList.add('fade-out');

    // 等待模糊动画完成
    await new Promise(r => setTimeout(r, 800));

    // 模糊结束后的停顿
    await new Promise(r => setTimeout(r, 1200));
}

async function typePhrase(text) {
    textBox.classList.remove('fade-out');
    textBox.innerHTML = "";

    for (let char of text) {
        const span = document.createElement("span");
        span.textContent = char;
        textBox.appendChild(span);

        const delay = (char === '.' || char === ',') ? 200 : 40;
        await new Promise(r => setTimeout(r, delay));
    }
}

async function playPhrase(direction) {
    if (isAnimating) return;

    const phrases = direction === 'up' ? upPhrases : downPhrases;
    const nextIndex = direction === 'up' ? upIndex + 1 : downIndex + 1;
    if (nextIndex >= phrases.length) {
        await finishOnWakeUp(direction);
        return;
    }

    isAnimating = true;
    hideWakeUpButton();

    body.classList.add('locked');
    virtualProgress = getNextProgress(direction, nextIndex);
    await animateToProgress(virtualProgress);

    await fadeCurrentText();

    if (direction === 'up') {
        upIndex = nextIndex;
    } else {
        downIndex = nextIndex;
    }
    phraseChangeCount++;
    updateMentalState();

    await typePhrase(phrases[nextIndex]);

    isAnimating = false;
    body.classList.remove('locked');
}

function queueWheel(delta) {
    if (isAnimating || isFinished) return;

    const direction = delta > 0 ? 1 : -1;

    if (direction !== wheelDirection) {
        wheelDelta = 0;
        wheelDirection = direction;
    }

    wheelDelta += Math.abs(delta);

    if (wheelResetTimer) clearTimeout(wheelResetTimer);
    wheelResetTimer = setTimeout(() => {
        wheelDelta = 0;
        wheelDirection = 0;
    }, 180);

    if (wheelDelta < wheelThreshold) return;

    wheelDelta = 0;
    wheelDirection = 0;
    playPhrase(direction > 0 ? 'down' : 'up');
}

window.addEventListener('wheel', (event) => {
    event.preventDefault();
    queueWheel(normalizeWheelDelta(event));
}, { passive: false });

window.addEventListener('touchmove', (event) => {
    event.preventDefault();
}, { passive: false });

window.addEventListener('keydown', (event) => {
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];

    if (scrollKeys.includes(event.key)) {
        event.preventDefault();
    }
}, { passive: false });

// 初始化
window.onload = () => {
    window.scrollTo(0, 0);
    virtualProgress = 0;
    playPhrase('down');
};