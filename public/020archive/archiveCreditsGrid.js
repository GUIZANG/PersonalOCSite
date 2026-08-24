(function () {
  const canvas = document.getElementById("archiveOverlayGrid");
  const overlay = document.getElementById("archiveOverlayPage");
  const backdropTitle = overlay?.querySelector(".archive-overlay-page__backdrop-title");
  const backdropMark = backdropTitle?.querySelector(".archive-overlay-page__backdrop-mark");
  if (!canvas || !overlay) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const POINTER_RADIUS = 170;
  const SCANLINE_PITCH = 11;
  const GLYPH_GAP = SCANLINE_PITCH * 2;
  const WIDE_GRID_BREAKPOINT = 1366;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
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

  const backdropGlyphs = backdropMark
    ? Array.from(backdropMark.querySelectorAll("path")).map((path) => {
        const group = document.createElementNS(SVG_NAMESPACE, "g");
        path.before(group);
        group.appendChild(path);
        return {
          group,
          path,
          bounds: group.getBBox(),
          gridGlyph: path.dataset.gridGlyph || "",
          gridAspect: Number.parseFloat(path.dataset.gridAspect) || 0,
        };
      })
    : [];

  function rectanglePath(x, y, width, height) {
    return `M${x} ${y}H${x + width}V${y + height}H${x}Z`;
  }

  function drawGridGlyph(path, glyph, width, height) {
    const horizontalStroke = spacing;
    const verticalStroke = width * (glyph === "e" ? 10.57 / 18.24 : 10.6 / 20.24);

    if (glyph === "e") {
      const middleY = Math.round(
        ((height - horizontalStroke) * 0.5) / SCANLINE_PITCH
      ) * SCANLINE_PITCH;
      path.setAttribute(
        "d",
        [
          rectanglePath(0, 0, width, horizontalStroke),
          rectanglePath(0, middleY, width, horizontalStroke),
          rectanglePath(0, height - horizontalStroke, width, horizontalStroke),
          rectanglePath(0, 0, verticalStroke, height),
        ].join("")
      );
      return;
    }

    path.setAttribute(
      "d",
      [
        rectanglePath(0, 0, width, horizontalStroke),
        rectanglePath(
          (width - verticalStroke) * 0.5,
          horizontalStroke,
          verticalStroke,
          height - horizontalStroke
        ),
      ].join("")
    );
  }

  function resolveBackdropGuide() {
    let targetWidth = Math.min(width * 0.76, 1080);
    let centerX = width * 0.48;
    let centerY = height * 0.5;

    if (width <= 540) {
      targetWidth = width * 0.92;
      centerX = width * 0.5;
      centerY = height * 0.18;
    } else if (width <= 860) {
      targetWidth = Math.min(width * 0.91, 700);
      centerX = width * 0.5;
      centerY = height * 0.22;
    } else if (height <= 560 && width >= 700) {
      targetWidth = Math.min(width * 0.72, 780);
    }

    return {
      centerX,
      centerY,
      maxWidth: Math.max(spacing, Math.floor(targetWidth / spacing) * spacing),
    };
  }

  function measureGlyphLayout(frameHeight) {
    const metrics = backdropGlyphs.map(({ bounds, gridAspect }) => {
      const scaleY = frameHeight / bounds.height;
      const naturalWidth = gridAspect
        ? frameHeight * gridAspect
        : bounds.width * scaleY;
      return {
        scaleY,
        naturalWidth,
        width: Math.max(
          SCANLINE_PITCH,
          Math.round(naturalWidth / SCANLINE_PITCH) * SCANLINE_PITCH
        ),
      };
    });
    const contentWidth =
      metrics.reduce((total, glyph) => total + glyph.width, 0) +
      GLYPH_GAP * (metrics.length - 1);
    const frameWidth = Math.ceil(contentWidth / spacing) * spacing;
    let remainingUnits = Math.round((frameWidth - contentWidth) / SCANLINE_PITCH);

    while (remainingUnits > 0) {
      let candidate = 0;
      for (let index = 1; index < metrics.length; index += 1) {
        if (
          metrics[index].naturalWidth - metrics[index].width >
          metrics[candidate].naturalWidth - metrics[candidate].width
        ) {
          candidate = index;
        }
      }
      metrics[candidate].width += SCANLINE_PITCH;
      remainingUnits -= 1;
    }

    return { metrics, frameWidth, frameHeight };
  }

  function layoutBackdropTitle() {
    if (!backdropTitle || !backdropMark || !backdropGlyphs.length) return;

    const guide = resolveBackdropGuide();
    let rowCount = Math.max(1, Math.round(guide.maxWidth / spacing / 2.31));
    rowCount = Math.min(rowCount, Math.max(1, Math.floor(height / spacing)));
    let layout = measureGlyphLayout(rowCount * spacing);

    while (layout.frameWidth > guide.maxWidth && rowCount > 1) {
      rowCount -= 1;
      layout = measureGlyphLayout(rowCount * spacing);
    }

    const maxColumnStart = Math.max(0, Math.floor((width - layout.frameWidth) / spacing));
    const columnStart = Math.max(
      0,
      Math.min(
        maxColumnStart,
        Math.round((guide.centerX - layout.frameWidth * 0.5) / spacing)
      )
    );
    const maxRowStart = Math.max(0, Math.floor((height - layout.frameHeight) / spacing));
    const rowStart = Math.max(
      0,
      Math.min(
        maxRowStart,
        Math.round((guide.centerY - layout.frameHeight * 0.5) / spacing)
      )
    );
    const frame = {
      x: columnStart * spacing,
      y: rowStart * spacing,
      width: layout.frameWidth,
      height: layout.frameHeight,
    };
    let cursorX = 0;

    backdropGlyphs.forEach(({ group, path, bounds, gridGlyph }, index) => {
      const metric = layout.metrics[index];
      if (gridGlyph) {
        drawGridGlyph(path, gridGlyph, metric.width, layout.frameHeight);
        group.setAttribute("transform", `translate(${cursorX} 0)`);
        cursorX += metric.width + GLYPH_GAP;
        return;
      }

      const scaleX = metric.width / bounds.width;
      const translateX = cursorX - bounds.x * scaleX;
      const translateY = -bounds.y * metric.scaleY;
      group.setAttribute(
        "transform",
        `matrix(${scaleX} 0 0 ${metric.scaleY} ${translateX} ${translateY})`
      );
      cursorX += metric.width + GLYPH_GAP;
    });

    backdropMark.setAttribute("viewBox", `0 0 ${frame.width} ${frame.height}`);
    backdropMark.setAttribute("preserveAspectRatio", "none");
    backdropTitle.style.left = `${frame.x}px`;
    backdropTitle.style.top = `${frame.y}px`;
    backdropTitle.style.width = `${frame.width}px`;
    backdropTitle.style.height = `${frame.height}px`;
    backdropTitle.classList.add("is-grid-fitted");
  }

  function isOverlayOpen() {
    return document.body.classList.contains("is-archive-overlay-open");
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    spacing = SCANLINE_PITCH * (width < WIDE_GRID_BREAKPOINT ? 4 : 5);
    columns = Math.ceil(width / spacing) + 3;
    rows = Math.ceil(height / spacing) + 3;

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    layoutBackdropTitle();

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
