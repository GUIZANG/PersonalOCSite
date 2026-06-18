(function () {
  document.addEventListener("DOMContentLoaded", initCursor);

  function initCursor() {
    const bigBall = document.querySelector(".cursor__ball--big");
    const smallBall = document.querySelector(".cursor__ball--small");
    const hoverables = document.querySelectorAll(".hoverable");
    let bigScale = 1;
    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;

    if (!bigBall || !smallBall) return;

    document.body.addEventListener("mousemove", onMouseMove);
    for (let i = 0; i < hoverables.length; i++) {
      hoverables[i].addEventListener("mouseenter", onMouseHover);
      hoverables[i].addEventListener("mouseleave", onMouseHoverOut);
    }

    function onMouseMove(event) {
      lastX = event.pageX;
      lastY = event.pageY;
      moveCursor();
    }

    function onMouseHover() {
      bigScale = 4;
      moveCursor();
    }

    function onMouseHoverOut() {
      bigScale = 1;
      moveCursor();
    }

    function moveCursor() {
      bigBall.style.transform = `translate3d(${lastX - 15}px, ${lastY - 15}px, 0) scale(${bigScale})`;
      smallBall.style.transform = `translate3d(${lastX - 5}px, ${lastY - 7}px, 0)`;
    }
  }
})();
