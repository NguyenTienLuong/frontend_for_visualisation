import React, { useEffect, useMemo, useState } from "react";
import Plot from "./Plot";

import { COLORS, tenureBins } from "../data/telco";
import { mergeLayout, plotConfig } from "./plotConfig";

const MODES = [
  {
    id: "confidence-band",
    tab: "Dải 95%",
    title: "Xu hướng tuyến tính và dải tin cậy 95%",
    description:
      "Dải màu cho biết độ bất định của toàn bộ đường khớp, không phải khoảng chứa 95% khách hàng.",
  },
  {
    id: "alternative-lines",
    tab: "15 đường khả dĩ",
    title: "Các đường xu hướng khả dĩ từ bootstrap",
    description:
      "Mỗi đường là một kết quả khớp hợp lý khác. Cả bó đường chính là một cách khác để nhìn dải bất định.",
  },
  {
    id: "graded-bands",
    tab: "Dải 80 / 95 / 99%",
    title: "Dải tin cậy phân cấp",
    description:
      "Các mức được lồng vào nhau: mức tin cậy càng cao thì vùng bất định càng rộng.",
  },
  {
    id: "nonlinear-fit",
    tab: "Xu hướng phi tuyến",
    title: "Xu hướng phi tuyến: bất định cả về hình dạng",
    description:
      "Với đường bậc ba, các kết quả hợp lý có thể khác nhau cả độ cao lẫn độ uốn.",
  },
];

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

    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    vector[rowIndex],
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivot][column])
      ) {
        pivot = row;
      }
    }

    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];

    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-12) return Array(size).fill(0);
    for (let item = column; item <= size; item += 1) {
      augmented[column][item] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= size; item += 1) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function fitPolynomial(xs, ys, degree) {
  const center = (xMin + xMax) / 2;
  const scale = (xMax - xMin) / 2;
  const normalized = xs.map((value) => (value - center) / scale);
  const size = degree + 1;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const vector = Array(size).fill(0);

  normalized.forEach((value, index) => {
    const powers = Array.from({ length: degree * 2 + 1 }, (_, power) =>
      value ** power,
    );
    for (let row = 0; row < size; row += 1) {
      vector[row] += ys[index] * powers[row];
      for (let column = 0; column < size; column += 1) {
        matrix[row][column] += powers[row + column];
      }
    }
  });

  const coefficients = solveLinearSystem(matrix, vector);
  return (value) => {
    const normalizedValue = (value - center) / scale;
    return coefficients.reduce(
      (sum, coefficient, power) =>
        sum + coefficient * normalizedValue ** power,
      0,
    );
  };
}

function generateBootstrapCurves({ degree, count, seed }) {
  const normal = normalRandom(seededRandom(seed));
  return Array.from({ length: count }, () => {
    const sampledRates = tenureBins.map((bin) => {
      const standardError = Math.sqrt(
        (bin.rate * (1 - bin.rate)) / Math.max(bin.n, 1),
      );
      return clamp(bin.rate + normal() * standardError, 0.002, 0.998);
    });
    const fitted = fitPolynomial(xObserved, sampledRates, degree);
    return xGrid.map((value) => clamp(fitted(value), 0.005, 0.64));
  });
}

function quantile(values, probability) {
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  if (ordered[lower + 1] === undefined) return ordered[lower];
  return ordered[lower] + fraction * (ordered[lower + 1] - ordered[lower]);
}

