import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Plot from "./Plot";

import { COLORS, tenureBins } from "../data/telco";
import { mergeLayout, plotConfig } from "./plotConfig";

const FRAME_COUNT = 20;
const FADE_DURATION = 150;
const xObserved = tenureBins.map((bin) => bin.x);
const yObserved = tenureBins.map((bin) => bin.rate);
const xMin = Math.min(...xObserved);
const xMax = Math.max(...xObserved);
const xGrid = Array.from(
  { length: 181 },
  (_, index) => xMin + ((xMax - xMin) * index) / 180,
);

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    let first = 0;
    let second = 0;
    while (first === 0) first = random();
    while (second === 0) second = random();
    const radius = Math.sqrt(-2 * Math.log(first));
    const angle = 2 * Math.PI * second;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

function solve(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-12) return Array(size).fill(0);
    for (let item = column; item <= size; item += 1) {
      rows[column][item] /= divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let item = column; item <= size; item += 1) {
        rows[row][item] -= factor * rows[column][item];
      }
    }
  }

  return rows.map((row) => row[size]);
}

function cubicFit(xs, ys) {
  const center = (xMin + xMax) / 2;
  const scale = (xMax - xMin) / 2;
  const normalized = xs.map((value) => (value - center) / scale);
  const matrix = Array.from({ length: 4 }, () => Array(4).fill(0));
  const vector = Array(4).fill(0);

  normalized.forEach((value, index) => {
    const powers = Array.from({ length: 7 }, (_, power) => value ** power);
    for (let row = 0; row < 4; row += 1) {
      vector[row] += ys[index] * powers[row];
      for (let column = 0; column < 4; column += 1) {
        matrix[row][column] += powers[row + column];
      }
    }
  });

  const coefficients = solve(matrix, vector);
  return (value) => {
    const normalizedValue = (value - center) / scale;
    return coefficients.reduce(
      (sum, coefficient, power) =>
        sum + coefficient * normalizedValue ** power,
      0,
    );
  };
}

function buildHopCurves() {
  const normal = normalRandom(seededRandom(19));
  return Array.from({ length: FRAME_COUNT }, () => {
    const sampledRates = tenureBins.map((bin) => {
      const standardError = Math.sqrt(
        (bin.rate * (1 - bin.rate)) / Math.max(bin.n, 1),
      );
      return clamp(bin.rate + normal() * standardError, 0.002, 0.998);
    });
    const fitted = cubicFit(xObserved, sampledRates);
    return xGrid.map((value) => clamp(fitted(value), 0.005, 0.64));
  });
}

const hopCurves = buildHopCurves();

