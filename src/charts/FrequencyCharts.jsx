import React, { useMemo, useState } from "react";
import Plot from "./Plot";
import {
  COLORS,
  formatNumber,
  formatPercent,
  frequencyGroups,
  genderDifference,
} from "../data/telco";
import { mergeLayout, plotConfig } from "./plotConfig";

const CONTROL_STYLE = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.45rem",
  marginBottom: "0.75rem",
};

const BUTTON_BASE = {
  appearance: "none",
  border: "1px solid #cbd2d9",
  borderRadius: "999px",
  background: "#fff",
  color: COLORS.grayDark,
  cursor: "pointer",
  font: "inherit",
  fontSize: "0.82rem",
  fontWeight: 650,
  lineHeight: 1,
  padding: "0.6rem 0.85rem",
};

const NOTE_STYLE = {
  color: COLORS.grayDark,
  fontSize: "0.82rem",
  lineHeight: 1.55,
  margin: "0.35rem 0 0",
};

function ChoiceButton({ active, children, onClick, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        ...BUTTON_BASE,
        background: active ? COLORS.blue : "#fff",
        borderColor: active ? COLORS.blue : "#cbd2d9",
        color: active ? "#fff" : COLORS.grayDark,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledFlags(count, seed) {
  const flags = Array.from({ length: 100 }, (_, index) => index < count);
  const random = mulberry32(seed);
  for (let index = flags.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [flags[index], flags[target]] = [flags[target], flags[index]];
  }
  return flags;
}

function gridTrace(groupName, group, seed, axisSuffix = "") {
  const flags = shuffledFlags(group.count, seed);
  return {
    type: "scatter",
    mode: "markers",
    x: flags.map((_, index) => index % 10),
    y: flags.map((_, index) => 9 - Math.floor(index / 10)),
    xaxis: `x${axisSuffix}`,
    yaxis: `y${axisSuffix}`,
    marker: {
      symbol: "square",
      size: 22,
      color: flags.map((flag) => (flag ? COLORS.blue : COLORS.bluePale)),
      line: { color: "#ffffff", width: 1.2 },
    },
    customdata: flags.map((flag, index) => [
      index + 1,
      flag ? "Rời bỏ" : "Ở lại",
      groupName,
    ]),
    hovertemplate:
      "Ô %{customdata[0]}/100<br>%{customdata[2]}<br><b>%{customdata[1]}</b><extra></extra>",
    name: groupName,
    showlegend: false,
  };
}

function frequencyCellPinFormatter(event) {
  const values = event?.points?.[0]?.customdata;
  if (!Array.isArray(values) || values.length < 3) return null;

  const [index, status, groupName] = values;
  return {
    title: `Ô ${index}/100`,
    lines: [groupName, status],
  };
}

const gridAxis = (domain, anchor) => ({
  domain,
  anchor,
  range: [-0.75, 9.75],
  fixedrange: false,
  showgrid: false,
  zeroline: false,
  showticklabels: false,
  ticks: "",
  constrain: "domain",
});

/**
 * Figure 16.1 adapted to Telco churn. The first arrangement is always the
 * notebook's seed-42 arrangement; each reshuffle remains deterministic.
 */
export function FrequencyFrameChart({ allowReshuffle = true }) {
  const [selection, setSelection] = useState("both");
  const [shuffleStep, setShuffleStep] = useState(0);
  const visibleGroups =
    selection === "both" ? ["Month-to-month", "Two year"] : [selection];

  const data = useMemo(
    () =>
      visibleGroups.map((name, index) =>
        gridTrace(
          name,
          frequencyGroups[name],
          42 + shuffleStep * 101 + (name === "Two year" ? 17 : 0),
          index === 0 ? "" : "2",
        ),
      ),
    [shuffleStep, selection],
  );

  const both = visibleGroups.length === 2;
  const annotations = visibleGroups.map((name, index) => {
    const group = frequencyGroups[name];
    return {
      xref: "paper",
      yref: "paper",
      x: both ? (index === 0 ? 0.23 : 0.77) : 0.5,
      y: 1.13,
      xanchor: "center",
      yanchor: "bottom",
      align: "center",
      showarrow: false,
      text: `<b>${name}</b><br>${formatPercent(group.rate)} ≈ ${group.count}/100 khách rời bỏ`,
      font: { size: 13, color: COLORS.ink },
    };
  });

  const layout = mergeLayout({
    height: 410,
    margin: { l: 20, r: 20, t: 88, b: 18 },
    hovermode: "closest",
    annotations,
    xaxis: gridAxis(both ? [0, 0.46] : [0.2, 0.8], "y"),
    yaxis: {
      ...gridAxis(both ? [0, 1] : [0, 1], "x"),
      scaleanchor: "x",
      scaleratio: 1,
    },
    ...(both
      ? {
          xaxis2: gridAxis([0.54, 1], "y2"),
          yaxis2: {
            ...gridAxis([0, 1], "x2"),
            scaleanchor: "x2",
            scaleratio: 1,
          },
        }
      : {}),
    uirevision: `frequency-${selection}`,
  });

  return (
    <div className="chart-block chart-frequency-frame">
      <div style={CONTROL_STYLE} role="group" aria-label="Chọn loại hợp đồng">
        <ChoiceButton
          active={selection === "Month-to-month"}
          onClick={() => setSelection("Month-to-month")}
        >
          Theo tháng
        </ChoiceButton>
        <ChoiceButton
          active={selection === "Two year"}
          onClick={() => setSelection("Two year")}
        >
          Hai năm
        </ChoiceButton>
        <ChoiceButton active={selection === "both"} onClick={() => setSelection("both")}>
          So sánh cả hai
        </ChoiceButton>
        {allowReshuffle ? (
          <button
            type="button"
            onClick={() => setShuffleStep((step) => step + 1)}
            style={{ ...BUTTON_BASE, marginLeft: "auto" }}
            aria-label="Xáo lại vị trí các ô theo một lần xáo tất định mới"
          >
            Xáo lại vị trí
          </button>
        ) : null}
      </div>
      <Plot
        data={data}
        layout={layout}
        config={plotConfig}
        pinFormatter={frequencyCellPinFormatter}
        pinResetKey={`${selection}-${shuffleStep}`}
        useResizeHandler
        style={{ width: "100%" }}
      />
      <p style={NOTE_STYLE} aria-live="polite">
        Mỗi ô là một khách hàng giả định. Việc xáo chỉ thay đổi vị trí; số ô
        rời bỏ luôn giữ nguyên ({frequencyGroups["Month-to-month"].count} và {frequencyGroups["Two year"].count}
        /100).
      </p>
    </div>
  );
}

// Peter J. Acklam's rational approximation, accurate enough for dot placement.
function inverseNormal(probability) {
  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    0.007784695709041462,
    0.3224671290700398,
    2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;
  const high = 1 - low;

  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (probability <= high) {
    const q = probability - 0.5;
    const r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - probability));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

function normalDensity(value, mean, standardDeviation) {
  const z = (value - mean) / standardDeviation;
  return Math.exp(-0.5 * z * z) / (standardDeviation * Math.sqrt(2 * Math.PI));
}

function quantileDots(count) {
  const standardDeviation =
    (genderDifference.high95 - genderDifference.low95) / (2 * 1.96);
  const binWidth = count === 10 ? 0.0105 : 0.005;
  const stack = new Map();

  return Array.from({ length: count }, (_, index) => {
    const probability = (index + 0.5) / count;
    const value =
      genderDifference.estimate + standardDeviation * inverseNormal(probability);
    const column = Math.round(value / binWidth) * binWidth;
    const stackKey = column.toFixed(5);
    const row = (stack.get(stackKey) || 0) + 1;
    stack.set(stackKey, row);
    return { value, x: column, y: row, probability };
  });
}

/** A 10/50-dot discrete approximation of the Female − Male bootstrap result. */
function LegacyQuantileDotPlot() {
  const [dotCount, setDotCount] = useState(10);
  const dots = useMemo(() => quantileDots(dotCount), [dotCount]);
  const negative = dots.filter((dot) => dot.value < 0);
  const positive = dots.filter((dot) => dot.value >= 0);
  const maxStack = Math.max(...dots.map((dot) => dot.y));
  const standardDeviation =
    (genderDifference.high95 - genderDifference.low95) / (2 * 1.96);
  const curveX = Array.from({ length: 161 }, (_, index) => -0.045 + (0.095 * index) / 160);
  const maxDensity = normalDensity(genderDifference.estimate, genderDifference.estimate, standardDeviation);
  const curveY = curveX.map(
    (value) => (normalDensity(value, genderDifference.estimate, standardDeviation) / maxDensity) * (maxStack + 0.4),
  );

  const dotTrace = (items, name, color) => ({
    type: "scatter",
    mode: "markers",
    x: items.map((dot) => dot.x),
    y: items.map((dot) => dot.y),
    customdata: items.map((dot) => [dot.value, dotCount === 10 ? 10 : 2]),
    marker: {
      size: dotCount === 10 ? 25 : 13,
      color,
      line: { color: "#fff", width: 1 },
    },
    name,
    hovertemplate:
      "Chênh lệch đại diện: %{customdata[0]:+.2%}<br>Mỗi chấm = %{customdata[1]}% xác suất<extra>%{fullData.name}</extra>",
  });

  const data = [
    dotTrace(negative, "Nam cao hơn", "#cfd9e6"),
    dotTrace(positive, "Nữ cao hơn", COLORS.blue),
    {
      type: "scatter",
      mode: "lines",
      x: curveX,
      y: curveY,
      line: { color: COLORS.ink, width: 2 },
      name: "Dạng phân phối",
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "lines+markers",
      x: [genderDifference.low95, genderDifference.high95],
      y: [0.25, 0.25],
      line: { color: COLORS.ink, width: 3 },
      marker: { color: COLORS.ink, size: 7, symbol: "line-ns-open" },
      name: "95% bootstrap CI",
      hovertemplate: "95% CI: [%{x:.1%}]<extra></extra>",
    },
  ];

  const layout = mergeLayout({
    height: 430,
    margin: { l: 54, r: 24, t: 42, b: 64 },
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.14 },
    xaxis: {
      range: [-0.045, 0.05],
      tickformat: "+.1%",
      title: { text: "Chênh lệch tỷ lệ rời bỏ (Nữ − Nam)" },
      zeroline: false,
    },
    yaxis: {
      range: [0, maxStack + 1.2],
      showticklabels: false,
      showgrid: false,
      zeroline: false,
      title: { text: "" },
    },
    shapes: [
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: 0,
        y1: maxStack + 1,
        line: { color: COLORS.grayDark, width: 1.5, dash: "dash" },
      },
      {
        type: "line",
        x0: genderDifference.estimate,
        x1: genderDifference.estimate,
        y0: 0,
        y1: maxStack + 1,
        line: { color: COLORS.ink, width: 2 },
      },
    ],
    annotations: [
      {
        x: genderDifference.estimate,
        y: maxStack + 0.72,
        xref: "x",
        yref: "y",
        text: `Ước lượng ${formatPercent(genderDifference.estimate, 1)}`,
        showarrow: false,
        xanchor: "left",
        font: { size: 11, color: COLORS.ink },
      },
    ],
    uirevision: `quantile-${dotCount}`,
  });

  return (
    <div className="chart-block chart-quantile-dots">
      <div style={CONTROL_STYLE} role="group" aria-label="Chọn số chấm phân vị">
        <ChoiceButton active={dotCount === 10} onClick={() => setDotCount(10)}>
          10 chấm · 10%/chấm
        </ChoiceButton>
        <ChoiceButton active={dotCount === 50} onClick={() => setDotCount(50)}>
          50 chấm · 2%/chấm
        </ChoiceButton>
      </div>
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      <p style={NOTE_STYLE} aria-live="polite">
        Bootstrap trong notebook: Nữ {formatPercent(genderDifference.female)}, Nam {formatPercent(genderDifference.male)};
        chênh lệch {formatPercent(genderDifference.estimate, 1)}, 95% CI [
        {formatPercent(genderDifference.low95, 1)}; {formatPercent(genderDifference.high95, 1)}]. Xác suất khối
        bootstrap nằm phía Nữ cao hơn là {formatPercent(genderDifference.femaleHigher, 1)}.
      </p>
    </div>
  );
}

