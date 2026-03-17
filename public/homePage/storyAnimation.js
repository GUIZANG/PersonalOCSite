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
    "There is nothing. Only warm, primordial blackness.",
    "Your conscience ferments in it.",
];

const textBox = document.getElementById('text-box');
const btn = document.getElementById('wake-up-btn');
const body = document.body;

let currentIndex = -1;
let isAnimating = false;


// 获取每一格的像素步长
const getStepPx = () => (document.documentElement.scrollHeight - window.innerHeight) / (downPhrases.length + 1);
async function playNext() {
    if (isAnimating) return;
    isAnimating = true;

    const nextIndex = currentIndex + 1;
    const targetScrollY = (nextIndex + 1) * getStepPx();
    
    body.classList.add('locked');
    window.scrollTo(0, targetScrollY);

    // 渐隐旧文本（逐字模糊）
    if (textBox.innerHTML !== "" || currentIndex === -1) {

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

    currentIndex = nextIndex;

    // 播放新文本
    if (currentIndex < downPhrases.length) {

        textBox.classList.remove('fade-out');
        textBox.innerHTML = "";

        const text = downPhrases[currentIndex];

        for (let char of text) {

            const span = document.createElement("span");
            span.textContent = char;
            textBox.appendChild(span);

            const delay = (char === '.' || char === ',') ? 200 : 40;
            await new Promise(r => setTimeout(r, delay));
        }
        

        isAnimating = false;
        body.classList.remove('locked');

    } else {

        textBox.classList.add('fade-out');
        btn.classList.add('show');
        isAnimating = false;
        body.classList.remove('locked');

    }
}

// 监听滚动
window.addEventListener('scroll', () => {
    if (isAnimating) return;

    const stepPx = getStepPx();
    const currentScroll = window.scrollY;

    if (currentScroll > (currentIndex + 1) * stepPx) {
        playNext();
    }
});

// 初始化
window.onload = () => {
    window.scrollTo(0, 0);
    playNext();
};