function pointwiseInterval(curves, level) {
  const tail = (1 - level) / 2;
  return xGrid.reduce(
    (interval, _, pointIndex) => {
      const values = curves.map((curve) => curve[pointIndex]);
      interval.lower.push(quantile(values, tail));
      interval.upper.push(quantile(values, 1 - tail));
      return interval;
    },
    { lower: [], upper: [] },
  );
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const bestLinearFunction = fitPolynomial(xObserved, yObserved, 1);
const bestCubicFunction = fitPolynomial(xObserved, yObserved, 3);
const bestLinear = xGrid.map(bestLinearFunction);
const bestCubic = xGrid.map((value) =>
  clamp(bestCubicFunction(value), 0.005, 0.64),
);
const linearCurves = generateBootstrapCurves({
  degree: 1,
  count: 640,
  seed: 10,
});
const cubicCurves = generateBootstrapCurves({
  degree: 3,
  count: 520,
  seed: 20,
});
const linearIntervals = {
  80: pointwiseInterval(linearCurves, 0.8),
  95: pointwiseInterval(linearCurves, 0.95),
  99: pointwiseInterval(linearCurves, 0.99),
};
const cubicInterval95 = pointwiseInterval(cubicCurves, 0.95);
const linearSlope = (() => {
  const xMean = xObserved.reduce((sum, value) => sum + value, 0) / xObserved.length;
  const yMean = yObserved.reduce((sum, value) => sum + value, 0) / yObserved.length;
  return (
    xObserved.reduce(
      (sum, value, index) =>
        sum + (value - xMean) * (yObserved[index] - yMean),
      0,
    ) /
    xObserved.reduce((sum, value) => sum + (value - xMean) ** 2, 0)
  );
})();

function bandTraces(interval, label, color, legendGroup) {
  return [
    {
      x: xGrid,
      y: interval.lower,
      type: "scatter",
      mode: "lines",
      line: { width: 0, color: "rgba(0,0,0,0)" },
      hoverinfo: "skip",
      showlegend: false,
      legendgroup: legendGroup,
    },
    {
      x: xGrid,
      y: interval.upper,
      type: "scatter",
      mode: "lines",
      line: { width: 0, color: "rgba(0,0,0,0)" },
      fill: "tonexty",
      fillcolor: color,
      name: label,
      legendgroup: legendGroup,
      hovertemplate: `${label}<extra></extra>`,
    },
  ];
}

const observedTrace = {
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
};

function createTraces(mode) {
  const bestLine = {
    x: xGrid,
    y: bestLinear,
    type: "scatter",
    mode: "lines",
    name: "Đường khớp tốt nhất",
    line: { color: COLORS.blue, width: 3 },
    hovertemplate:
      "Tenure: %{x:.0f} tháng<br>Churn ước lượng: %{y:.1%}<extra>Xu hướng tuyến tính</extra>",
  };

  if (mode === "alternative-lines") {
    const alternatives = linearCurves.slice(0, 15).map((curve, index) => ({
      x: xGrid,
      y: curve,
      type: "scatter",
      mode: "lines",
      name: "15 đường bootstrap minh họa",
      legendgroup: "linear-alternatives",
      showlegend: index === 0,
      line: { color: rgba(COLORS.blueMid, 0.56), width: 1.35 },
      hoverinfo: "skip",
    }));
    return [...alternatives, bestLine, observedTrace];
  }

  if (mode === "graded-bands") {
    return [
      ...bandTraces(
        linearIntervals[99],
        "Dải 99%",
        rgba(COLORS.bluePale, 0.72),
        "band-99",
      ),
      ...bandTraces(
        linearIntervals[95],
        "Dải 95%",
        rgba(COLORS.blueLight, 0.55),
        "band-95",
      ),
      ...bandTraces(
        linearIntervals[80],
        "Dải 80%",
        rgba(COLORS.blueMid, 0.48),
        "band-80",
      ),
      bestLine,
      observedTrace,
    ];
  }

  if (mode === "nonlinear-fit") {
    const alternatives = cubicCurves.slice(0, 8).map((curve, index) => ({
      x: xGrid,
      y: curve,
      type: "scatter",
      mode: "lines",
      name: "8 đường cong bootstrap minh họa",
      legendgroup: "cubic-alternatives",
      showlegend: index === 0,
      line: { color: rgba(COLORS.blueMid, 0.38), width: 1.15 },
      hoverinfo: "skip",
    }));
    return [
      ...bandTraces(
        cubicInterval95,
        "Dải bootstrap 95%",
        rgba(COLORS.bluePale, 0.58),
        "cubic-band",
      ),
      ...alternatives,
      {
        x: xGrid,
        y: bestCubic,
        type: "scatter",
        mode: "lines",
        name: "Đường cong bậc ba",
        line: { color: COLORS.blue, width: 3 },
        hovertemplate:
          "Tenure: %{x:.0f} tháng<br>Churn ước lượng: %{y:.1%}<extra>Khớp bậc ba</extra>",
      },
      observedTrace,
    ];
  }

  return [
    ...bandTraces(
      linearIntervals[95],
      "Dải bootstrap 95%",
      rgba(COLORS.blueLight, 0.48),
      "linear-band",
    ),
    bestLine,
    observedTrace,
  ];
}

const styles = {
  root: {
    width: "100%",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  tab: {
    appearance: "none",
    border: `1px solid ${COLORS.blueLight}`,
    borderRadius: 3,
    padding: "9px 12px",
    font: "inherit",
    fontSize: 13,
    lineHeight: 1.25,
    cursor: "pointer",
  },
  intro: {
    minHeight: 52,
    marginBottom: 4,
  },
  title: {
    margin: "0 0 5px",
    color: COLORS.ink,
    fontSize: 18,
    lineHeight: 1.35,
  },
  description: {
    maxWidth: 760,
    margin: 0,
    color: COLORS.grayDark,
    fontSize: 14,
    lineHeight: 1.55,
  },
  chart: {
    width: "100%",
    minHeight: 430,
  },
  note: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    maxWidth: 820,
    marginTop: 8,
    color: COLORS.grayDark,
    fontSize: 13,
    lineHeight: 1.5,
  },
  badge: {
    flex: "0 0 auto",
    border: `1px solid ${COLORS.blueLight}`,
    borderRadius: 2,
    padding: "2px 6px",
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.035em",
    textTransform: "uppercase",
  },
};

export function TrendExplorer() {
  const [activeMode, setActiveMode] = useState(MODES[0].id);

  useEffect(() => {
    const openRequestedMode = (event) => {
      const requestedId = event.detail?.id;
      if (MODES.some((item) => item.id === requestedId)) setActiveMode(requestedId);
    };
    window.addEventListener("open-chart-tab", openRequestedMode);
    return () => window.removeEventListener("open-chart-tab", openRequestedMode);
  }, []);
  const mode = MODES.find((item) => item.id === activeMode) ?? MODES[0];
  const traces = useMemo(() => createTraces(activeMode), [activeMode]);
  const insight =
    activeMode === "nonlinear-fit"
      ? "Đường bậc ba chỉ dùng để minh họa: nhiều dáng cong cùng tương thích với bảy điểm dữ liệu; đây không phải mô hình dự báo cuối cùng."
      : `Độ dốc ước lượng là ${linearSlope.toFixed(4)} điểm tỷ lệ mỗi tháng (xấp xỉ −0,6 điểm phần trăm/tháng): tenure tăng đi cùng churn giảm.`;

  const handleTabKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % MODES.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + MODES.length) % MODES.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = MODES.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextMode = MODES[nextIndex].id;
    setActiveMode(nextMode);
    window.requestAnimationFrame(() => {
      document.getElementById(`trend-tab-${nextMode}`)?.focus();
    });
  };

  return (
    <div style={styles.root}>
      <div
        role="tablist"
        aria-label="Bốn cách biểu diễn độ bất định của đường xu hướng"
        style={styles.tabs}
      >
        {MODES.map((item, index) => {
          const selected = item.id === activeMode;
          return (
            <button
              key={item.id}
              id={`trend-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="trend-chart-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveMode(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              style={{
                ...styles.tab,
                background: selected ? COLORS.blue : COLORS.paper,
                borderColor: selected ? COLORS.blue : COLORS.blueLight,
                color: selected ? "#ffffff" : COLORS.blue,
                fontWeight: selected ? 700 : 500,
              }}
            >
              {item.tab}
            </button>
          );
        })}
      </div>

      <div
        id="trend-chart-panel"
        role="tabpanel"
        aria-labelledby={`trend-tab-${activeMode}`}
      >
        <div style={styles.intro}>
          <h3 style={styles.title}>{mode.title}</h3>
          <p style={styles.description}>{mode.description}</p>
        </div>

        <Plot
          data={traces}
          layout={mergeLayout({
            height: 440,
            margin: { l: 62, r: 24, t: 58, b: 60 },
            hovermode: "closest",
            dragmode: "zoom",
            uirevision: "tenure-trend",
            legend: {
              orientation: "h",
              x: 0,
              y: 1.02,
              xanchor: "left",
              yanchor: "bottom",
              groupclick: "togglegroup",
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
          pinResetKey={activeMode}
          useResizeHandler
          style={styles.chart}
        />

        <div style={styles.note}>
          <span style={styles.badge}>Bootstrap minh họa</span>
          <span>
            {insight} Các đường và dải được mô phỏng có seed cố định từ sai số
            nhị thức của từng nhóm tenure, nên kết quả lặp lại ổn định mỗi lần mở
            trang.
          </span>
        </div>
      </div>
    </div>
  );
}
