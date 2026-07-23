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
  const INNER_COUNT = 18; // coloured rectangles inside the frame (+2 extra layers toward the centre)
  const BACKDROP_SCALE = 1.2; // fixed pure-black outer frame; overscans => seam-proof edge
  const INNER_OUTER = 0.965; // scale of the outermost coloured rectangle
  const INNER_CENTER = 0.211; // scale of the central (black) rectangle (keeps the same per-layer spacing as before)
  const MID_FRAC = 0.42; // position of the bright band among the inner rectangles
  const OUTER_GRAY = 0.12; // luminance of the outermost coloured rectangle (distinct from the black frame)
  const WHITE_LUM = 220 / 255; // peak brightness = #DCDCDC light gray, softer than pure white (and its inverse)

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

  function grayFromLum(lum) {
    const v = Math.round(clamp01(lum) * 255);
    return `rgb(${v}, ${v}, ${v})`;
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

    // Fixed pure-black outer frame: overscans the viewport and never moves, so
    // the screen edge is always seamless solid black.
    const backdrop = document.createElement("div");
    backdrop.className = "strata-frames__band";
    backdrop.style.width = `${(BACKDROP_SCALE * 100).toFixed(3)}vw`;
    backdrop.style.height = `${(BACKDROP_SCALE * 100).toFixed(3)}vh`;
    backdrop.style.background = "rgb(0, 0, 0)";
    backdrop.style.zIndex = "1";
    root.appendChild(backdrop);

    const bands = [];
    const innerDelta = (INNER_CENTER - INNER_OUTER) / (INNER_COUNT - 1);
    const brightJ = Math.round(MID_FRAC * (INNER_COUNT - 1));

    for (let j = 0; j < INNER_COUNT; j++) {
      const scale = INNER_OUTER + innerDelta * j;

      // Outer half ramps dark-gray -> near-white, inner half near-white -> black centre.
      const lum = j <= brightJ
        ? OUTER_GRAY + (WHITE_LUM - OUTER_GRAY) * (j / brightJ)
        : WHITE_LUM * (1 - (j - brightJ) / (INNER_COUNT - 1 - brightJ));

      let baseColor;
      if (j === INNER_COUNT - 1) {
        baseColor = "rgb(0, 0, 0)"; // pure-black centre
      } else if (j === brightJ) {
        baseColor = grayFromLum(WHITE_LUM); // near-white light-gray band
      } else {
        baseColor = grayFromLum(lum);
      }

      const band = document.createElement("div");
      band.className = "strata-frames__band";
      band.style.width = `${(scale * 100).toFixed(3)}vw`;
      band.style.height = `${(scale * 100).toFixed(3)}vh`;
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
      const reachX = window.innerWidth * REACH;
      const reachY = window.innerHeight * REACH;
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
    // Only the 18 inner bands cycle (a single black at the centre) so no two
    // adjacent frames are ever the same colour. The outer black backdrop follows
    // the outermost band while cycling (so the very edge flows too) and returns to
    // pure black at rest for a seamless edge.
    const bandCount = bands.length;

    function applyColorOffset(offset) {
      for (let i = 0; i < bandCount; i++) {
        const src = ((i - offset) % bandCount + bandCount) % bandCount;
        bands[i].el.style.background = baseColors[src];
      }
      backdrop.style.background =
        offset === 0 ? "rgb(0, 0, 0)" : bands[0].el.style.background;
    }

    let pressActive = false;
    let pressProgress = 0;
    let colorOffset = 0;
    let lastStep = 0;
    let pressRaf = null;

    // Step cadence: already brisk at the start (no dead time), tightening toward
    // the frame rate ceiling as the press deepens so it keeps accelerating.
    function stepInterval() {
      const p = Math.min(Math.max(pressProgress, 0), 1);
      return 78 - 62 * (p * p * (3 - 2 * p)); // ~78ms -> ~16ms, eased
    }

    function pressTick(now) {
      if (!pressActive) {
        pressRaf = null;
        return;
      }
      if (now - lastStep >= stepInterval()) {
        colorOffset += 1;
        applyColorOffset(colorOffset);
        lastStep = now;
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
        colorOffset = 0;
        applyColorOffset(0);
      }
    }

    window.addEventListener("archive:hypercube-long-press", onLongPress);

    function onPointerMove(event) {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      applyTargets(nx, ny);
    }

    function onPointerLeave() {
      applyTargets(0, 0);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
