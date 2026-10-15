import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js";

const PlotlyComponent = createPlotlyComponent(Plotly);

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 4,
});

function formatFallbackValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return numberFormatter.format(value);
  }
  return String(value);
}

function readHoverLines(graphDiv) {
  if (!graphDiv) return [];

  return Array.from(
    graphDiv.querySelectorAll(".hoverlayer .hovertext text"),
  ).flatMap((textNode) => {
    const lineNodes = Array.from(textNode.children);
    const lines = (lineNodes.length ? lineNodes : [textNode])
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    return lines;
  });
}

function createPinnedValue(event, graphDiv, pinFormatter) {
  const formattedValue = pinFormatter?.(event);
  if (formattedValue?.title) {
    return {
      title: String(formattedValue.title),
      lines: Array.isArray(formattedValue.lines)
        ? formattedValue.lines.map(String)
        : [],
    };
  }

  const hoverLines = readHoverLines(graphDiv);
  if (hoverLines.length) {
    return {
      title: hoverLines[0],
      lines: hoverLines.slice(1),
    };
  }

  const point = event?.points?.[0];
  if (!point) return null;

  const title =
    point.fullData?.name || point.data?.name || point.hovertext || "Điểm dữ liệu";
  const lines = [];
  const x = formatFallbackValue(point.x);
  const y = formatFallbackValue(point.y);
  if (x != null) lines.push(`Trục x: ${x}`);
  if (y != null) lines.push(`Trục y: ${y}`);

  return { title: String(title), lines };
}

function isTouchLikeInteraction(event) {
  const sourceEvent = event?.event;
  if (sourceEvent?.pointerType === "touch") return true;
  if (sourceEvent?.type?.startsWith("touch")) return true;
  return Boolean(
    window.matchMedia?.("(hover: none), (pointer: coarse)").matches,
  );
}

/**
 * Plotly reads its container size while it is mounting. A newly selected tab
 * can still be in the first animation frame at that point, which occasionally
 * leaves Plotly with a zero-width drawing area (the surrounding chart frame is
 * visible, but the axes and marks are not). Keep every plot tied to its actual
 * container size and re-measure once more after layout has settled.
 */
const Plot = forwardRef(function ResponsivePlot(
  {
    layout,
    style,
    useResizeHandler = true,
    onInitialized,
    onUpdate,
    onClick,
    onHover,
    pinFormatter,
    pinResetKey,
    revision,
    ...props
  },
  forwardedRef,
) {
  const [graphDiv, setGraphDiv] = useState(null);
  const [pinnedValue, setPinnedValue] = useState(null);
  const animationFrames = useRef([]);
  const unhoverFrame = useRef(null);
  const lastHostWidth = useRef(null);
  const resetKey =
    pinResetKey ??
    [layout?.uirevision, layout?.datarevision, revision].join("|");

  const resizePlot = useCallback(() => {
    if (!graphDiv?.isConnected) return;
    const bounds = graphDiv.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    try {
      Plotly.Plots.resize(graphDiv);
    } catch {
      // The tab may have unmounted between the animation frame and this call.
    }
  }, [graphDiv]);

  const queueResize = useCallback((force = false) => {
    const host = graphDiv?.parentElement || graphDiv;
    const hostWidth = Math.round(host?.getBoundingClientRect().width || 0);
    if (hostWidth < 2) return;
    if (!force && lastHostWidth.current === hostWidth) return;
    lastHostWidth.current = hostWidth;

    animationFrames.current.forEach((frame) => window.cancelAnimationFrame(frame));
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(resizePlot);
      animationFrames.current = [secondFrame];
    });
    animationFrames.current = [firstFrame];
  }, [resizePlot]);

  useEffect(() => {
    if (!graphDiv) return undefined;

    lastHostWidth.current = null;
    queueResize(true);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => queueResize());
    const resizeHost = graphDiv.parentElement || graphDiv;
    resizeObserver?.observe(resizeHost);
    const resizeOnWindow = () => queueResize();
    window.addEventListener("resize", resizeOnWindow);

    document.fonts?.ready.then(() => queueResize(true)).catch(() => {});

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeOnWindow);
      animationFrames.current.forEach((frame) => window.cancelAnimationFrame(frame));
      if (unhoverFrame.current) window.cancelAnimationFrame(unhoverFrame.current);
    };
  }, [graphDiv, queueResize]);

  useEffect(() => {
    setPinnedValue(null);
  }, [resetKey]);

  useEffect(() => {
    if (!pinnedValue) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPinnedValue(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pinnedValue]);

  const rememberGraph = useCallback(
    (figure, nextGraphDiv) => {
      setGraphDiv((current) => (current === nextGraphDiv ? current : nextGraphDiv));
      if (typeof forwardedRef === "function") forwardedRef(nextGraphDiv);
      else if (forwardedRef) forwardedRef.current = nextGraphDiv;
      onInitialized?.(figure, nextGraphDiv);
    },
    [forwardedRef, onInitialized],
  );

  const rememberUpdate = useCallback(
    (figure, nextGraphDiv) => {
      onUpdate?.(figure, nextGraphDiv);
    },
    [onUpdate],
  );

  const pinClickedValue = useCallback(
    (event) => {
      const nextValue = createPinnedValue(event, graphDiv, pinFormatter);
      if (nextValue) setPinnedValue(nextValue);

      // Plotly 2.x can move the SVG hover text away from its background after
      // a click on a scrolled page. Remove that transient layer; the React
      // readout above it is the persistent, responsive click state.
      if (graphDiv) {
        const clearNativeHover = () => {
          if (!graphDiv.isConnected) return;
          try {
            Plotly.Fx.unhover(graphDiv);
          } catch {
            // The graph may have unmounted while the click event was settling.
          }
        };
        try {
          clearNativeHover();
          if (unhoverFrame.current) {
            window.cancelAnimationFrame(unhoverFrame.current);
          }
          unhoverFrame.current = window.requestAnimationFrame(clearNativeHover);
        } catch {
          // The graph may have unmounted while the click event was settling.
        }
      }

      onClick?.(event);
    },
    [graphDiv, onClick, pinFormatter],
  );

  const pinTouchedValue = useCallback(
    (event) => {
      if (isTouchLikeInteraction(event)) {
        const nextValue = createPinnedValue(event, graphDiv, pinFormatter);
        if (nextValue) setPinnedValue(nextValue);
      }
      onHover?.(event);
    },
    [graphDiv, onHover, pinFormatter],
  );

  const fixedHeight =
    typeof layout?.height === "number" ? `${layout.height}px` : "100%";

  return (
    <div className="plot-with-pin">
      <PlotlyComponent
        {...props}
        layout={layout}
        onInitialized={rememberGraph}
        onUpdate={rememberUpdate}
        onClick={pinClickedValue}
        onHover={pinTouchedValue}
        revision={revision}
        useResizeHandler={
          useResizeHandler && typeof ResizeObserver === "undefined"
        }
        style={{ width: "100%", height: fixedHeight, minHeight: fixedHeight, ...style }}
      />
      <div className="plot-pin-live" role="status" aria-live="polite" aria-atomic="true">
        {pinnedValue ? (
          <aside className="plot-pin" aria-label="Giá trị đã chọn">
            <button
              type="button"
              className="plot-pin-close"
              aria-label="Đóng giá trị đã chọn"
              onClick={() => setPinnedValue(null)}
            >
              ×
            </button>
            <div>
              <span className="plot-pin-label">Giá trị đã chọn</span>
              <strong>{pinnedValue.title}</strong>
              {pinnedValue.lines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
});

export default Plot;
