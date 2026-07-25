(function () {
  const canvas = document.getElementById("archiveOverlayGrid");
  const overlay = document.getElementById("archiveOverlayPage");
  if (!canvas || !overlay) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const POINTER_RADIUS = 170;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let columns = 0;
  let rows = 0;
  let spacing = 48;
  let points = [];
  let pointerTargetX = window.innerWidth * 0.5;
  let pointerTargetY = window.innerHeight * 0.5;
  let pointerX = pointerTargetX;
  let pointerY = pointerTargetY;
  let influenceTarget = 0;
  let influence = 0;
  let animationFrame = 0;

  function isOverlayOpen() {
    return document.body.classList.contains("is-archive-overlay-open");
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    spacing = Math.max(42, Math.min(56, Math.round(width / 27)));
    columns = Math.ceil(width / spacing) + 3;
    rows = Math.ceil(height / spacing) + 3;

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    points = [];
    for (let row = 0; row < rows; row += 1) {
      const line = [];
      for (let column = 0; column < columns; column += 1) {
        line.push({
          x: (column - 1) * spacing,
          y: (row - 1) * spacing,
          drawX: 0,
          drawY: 0,
          light: 0,
        });
      }
      points.push(line);
    }

    draw();
  }

  function updatePoints() {
    points.forEach((line) => {
      line.forEach((point) => {
        const dx = pointerX - point.x;
        const dy = pointerY - point.y;
        const distance = Math.hypot(dx, dy);
        const proximity = Math.max(0, 1 - distance / POINTER_RADIUS);
        const eased = proximity * proximity * (3 - 2 * proximity);

        point.drawX = point.x;
        point.drawY = point.y;
        point.light = eased * influence;
      });
    });
  }

  function traceSmoothLine(line) {
    if (!line.length) return;
    ctx.beginPath();
    ctx.moveTo(line[0].drawX, line[0].drawY);

    for (let index = 1; index < line.length - 1; index += 1) {
      const point = line[index];
      const next = line[index + 1];
      const midX = (point.drawX + next.drawX) * 0.5;
      const midY = (point.drawY + next.drawY) * 0.5;
      ctx.quadraticCurveTo(point.drawX, point.drawY, midX, midY);
    }

    const last = line[line.length - 1];
    ctx.lineTo(last.drawX, last.drawY);
    ctx.stroke();
  }

  function drawGridLines() {
    ctx.lineWidth = 0.65;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.105)";

    points.forEach((line) => traceSmoothLine(line));

    for (let column = 0; column < columns; column += 1) {
      traceSmoothLine(points.map((row) => row[column]));
    }
  }

  function drawGridPoints() {
    points.forEach((line) => {
      line.forEach((point) => {
        const light = point.light;
        const size = 1.4 + light * 3.3;
        const alpha = 0.24 + light * 0.76;

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        ctx.shadowColor = light > 0.08
          ? `rgba(255, 255, 255, ${(light * 0.72).toFixed(3)})`
          : "transparent";
        ctx.shadowBlur = light * 10;
        ctx.fillRect(
          point.drawX - size * 0.5,
          point.drawY - size * 0.5,
          size,
          size,
        );
      });
    });
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    updatePoints();
    drawGridLines();
    drawGridPoints();
  }

  function animate() {
    animationFrame = 0;
    influenceTarget = isOverlayOpen() ? 1 : 0;
    pointerX += (pointerTargetX - pointerX) * 0.12;
    pointerY += (pointerTargetY - pointerY) * 0.12;
    influence += (influenceTarget - influence) * 0.1;
    draw();

    const pointerMoving =
      Math.abs(pointerTargetX - pointerX) > 0.05 ||
      Math.abs(pointerTargetY - pointerY) > 0.05;
    const influenceMoving = Math.abs(influenceTarget - influence) > 0.003;
    if (isOverlayOpen() || pointerMoving || influenceMoving) startAnimation();
  }

  function startAnimation() {
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  }

  function onPointerMove(event) {
    pointerTargetX = event.clientX;
    pointerTargetY = event.clientY;
    startAnimation();
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  const bodyObserver = new MutationObserver(startAnimation);
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  resize();
  startAnimation();
})();