function normalRandomFactory(seed) {
  const random = mulberry32(seed);
  let spare = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    spare = radius * Math.sin(2 * Math.PI * v);
    return radius * Math.cos(2 * Math.PI * v);
  };
}

function simulateDifferences(sampleSize, repetitions) {
  const randomNormal = normalRandomFactory(2026 + sampleSize * 13 + repetitions);
  const standardError = Math.sqrt(
    (genderDifference.female * (1 - genderDifference.female)) / sampleSize +
      (genderDifference.male * (1 - genderDifference.male)) / sampleSize,
  );
  return Array.from(
    { length: repetitions },
    () => genderDifference.estimate + standardError * randomNormal(),
  );
}

/**
 * An interactive approximation of repeated Female/Male samples. Increasing n
 * narrows the sampling distribution; repetitions only make its shape smoother.
 */
function LegacySamplingDistributionChart() {
  const [sampleSize, setSampleSize] = useState(3500);
  const [repetitions, setRepetitions] = useState(5000);
  const samples = useMemo(
    () => simulateDifferences(sampleSize, repetitions),
    [sampleSize, repetitions],
  );
  const standardError = Math.sqrt(
    (genderDifference.female * (1 - genderDifference.female)) / sampleSize +
      (genderDifference.male * (1 - genderDifference.male)) / sampleSize,
  );
  const limit = Math.max(0.045, Math.abs(genderDifference.estimate) + standardError * 3.8);
  const binSize = (limit * 2) / 32;
  const belowZero = samples.filter((value) => value < 0);
  const aboveZero = samples.filter((value) => value >= 0);
  const simulatedPositive = aboveZero.length / samples.length;
  const commonHistogram = {
    type: "histogram",
    histnorm: "probability density",
    opacity: 0.92,
    xbins: { start: -limit, end: limit, size: binSize },
    hovertemplate: "Chênh lệch: %{x:+.2%}<br>Mật độ: %{y:.1f}<extra>%{fullData.name}</extra>",
  };
  const curveX = Array.from({ length: 181 }, (_, index) => -limit + (2 * limit * index) / 180);

  const data = [
    {
      ...commonHistogram,
      x: belowZero,
      name: "Nam cao hơn",
      marker: { color: "#cfd9e6", line: { color: "#fff", width: 0.5 } },
    },
    {
      ...commonHistogram,
      x: aboveZero,
      name: "Nữ cao hơn",
      marker: { color: COLORS.blue, line: { color: "#fff", width: 0.5 } },
    },
    {
      type: "scatter",
      mode: "lines",
      x: curveX,
      y: curveX.map((value) => normalDensity(value, genderDifference.estimate, standardError)),
      line: { color: COLORS.ink, width: 2 },
      name: "Phân phối lý thuyết",
      hovertemplate: "Chênh lệch: %{x:+.2%}<br>Mật độ: %{y:.1f}<extra></extra>",
    },
  ];

  const layout = mergeLayout({
    height: 430,
    margin: { l: 62, r: 24, t: 44, b: 62 },
    barmode: "overlay",
    bargap: 0.06,
    legend: { orientation: "h", x: 0, y: 1.16 },
    xaxis: {
      range: [-limit, limit],
      tickformat: "+.1%",
      title: { text: "Chênh lệch tỷ lệ rời bỏ (Nữ − Nam)" },
      zeroline: false,
    },
    yaxis: { title: { text: "Mật độ tương đối" }, rangemode: "tozero" },
    shapes: [
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: COLORS.grayDark, dash: "dash", width: 1.5 },
      },
      {
        type: "line",
        x0: genderDifference.estimate,
        x1: genderDifference.estimate,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: COLORS.ink, width: 2 },
      },
    ],
    uirevision: `sampling-${sampleSize}-${repetitions}`,
  });

  return (
    <div className="chart-block chart-sampling-distribution">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem 1.25rem",
          marginBottom: "0.65rem",
        }}
      >
        <label style={{ color: COLORS.ink, fontSize: "0.84rem", fontWeight: 650 }}>
          Cỡ mẫu mỗi nhóm: <output>{formatNumber(sampleSize)}</output>
          <input
            type="range"
            min="50"
            max="3500"
            step="50"
            value={sampleSize}
            onChange={(event) => setSampleSize(Number(event.target.value))}
            style={{ display: "block", width: "100%", accentColor: COLORS.blue, marginTop: "0.45rem" }}
            aria-label="Cỡ mẫu cho mỗi nhóm giới tính"
          />
        </label>
        <label style={{ color: COLORS.ink, fontSize: "0.84rem", fontWeight: 650 }}>
          Số lần lặp: <output>{formatNumber(repetitions)}</output>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            value={repetitions}
            onChange={(event) => setRepetitions(Number(event.target.value))}
            style={{ display: "block", width: "100%", accentColor: COLORS.blue, marginTop: "0.45rem" }}
            aria-label="Số lần lặp lấy mẫu"
          />
        </label>
      </div>
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      <p style={NOTE_STYLE} aria-live="polite">
        Mô phỏng hiện tại: SE ≈ {formatPercent(standardError, 2)}; {formatPercent(simulatedPositive, 1)} lần
        lặp cho Nữ cao hơn. Mốc notebook (5.000 bootstrap, seed 42): {formatPercent(
          genderDifference.femaleHigher,
          1,
        )} và 95% CI [{formatPercent(genderDifference.low95, 1)}; {formatPercent(
          genderDifference.high95,
          1,
        )}]. Tăng cỡ mẫu làm phân phối hẹp lại; tăng số lần lặp làm hình dạng mượt hơn.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notebook-faithful versions of Figures 16.3 and the following density plot.
