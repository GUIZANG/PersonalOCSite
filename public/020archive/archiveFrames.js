(function () {
  // Ambient background (true bottom layer, below the transparent WebGL canvas):
  // a fixed pure-black frame that overscans the viewport for a seamless edge,
  // with concentric SOLID rectangles inside it ramping black -> white -> black
  // (pure-black centre). A grain layer sits on top; GSAP drives a cursor
  // parallax where inner rectangles drift more than outer ones so the stack
  // leans toward the pointer. On long-press the colours cycle inward (tunnel
  // flow). The layer ignores pointer events.

  // A single fixed pure-black frame overscans the viewport so the very edge is
  // always solid black with no seam. Inside it sit the coloured rectangles,
  // none of which overscan, ramping black -> white -> black with a pure-black
  // centre. Adjacent rectangles always differ in colour.
  const INNER_COUNT = 32; // denser stack for a deeper tunnel without wide empty bands
  const BACKDROP_SCALE = 1.2; // fixed pure-black outer frame; overscans => seam-proof edge
  const INNER_OUTER = 0.965; // scale of the outermost coloured rectangle
  const INNER_CENTER = 0.075; // small final black rectangle deepens the vanishing point
  const MID_FRAC = 0.42; // position of the bright band among the inner rectangles
  const OUTER_GRAY = 0.06; // keep the outer field close to black
  const WHITE_LUM = 216 / 255; // peak brightness = #D8D8D8, softer than the surrounding white transition
  const MIN_ADJACENT_GRAY_STEP = 6; // perceptible separation between neighbouring bands
  const BRIGHT_RAMP_POWER = 1.8; // compress mid-grays so black occupies more of the tunnel

  // Moving vanishing point: the nested rectangles converge toward the pointer so
  // the stack reads as a tunnel whose centre slides under the cursor. The
  // innermost rectangle's centre can travel up to REACH * half-viewport toward
  // the pointer; the outermost stays put (so it never reveals the black frame).
  // Larger REACH => the inner rectangles bunch harder on the pointer side (edges
  // there narrow into a row of lines) and spread on the far side.
  const REACH = 0.25;
  // Linear depth => a true perspective interpolation (outer centre = screen
  // centre, inner centre = vanishing point), which is what makes the side edges
  // fan open on one side and pinch shut on the other.
  const DEPTH_GAMMA = 1.0;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function grayValueFromLum(lum) {
    return Math.round(clamp01(lum) * 255);
  }

  function grayFromValue(value) {
    const v = Math.min(255, Math.max(0, Math.round(value)));
    return `rgb(${v}, ${v}, ${v})`;
  }

  function buildGrayValues(brightIndex) {
    const values = Array.from({ length: INNER_COUNT }, (_, index) => {
      const lum = index <= brightIndex
        ? OUTER_GRAY + (WHITE_LUM - OUTER_GRAY) *
          Math.pow(index / brightIndex, BRIGHT_RAMP_POWER)
        : WHITE_LUM *
          Math.pow(
            1 - (index - brightIndex) / (INNER_COUNT - 1 - brightIndex),
            BRIGHT_RAMP_POWER
          );
      return grayValueFromLum(lum);
    });

    values[brightIndex] = grayValueFromLum(WHITE_LUM);
    values[INNER_COUNT - 1] = 0;

    // Work outward from the anchored white peak. This preserves the steeper
    // dark-heavy curve while guaranteeing a difference visible through grain.
    for (let index = brightIndex - 1; index >= 0; index -= 1) {
      values[index] = Math.min(
        values[index],
        values[index + 1] - MIN_ADJACENT_GRAY_STEP
      );
    }
    for (let index = brightIndex + 1; index < INNER_COUNT; index += 1) {
      values[index] = Math.min(
        values[index],
        values[index - 1] - MIN_ADJACENT_GRAY_STEP
      );
    }
    values[INNER_COUNT - 1] = 0;
    for (let index = INNER_COUNT - 2; index > brightIndex; index -= 1) {
      values[index] = Math.max(
        values[index],
        values[index + 1] + MIN_ADJACENT_GRAY_STEP
      );
    }

    return values.map((value) => Math.min(255, Math.max(0, value)));
  }

  function buildNoiseDataUri() {
    // Desaturated fractal noise with a steep contrast curve so the grain reads
    // as punchy black/white speckle rather than soft mush.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150">' +
      '<filter id="n">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>' +
      '<feColorMatrix type="saturate" values="0"/>' +
      '<feComponentTransfer>' +
      '<feFuncR type="linear" slope="2.2" intercept="-0.6"/>' +
      '<feFuncG type="linear" slope="2.2" intercept="-0.6"/>' +
      '<feFuncB type="linear" slope="2.2" intercept="-0.6"/>' +
      '</feComponentTransfer>' +
      '</filter>' +
      '<rect width="100%" height="100%" filter="url(#n)"/></svg>';
    return "data:image/svg+xml;base64," + btoa(svg);
  }

  function init() {
    const root = document.getElementById("strataFrames");
    const stage = document.getElementById("hypercube-stage");
    if (!root || !stage) return;
    let rootRect = null;

    function refreshRootRect() {
      const rect = root.getBoundingClientRect();
      rootRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    refreshRootRect();
    window.addEventListener("resize", refreshRootRect, { passive: true });

    // Fixed pure-black outer frame: overscans the inset background aperture and
    // never moves, so the area outside the four fixed corner marks stays black.
    const backdrop = document.createElement("div");
    backdrop.className = "strata-frames__band";
    backdrop.style.width = `${(BACKDROP_SCALE * 100).toFixed(3)}%`;
    backdrop.style.height = `${(BACKDROP_SCALE * 100).toFixed(3)}%`;
    backdrop.style.background = "rgb(0, 0, 0)";
    backdrop.style.zIndex = "1";
    root.appendChild(backdrop);

    const bands = [];
    const innerDelta = (INNER_CENTER - INNER_OUTER) / (INNER_COUNT - 1);
    const brightJ = Math.round(MID_FRAC * (INNER_COUNT - 1));
    const grayValues = buildGrayValues(brightJ);

    for (let j = 0; j < INNER_COUNT; j++) {
      const scale = INNER_OUTER + innerDelta * j;
      const baseColor = grayFromValue(grayValues[j]);

      const band = document.createElement("div");
      band.className = "strata-frames__band";
      band.style.width = `${(scale * 100).toFixed(3)}%`;
      band.style.height = `${(scale * 100).toFixed(3)}%`;
      band.style.background = baseColor;
      band.style.zIndex = String(j + 2); // above the black frame, inner on top
      root.appendChild(band);

      const depth = Math.pow(j / (INNER_COUNT - 1), DEPTH_GAMMA); // centre moves most
      bands.push({ el: band, depth, base: baseColor });
    }

    const baseColors = bands.map((b) => b.base);

    const noise = document.createElement("div");
    noise.className = "strata-frames__noise";
    noise.style.backgroundImage = `url("${buildNoiseDataUri()}")`;
    root.appendChild(noise);

    const hasGsap = typeof window.gsap !== "undefined";
    const setters = hasGsap
      ? bands.map((b) => ({
          x: window.gsap.quickTo(b.el, "x", { duration: 0.7, ease: "power3.out" }),
          y: window.gsap.quickTo(b.el, "y", { duration: 0.7, ease: "power3.out" }),
        }))
      : null;

    // Fallback tween state when GSAP is unavailable.
    const raw = bands.map(() => ({ cx: 0, cy: 0, tx: 0, ty: 0 }));
    let rafId = null;

    function applyTargets(nx, ny) {
      // Per-axis reach so the horizontal pull follows the pointer across wide
      // screens (nx is [-0.5, 0.5], so nx * innerWidth * REACH puts a pointer at
      // the edge REACH*half-width toward that side). depth scales it from 0 at
      // the outermost rectangle to 1 at the innermost => vanishing point.
      const reachX = rootRect.width * REACH;
      const reachY = rootRect.height * REACH;
      bands.forEach((b, i) => {
        const tx = nx * reachX * b.depth;
        const ty = ny * reachY * b.depth;
        if (setters) {
          setters[i].x(tx);
          setters[i].y(ty);
        } else {
          raw[i].tx = tx;
          raw[i].ty = ty;
        }
      });
      if (!setters && rafId === null) rafId = requestAnimationFrame(tickFallback);
    }

    function tickFallback() {
      let moving = false;
      bands.forEach((b, i) => {
        const s = raw[i];
        s.cx += (s.tx - s.cx) * 0.12;
        s.cy += (s.ty - s.cy) * 0.12;
        if (Math.abs(s.tx - s.cx) > 0.05 || Math.abs(s.ty - s.cy) > 0.05) moving = true;
        b.el.style.transform = `translate(${s.cx.toFixed(2)}px, ${s.cy.toFixed(2)}px)`;
      });
      rafId = moving ? requestAnimationFrame(tickFallback) : null;
    }

    // ---- long-press colour cycle: each band hands its colour to the next, the
    // last wraps to the first, so the whole palette flows inward like a tunnel.
    // All inner bands cycle (with a single black at the centre) so no two
    // adjacent frames are ever the same colour. During the cycle the backdrop
    // takes the preceding palette colour rather than copying the outer band,
    // preserving a visible colour step at the edge.
    const bandCount = bands.length;

    function applyColorOffset(offset) {
      for (let i = 0; i < bandCount; i++) {
        const src = ((i - offset) % bandCount + bandCount) % bandCount;
        bands[i].el.style.background = baseColors[src];
      }
      const backdropSrc = ((bandCount - 1 - offset) % bandCount + bandCount) % bandCount;
      backdrop.style.background =
        offset === 0 ? "rgb(0, 0, 0)" : baseColors[backdropSrc];
    }

    let pressActive = false;
    let pressProgress = 0;
    let manualColorOffset = 0;
    let colorOffset = 0;
    let lastStep = 0;
    let pressRaf = null;

    // Start brisk, then accelerate non-linearly from roughly 20 to 150 palette
    // steps per second. The tick can consume multiple accumulated steps in one
    // rendered frame, so the final hold phase keeps gaining speed instead of
    // flattening out at the display refresh rate.
    function stepInterval() {
      const p = Math.min(Math.max(pressProgress, 0), 1);
      const stepsPerSecond = 20 + 130 * Math.pow(p, 2.2);
      return 1000 / stepsPerSecond;
    }

    function pressTick(now) {
      if (!pressActive) {
        pressRaf = null;
        return;
      }
      const interval = stepInterval();
      const elapsed = now - lastStep;
      if (elapsed >= interval) {
        const elapsedSteps = Math.floor(elapsed / interval);
        colorOffset += Math.min(elapsedSteps, 5);
        applyColorOffset(colorOffset);
        lastStep = now - (elapsed % interval);
      }
      pressRaf = requestAnimationFrame(pressTick);
    }

    function onLongPress(event) {
      const detail = event.detail || {};
      pressProgress = detail.progress || 0;
      if (detail.active) {
        if (!pressActive) {
          pressActive = true;
          // Advance immediately so there is no initial pause before the flow.
          colorOffset += 1;
          applyColorOffset(colorOffset);
          lastStep = performance.now();
          pressRaf = requestAnimationFrame(pressTick);
        }
      } else if (pressActive) {
        pressActive = false;
        if (pressRaf) {
          cancelAnimationFrame(pressRaf);
          pressRaf = null;
        }
        colorOffset = manualColorOffset;
        applyColorOffset(manualColorOffset);
      }
    }

    window.addEventListener("archive:hypercube-long-press", onLongPress);
    window.addEventListener("archive:strata-depth", (event) => {
      const requestedIndex = Number(event.detail?.index);
      if (!Number.isFinite(requestedIndex)) return;

      manualColorOffset = Math.min(
        bandCount - 1,
        Math.max(0, Math.round(requestedIndex))
      );
      if (!pressActive) {
        colorOffset = manualColorOffset;
        applyColorOffset(manualColorOffset);
      }
    });

    let pointerRaf = null;
    let pointerX = 0;
    let pointerY = 0;

    function renderPointerTargets() {
      pointerRaf = null;
      const nx = clamp01((pointerX - rootRect.left) / rootRect.width) - 0.5;
      const ny = clamp01((pointerY - rootRect.top) / rootRect.height) - 0.5;
      applyTargets(nx, ny);
    }

    function onPointerMove(event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerRaf === null) {
        pointerRaf = requestAnimationFrame(renderPointerTargets);
      }
    }

    function onPointerLeave() {
      if (pointerRaf !== null) {
        cancelAnimationFrame(pointerRaf);
        pointerRaf = null;
      }
      applyTargets(0, 0);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    
    // HUD Data Scramble Logic for long press
    const latEl = document.getElementById("sb-lat");
    const lngEl = document.getElementById("sb-lng");
    const elevEl = document.getElementById("sb-elev");
    let lastScrambleTime = 0;
    let telemetryWasPressing = null;

    gsap.ticker.add((time, deltaTime) => {
      if (!latEl || !lngEl || !elevEl) return;
      
      const isPressing = stage.classList.contains("is-hud-pressing");
      
      if (isPressing) {
        // Scramble every ~50ms
        if (time - lastScrambleTime > 0.05) {
          latEl.textContent = `LAT: ${(Math.random() * 90).toFixed(4)}`;
          lngEl.textContent = `LNG: ${(Math.random() * 180).toFixed(4)}`;
          elevEl.textContent = `ELEV: -${Math.floor(Math.random() * 9999)}M`;
          lastScrambleTime = time;
        }
      } else if (telemetryWasPressing !== false) {
        // Reset to original values when not pressing
        latEl.textContent = "LAT: 47.3769";
        lngEl.textContent = "LNG: 8.5417";
        elevEl.textContent = "ELEV: -999M";
      }
      telemetryWasPressing = isPressing;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
