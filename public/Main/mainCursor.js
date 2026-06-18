(function () {
  document.addEventListener("DOMContentLoaded", initCursor);

  function initCursor() {
    const bigBall = document.querySelector(".cursor__ball--big");
    const smallBall = document.querySelector(".cursor__ball--small");
    let bigScale = 1;
    let isHovering = false;
    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;

    if (!bigBall || !smallBall) return;

    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("pointerover", onPointerOver);
    document.body.addEventListener("pointerout", onPointerOut);

    function onMouseMove(event) {
      lastX = event.pageX;
      lastY = event.pageY;
      setHoverState(isHoverTarget(event));
      moveCursor();
    }

    function onPointerOver(event) {
      const hoverable = event.target.closest(".hoverable");
      if (!hoverable || hoverable.contains(event.relatedTarget)) return;
      setHoverState(true);
      moveCursor();
    }

    function onPointerOut(event) {
      const hoverable = event.target.closest(".hoverable");
      if (!hoverable || hoverable.contains(event.relatedTarget)) return;
      setHoverState(document.querySelector(".is-hypercube-hovered"));
      moveCursor();
    }

    function isHoverTarget(event) {
      return event.target.closest(".hoverable") || document.querySelector(".is-hypercube-hovered");
    }

    function setHoverState(shouldHover) {
      const nextHovering = Boolean(shouldHover);
      if (isHovering === nextHovering) return;

      isHovering = nextHovering;
      bigScale = isHovering ? 4 : 1;
    }

    function moveCursor() {
      bigBall.style.transform = `translate3d(${lastX - 15}px, ${lastY - 15}px, 0) scale(${bigScale})`;
      smallBall.style.transform = `translate3d(${lastX - 5}px, ${lastY - 7}px, 0)`;
    }
  }
})();
