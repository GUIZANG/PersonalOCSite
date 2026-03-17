const h1 = document.querySelector("[data-splittext]");
const text = h1.textContent;
const letters = text.split("");

h1.innerHTML = letters
  .map((char, i) => {
    return `<span style="--i: ${i / letters.length}">${char}</span>`;
  })
  .join("");