// The 10-dot profile and the binned 50-dot profile below reproduce cells
// 11 and 13 of code_demo_minh_họa_.ipynb. Keeping the representative dots as
// explicit data also makes the graphic deterministic and easy to audit.

const NOTEBOOK_MALE_COLOR = "#cfd9e6";
const NOTEBOOK_FEMALE_COLOR = "#2c5f8a";
const NOTEBOOK_X_LIMIT = 0.045;
const NOTEBOOK_CURVE = {
  mean: 0.00915,
  standardDeviation: 0.012075,
};

const formatSignedPercent = (value, digits = 1) =>
  new Intl.NumberFormat("vi-VN", {
    style: "percent",
    signDisplay: "always",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const NOTEBOOK_PROFILE_10 = [
  { x: -0.0065, count: 2 },
  { x: 0.0065, count: 4 },
  { x: 0.017, count: 3 },
  { x: 0.0275, count: 1 },
];

const NOTEBOOK_PROFILE_50 = [
  { x: -0.0125, count: 2 },
  { x: -0.0075, count: 4 },
  { x: -0.0025, count: 5 },
  { x: 0.0025, count: 9 },
  { x: 0.0075, count: 9 },
  { x: 0.0125, count: 9 },
  { x: 0.0175, count: 6 },
  { x: 0.0225, count: 3 },
  { x: 0.0275, count: 2 },
  { x: 0.0325, count: 1 },
];

function stackNotebookProfile(profile, yStart, yGap, probabilityMass) {
  return profile.flatMap(({ x, count }) =>
    Array.from({ length: count }, (_, row) => ({
      x,
      y: yStart + row * yGap,
      probabilityMass,
      side: x < 0 ? "Nam" : "Nữ",
    })),
  );
}

function notebookCurve(peak, pointCount = 301) {
  const { mean, standardDeviation } = NOTEBOOK_CURVE;
  const start = mean - 3.2 * standardDeviation;
  const end = mean + 3.2 * standardDeviation;
  const x = Array.from(
    { length: pointCount },
    (_, index) => start + ((end - start) * index) / (pointCount - 1),
  );
  const y = x.map(
    (value) =>
      Math.exp(-0.5 * ((value - mean) / standardDeviation) ** 2) * peak,
  );
  return { x, y };
}

function notebookSummary() {
  return (
    <div className="notebook-chart-summary" aria-label="Các thông số từ notebook">
      <span>Nữ <strong>{formatPercent(genderDifference.female)}</strong></span>
      <span>Nam <strong>{formatPercent(genderDifference.male)}</strong></span>
      <span>
        Nữ − Nam <strong>{formatSignedPercent(genderDifference.estimate, 1)}</strong>
      </span>
      <span>
        95% bootstrap CI <strong>[{formatSignedPercent(genderDifference.low95, 1)}; {formatSignedPercent(genderDifference.high95, 1)}]</strong>
      </span>
    </div>
  );
}

function notebookQuantilePinFormatter(event) {
  const values = event?.points?.[0]?.customdata;
  if (!Array.isArray(values) || values.length < 3) return null;

  const [difference, probabilityMass, side] = values;
  return {
    title: `${side} c\u00f3 t\u1ef7 l\u1ec7 cao h\u01a1n`,
    lines: [
      `Ch\u00eanh l\u1ec7ch N\u1eef \u2212 Nam: ${difference}`,
      `M\u1ed7i ch\u1ea5m \u2248 ${probabilityMass} x\u00e1c su\u1ea5t`,
    ],
  };
}

function QuantileDotPanel({ count, profile, markerSize, yStart, yGap }) {
  const dots = stackNotebookProfile(profile, yStart, yGap, 100 / count);
  const curve = notebookCurve(2.1);

  const dotTrace = (side, color) => {
    const selected = dots.filter((dot) => dot.side === side);
    return {
      type: "scatter",
      mode: "markers",
      x: selected.map((dot) => dot.x),
      y: selected.map((dot) => dot.y),
      marker: {
        size: markerSize,
        color,
        line: { color: "#ffffff", width: 1.1 },
      },
      customdata: selected.map((dot) => [
        formatSignedPercent(dot.x, 1),
        formatPercent(dot.probabilityMass / 100, 0),
        dot.side,
      ]),
      name: side,
      hovertemplate:
        "%{customdata[2]} có tỷ lệ cao hơn<br>Chênh lệch Nữ − Nam: <b>%{customdata[0]}</b><br>Mỗi chấm ≈ %{customdata[1]} xác suất<extra></extra>",
    };
  };

  const data = [
    dotTrace("Nam", NOTEBOOK_MALE_COLOR),
    dotTrace("Nữ", NOTEBOOK_FEMALE_COLOR),
    {
      type: "scatter",
      mode: "lines",
      x: curve.x,
      y: curve.y,
      line: { color: "#111111", width: 2.4 },
      name: "Đường mật độ",
      showlegend: false,
      hovertemplate:
        "Đường mật độ<br>Chênh lệch Nữ − Nam: <b>%{x:+.1%}</b><br>Mật độ tương đối: %{y:.2f}<extra></extra>",
    },
  ];

  const layout = mergeLayout({
    height: 420,
    margin: { l: 62, r: 18, t: 62, b: 48 },
    title: {
      text: `<b>${count} chấm · ${100 / count}% mỗi chấm</b>`,
      x: 0.5,
      xanchor: "center",
      font: { size: 14, color: COLORS.ink },
    },
    hovermode: "closest",
    legend: {
      x: 0.99,
      y: 0.99,
      xanchor: "right",
      yanchor: "top",
      bgcolor: "rgba(255,255,255,0.9)",
      bordercolor: "#d7dce0",
      borderwidth: 1,
      font: { size: 11 },
    },
    xaxis: {
      range: [-NOTEBOOK_X_LIMIT, NOTEBOOK_X_LIMIT],
      tickvals: [-0.04, -0.02, 0, 0.02, 0.04],
      tickformat: ".1%",
      title: { text: "" },
      zeroline: false,
      showgrid: false,
    },
    yaxis: {
      range: [0, 4],
      tickvals: [0, 1, 2, 3, 4],
      title: { text: "Mật độ tương đối" },
      zeroline: false,
      showgrid: false,
    },
    shapes: [
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 4,
        line: { color: "#777777", width: 1.8, dash: "dash" },
      },
      {
        type: "line",
        x0: genderDifference.estimate,
        x1: genderDifference.estimate,
        y0: 0,
        y1: 4,
        line: { color: "#111111", width: 2.2 },
      },
    ],
    uirevision: `notebook-quantile-${count}`,
  });

  return (
    <div className="quantile-panel">
      <Plot
        data={data}
        layout={layout}
        config={plotConfig}
        pinFormatter={notebookQuantilePinFormatter}
      />
    </div>
  );
}

/** Figure 16.3 as rendered by notebook cell 11: 10 and 50 dots together. */
export function QuantileDotPlot() {
  return (
    <div className="chart-block chart-quantile-dots">
      {notebookSummary()}
      <div className="quantile-comparison">
        <QuantileDotPanel
          count={10}
          profile={NOTEBOOK_PROFILE_10}
          markerSize={38}
          yStart={0.32}
          yGap={0.47}
        />
        <QuantileDotPanel
          count={50}
          profile={NOTEBOOK_PROFILE_50}
          markerSize={20}
          yStart={0.15}
          yGap={0.22}
        />
      </div>
      <p style={NOTE_STYLE}>
        Cùng một bootstrap 5.000 lần (seed 42): panel trái gom xác suất thành 10
        chấm lớn; panel phải dùng 50 chấm để cho thấy hình dạng chi tiết hơn.
        Màu nhạt nằm bên trái 0, màu xanh đậm nằm bên phải 0.
      </p>
    </div>
  );
}

/** Notebook cell 13: the same uncertainty shown as a split filled density. */
function notebookSamplingPinFormatter(event) {
  const point = event?.points?.[0];
  if (!point) return null;

  const title = point.fullData?.name || "Ph\u00e2n ph\u1ed1i k\u1ebft qu\u1ea3";
  if (point.customdata != null) {
    return {
      title,
      lines: [`Kho\u1ea3ng: ${point.customdata}`],
    };
  }

  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return {
    title,
    lines: [
      `Ch\u00eanh l\u1ec7ch N\u1eef \u2212 Nam: ${formatSignedPercent(point.x, 1)}`,
      `M\u1eadt \u0111\u1ed9: ${point.y.toFixed(2)}`,
    ],
  };
}

export function SamplingDistributionChart() {
  const curve = notebookCurve(3.42, 401);
  const points = curve.x.map((x, index) => ({ x, y: curve.y[index] }));
  const zeroY = 3.42 * Math.exp(
    -0.5 * ((0 - NOTEBOOK_CURVE.mean) / NOTEBOOK_CURVE.standardDeviation) ** 2,
  );
  const left = [...points.filter((point) => point.x < 0), { x: 0, y: zeroY }];
  const right = [{ x: 0, y: zeroY }, ...points.filter((point) => point.x > 0)];
  const intervalY = 0.48;
  const intervalText = `[${formatSignedPercent(genderDifference.low95, 1)}; ${formatSignedPercent(
    genderDifference.high95,
    1,
  )}]`;

  const fillTrace = (items, name, color, probability) => ({
    type: "scatter",
    mode: "lines",
    x: items.map((point) => point.x),
    y: items.map((point) => point.y),
    line: { color: "rgba(0,0,0,0)", width: 0 },
    fill: "tozeroy",
    fillcolor: color,
    name: `${name} (${formatPercent(probability, 1)})`,
    hovertemplate: `${name}<br>Chênh lệch Nữ − Nam: <b>%{x:+.1%}</b><br>Mật độ: %{y:.2f}<extra></extra>`,
  });

  const data = [
    fillTrace(
      left,
      "Khách nam rời bỏ cao hơn",
      NOTEBOOK_MALE_COLOR,
      genderDifference.maleHigher,
    ),
    fillTrace(
      right,
      "Khách nữ rời bỏ cao hơn",
      NOTEBOOK_FEMALE_COLOR,
      genderDifference.femaleHigher,
    ),
    {
      type: "scatter",
      mode: "lines",
      x: curve.x,
      y: curve.y,
      line: { color: "#111111", width: 2.5 },
      name: "Đường mật độ",
      showlegend: false,
      hovertemplate:
        "Phân phối kết quả<br>Chênh lệch Nữ − Nam: <b>%{x:+.1%}</b><br>Mật độ: %{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines+markers",
      x: [genderDifference.low95, genderDifference.high95],
      y: [intervalY, intervalY],
      line: { color: "#111111", width: 3 },
      marker: {
        color: "#111111",
        size: 11,
        symbol: ["triangle-left", "triangle-right"],
      },
      name: "95% bootstrap interval",
      showlegend: false,
      customdata: [intervalText, intervalText],
      hovertemplate: "95% bootstrap interval: <b>%{customdata}</b><extra></extra>",
    },
  ];

  const layout = mergeLayout({
    height: 500,
    margin: { l: 68, r: 24, t: 76, b: 52 },
    title: {
      text: "<b>Chênh lệch tỷ lệ rời bỏ giữa Nam và Nữ</b>",
      x: 0.5,
      xanchor: "center",
      font: { size: 18, color: COLORS.ink },
    },
    hovermode: "closest",
    legend: {
      x: 0.99,
      y: 0.99,
      xanchor: "right",
      yanchor: "top",
      bgcolor: "rgba(255,255,255,0.92)",
      bordercolor: "#d7dce0",
      borderwidth: 1,
      font: { size: 11 },
    },
    xaxis: {
      range: [-NOTEBOOK_X_LIMIT, NOTEBOOK_X_LIMIT],
      tickvals: [-0.04, -0.02, 0, 0.02, 0.04],
      tickformat: ".1%",
      title: { text: "" },
      zeroline: false,
      showgrid: false,
    },
    yaxis: {
      range: [0, 4.05],
      title: { text: "Mật độ" },
      zeroline: false,
      showgrid: false,
    },
    shapes: [
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 4.05,
        line: { color: "#555555", width: 2, dash: "dash" },
      },
      {
        type: "line",
        x0: genderDifference.estimate,
        x1: genderDifference.estimate,
        y0: 0,
        y1: 4.05,
        line: { color: "#111111", width: 2.3 },
      },
    ],
    annotations: [
      {
        x: (genderDifference.low95 + genderDifference.high95) / 2,
        y: intervalY + 0.12,
        text: "95% bootstrap interval",
        showarrow: false,
        font: { size: 12, color: COLORS.ink },
      },
    ],
    uirevision: "notebook-sampling-density",
  });

  return (
    <div className="chart-block chart-sampling-distribution">
      {notebookSummary()}
      <Plot
        data={data}
        layout={layout}
        config={plotConfig}
        pinFormatter={notebookSamplingPinFormatter}
      />
      <p style={NOTE_STYLE}>
        Phần sáng bên trái 0 chiếm {formatPercent(genderDifference.maleHigher, 1)};
        phần xanh bên phải chiếm {formatPercent(genderDifference.femaleHigher, 1)}.
        Khoảng bootstrap 95% {intervalText} vẫn cắt qua 0, nên khác biệt giới tính
        chưa rõ ràng.
      </p>
    </div>
  );
}