function hasReducedMotionPreference() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function normalizeFrame(value) {
  return ((value % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
}

const styles = {
  root: {
    width: "100%",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    color: COLORS.ink,
    fontSize: 18,
    lineHeight: 1.35,
  },
  counter: {
    color: COLORS.blue,
    fontVariantNumeric: "tabular-nums",
    fontSize: 14,
    fontWeight: 700,
  },
  plotShell: {
    width: "100%",
    minHeight: 430,
  },
  plot: {
    width: "100%",
    minHeight: 430,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 12,
    borderTop: `1px solid ${COLORS.bluePale}`,
  },
  button: {
    appearance: "none",
    minHeight: 38,
    border: `1px solid ${COLORS.blue}`,
    borderRadius: 3,
    padding: "7px 12px",
    background: COLORS.paper,
    color: COLORS.blue,
    font: "inherit",
    fontSize: 13,
    fontWeight: 650,
    cursor: "pointer",
  },
  primaryButton: {
    minWidth: 94,
    background: COLORS.blue,
    color: "#ffffff",
  },
  field: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginLeft: 5,
    color: COLORS.grayDark,
    fontSize: 13,
  },
  select: {
    minHeight: 38,
    border: `1px solid ${COLORS.blueLight}`,
    borderRadius: 3,
    padding: "6px 28px 6px 9px",
    background: "#ffffff",
    color: COLORS.ink,
    font: "inherit",
    fontSize: 13,
  },
  explanation: {
    maxWidth: 820,
    margin: "12px 0 0",
    color: COLORS.grayDark,
    fontSize: 13,
    lineHeight: 1.55,
  },
  motionNotice: {
    maxWidth: 820,
    margin: "8px 0 0",
    paddingLeft: 10,
    borderLeft: `3px solid ${COLORS.gold}`,
    color: COLORS.grayDark,
    fontSize: 12,
    lineHeight: 1.5,
  },
};

export function HopChart() {
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    hasReducedMotionPreference,
  );
  const [playing, setPlaying] = useState(
    () => !hasReducedMotionPreference(),
  );
  const [speed, setSpeed] = useState(650);
  const [transitionMode, setTransitionMode] = useState(() =>
    hasReducedMotionPreference() ? "hard" : "fade",
  );
  const [plotVisible, setPlotVisible] = useState(true);
  const targetFrame = useRef(0);
  const fadeTimer = useRef(null);
  const animationFrame = useRef(null);

  const cancelFade = useCallback(() => {
    if (fadeTimer.current !== null) {
      window.clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }
    if (animationFrame.current !== null) {
      window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  const goToFrame = useCallback(
    (nextFrame) => {
      const normalized = normalizeFrame(nextFrame);
      targetFrame.current = normalized;
      cancelFade();

      if (transitionMode === "fade" && !reducedMotion) {
        setPlotVisible(false);
        fadeTimer.current = window.setTimeout(() => {
          setFrame(normalized);
          animationFrame.current = window.requestAnimationFrame(() => {
            setPlotVisible(true);
            animationFrame.current = null;
          });
          fadeTimer.current = null;
        }, FADE_DURATION);
      } else {
        setFrame(normalized);
        setPlotVisible(true);
      }
    },
    [cancelFade, reducedMotion, transitionMode],
  );

  const step = useCallback(
    (amount) => goToFrame(targetFrame.current + amount),
    [goToFrame],
  );

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => step(1), speed);
    return () => window.clearTimeout(timer);
  }, [frame, playing, speed, step]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event) => {
      setReducedMotion(event.matches);
      if (event.matches) {
        setPlaying(false);
        setTransitionMode("hard");
        setPlotVisible(true);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(
    () => () => {
      cancelFade();
    },
    [cancelFade],
  );

  useEffect(() => {
    if (transitionMode === "hard") {
      cancelFade();
      setFrame(targetFrame.current);
      setPlotVisible(true);
    }
  }, [cancelFade, transitionMode]);

  const traces = useMemo(
    () => [
      {
        x: xGrid,
        y: hopCurves[frame],
        type: "scatter",
        mode: "lines",
        name: `Kịch bản ${frame + 1}`,
        line: { color: COLORS.blue, width: 3, simplify: false },
        hovertemplate:
          "Tenure: %{x:.0f} tháng<br>Churn giả định: %{y:.1%}<extra>Kịch bản hiện tại</extra>",
      },
      {
        x: xObserved,
        y: yObserved,
        type: "scatter",
        mode: "markers",
        name: "Tỷ lệ quan sát",
        customdata: tenureBins.map((bin) => [
          String(bin.label),
          bin.n,
          bin.churned,
        ]),
        marker: {
          size: 9,
          color: COLORS.ink,
          line: { color: COLORS.paper, width: 1.5 },
        },
        hovertemplate:
          "Tenure %{customdata[0]} tháng<br>Tỷ lệ churn: %{y:.1%}<br>%{customdata[2]} / %{customdata[1]} khách hàng<extra>Quan sát</extra>",
      },
    ],
    [frame],
  );

  const handleManualStep = (amount) => {
    setPlaying(false);
    step(amount);
  };

  return (
    <figure
      style={styles.root}
      aria-labelledby="hop-chart-title"
      aria-describedby="hop-chart-description"
    >
      <div style={styles.header}>
        <h3 id="hop-chart-title" style={styles.title}>
          Một kết quả giả định tại mỗi thời điểm
        </h3>
        <output
          style={styles.counter}
          aria-live={playing ? "off" : "polite"}
          aria-atomic="true"
        >
          Khung {String(frame + 1).padStart(2, "0")} / {FRAME_COUNT}
        </output>
      </div>

      <div
        style={{
          ...styles.plotShell,
          opacity: plotVisible ? 1 : 0,
          transition:
            transitionMode === "fade" && !reducedMotion
              ? `opacity ${FADE_DURATION}ms ease`
              : "none",
        }}
      >
        <Plot
          data={traces}
          revision={frame}
          layout={mergeLayout({
            height: 430,
            margin: { l: 62, r: 24, t: 18, b: 60 },
            hovermode: "closest",
            dragmode: "zoom",
            datarevision: frame,
            uirevision: "hop-tenure-axes",
            transition: { duration: 0 },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.02,
              xanchor: "left",
              yanchor: "bottom",
              font: { size: 11 },
            },
            xaxis: {
              title: { text: "Thời gian sử dụng dịch vụ (tháng)" },
              range: [0, 72],
              dtick: 12,
            },
            yaxis: {
              title: { text: "Tỷ lệ rời bỏ" },
              range: [0, 0.64],
              tickformat: ".0%",
            },
          })}
          config={plotConfig}
          useResizeHandler
          style={styles.plot}
        />
      </div>

      <div
        role="group"
        style={styles.controls}
        aria-label="Điều khiển hoạt ảnh HOP"
      >
        <button
          type="button"
          onClick={() => setPlaying((current) => !current)}
          aria-pressed={playing}
          style={{ ...styles.button, ...styles.primaryButton }}
        >
          {playing ? "Tạm dừng" : "Phát"}
        </button>
        <button
          type="button"
          onClick={() => handleManualStep(-1)}
          aria-label="Xem khung kết quả giả định trước"
          style={styles.button}
        >
          ← Trước
        </button>
        <button
          type="button"
          onClick={() => handleManualStep(1)}
          aria-label="Xem khung kết quả giả định tiếp theo"
          style={styles.button}
        >
          Sau →
        </button>

        <label style={styles.field}>
          Tốc độ
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            style={styles.select}
          >
            <option value={1200}>Chậm · 1,2 giây</option>
            <option value={650}>Vừa · 0,65 giây</option>
            <option value={350}>Nhanh · 0,35 giây</option>
          </select>
        </label>

        <label style={styles.field}>
          Chuyển khung
          <select
            value={transitionMode}
            onChange={(event) => setTransitionMode(event.target.value)}
            style={styles.select}
          >
            <option value="hard">Cắt cảnh</option>
            <option value="fade" disabled={reducedMotion}>
              Mờ dần
            </option>
          </select>
        </label>
      </div>

      <figcaption id="hop-chart-description" style={styles.explanation}>
        Mỗi khung là một đường cong bậc ba khả dĩ từ bootstrap minh họa với
        seed cố định. HOP thay toàn bộ đường giữa các khung — không nội suy hình
        dạng — để người xem cảm nhận nhiều kết quả tương thích với cùng dữ liệu.
      </figcaption>

      {reducedMotion ? (
        <p role="status" style={styles.motionNotice}>
          Trình duyệt đang ưu tiên giảm chuyển động, vì vậy HOP khởi đầu ở trạng
          thái dừng và dùng chuyển khung kiểu cắt cảnh. Bạn vẫn có thể xem từng
          khung bằng nút Trước/Sau.
        </p>
      ) : null}
    </figure>
  );
}
