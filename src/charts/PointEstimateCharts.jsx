import React, { useMemo, useState } from "react";
import Plot from "./Plot";
import {
  COLORS,
  bayesianPayments,
  contractRates,
  formatNumber,
  formatPercent,
  monthlyCharges,
  multipleLines,
  paymentBase,
  paymentDifferences,
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

const LEVEL_STYLES = {
  99: { width: 3, opacity: 0.34, color: COLORS.blueLight },
  95: { width: 6, opacity: 0.64, color: COLORS.blueMid },
  80: { width: 10, opacity: 1, color: COLORS.blue },
};

function ChoiceButton({ active, children, onClick, role, ...props }) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role === "tab" ? undefined : active}
      aria-selected={role === "tab" ? active : undefined}
      tabIndex={role === "tab" && !active ? -1 : undefined}
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

function intervalTrace({
  low,
  high,
  estimate,
  y,
  name,
  color,
  width,
  opacity = 1,
  showlegend = false,
  cap = false,
  hoverLabel = name,
}) {
  const x = cap ? [low, low, null, low, high, null, high, high] : [low, high];
  const yValues = cap
    ? [y - 0.08, y + 0.08, null, y, y, null, y - 0.08, y + 0.08]
    : [y, y];
  return {
    type: "scatter",
    mode: "lines",
    x,
    y: yValues,
    line: { color, width },
    opacity,
    name,
    legendgroup: name,
    showlegend,
    customdata: x.map(() => [low, high, estimate, hoverLabel]),
    hovertemplate:
      "%{customdata[3]}<br>Khoảng: [%{customdata[0]:.1%}; %{customdata[1]:.1%}]<br>Ước lượng: %{customdata[2]:.1%}<extra></extra>",
  };
}

function estimateTrace(
  items,
  yValues,
  name = "Ước lượng điểm",
  color = COLORS.ink,
  estimateKey = "rate",
) {
  return {
    type: "scatter",
    mode: "markers",
    x: items.map((item) => item[estimateKey]),
    y: yValues,
    marker: { color, size: 9, line: { color: "#fff", width: 1 } },
    name,
    customdata: items.map((item) => [item.label, item.n]),
    hovertemplate:
      "%{customdata[0]}<br><b>%{x:.1%}</b><br>n = %{customdata[1]:,}<extra></extra>",
  };
}

function representativeCharges() {
  // The notebook does not persist the 48 raw rows. This deterministic strip is
  // standardized to the exact saved mean and sample SD, so it never invents a
  // different summary while still letting readers see observations vs estimate.
  const base = Array.from({ length: monthlyCharges.n }, (_, index) => {
    const u = (index + 0.7) / monthlyCharges.n;
    return Math.max(-2.15, Math.log(u)) + 0.08 * Math.sin(index * 2.37);
  });
  const baseMean = base.reduce((sum, value) => sum + value, 0) / base.length;
  const baseSd = Math.sqrt(
    base.reduce((sum, value) => sum + (value - baseMean) ** 2, 0) /
      (base.length - 1),
  );
  return base.map(
    (value) => monthlyCharges.mean + ((value - baseMean) / baseSd) * monthlyCharges.sd,
  );
}

function uncertaintyPinFormatter(event) {
  const point = event?.points?.[0];
  if (!point) return null;

  const values = point.customdata;
  if (Array.isArray(values) && values.length >= 4) {
    const [label, low, high, halfWidth] = values;
    return {
      title: label,
      lines: [
        `Khoảng: [${Number(low).toFixed(2)}; ${Number(high).toFixed(2)}]`,
        `Nửa độ rộng: ±${Number(halfWidth).toFixed(2)}`,
      ],
    };
  }

  if (point.fullData?.name === "48 quan sát") {
    return {
      title: `Quan sát minh họa ${values}`,
      lines: [`MonthlyCharges: ${Number(point.x).toFixed(2)}`],
    };
  }

  if (Number.isFinite(point.x)) {
    return {
      title: point.fullData?.name || "Giá trị",
      lines: [`Mean = ${point.x.toFixed(2)}`],
    };
  }

  return null;
}

/** Raw-sample context plus SD, SE and three confidence levels (Figure 16.5). */
export function UncertaintyIntervalsChart() {
  const [confidence, setConfidence] = useState(95);
  const rawValues = useMemo(representativeCharges, []);
  const jitter = rawValues.map((_, index) => 5.65 + 0.16 * Math.sin(index * 4.13));
  const rows = [
    {
      label: "± 1 SD",
      low: monthlyCharges.mean - monthlyCharges.sd,
      high: monthlyCharges.mean + monthlyCharges.sd,
      y: 4,
      kind: "spread",
    },
    {
      label: "± 1 SE",
      low: monthlyCharges.mean - monthlyCharges.se,
      high: monthlyCharges.mean + monthlyCharges.se,
      y: 3,
      kind: "spread",
    },
    ...[80, 95, 99].map((level, index) => ({
      label: `${level}% CI`,
      low: monthlyCharges.intervals[level][0],
      high: monthlyCharges.intervals[level][1],
      y: 2 - index,
      kind: "ci",
      level,
    })),
  ];

  const data = [
    {
      type: "scatter",
      mode: "markers",
      x: rawValues,
      y: jitter,
      marker: {
        color: COLORS.blueMid,
        size: 9,
        opacity: 0.46,
        line: { color: "#fff", width: 0.6 },
      },
      name: "48 quan sát",
      customdata: rawValues.map((_, index) => index + 1),
      hovertemplate:
        "Quan sát minh họa %{customdata}<br>MonthlyCharges: %{x:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "markers",
      x: [monthlyCharges.mean],
      y: [5.18],
      marker: { color: COLORS.blue, size: 14, line: { color: "#fff", width: 1.2 } },
      name: "Trung bình",
      hovertemplate: "Mean = %{x:.2f}<extra></extra>",
    },
    ...rows.flatMap((row) => {
      const selected = row.kind !== "ci" || row.level === confidence;
      const color = row.kind === "ci" ? COLORS.blue : COLORS.grayDark;
      const width = row.kind === "ci" ? (selected ? 8 : 3) : row.label.includes("SD") ? 4 : 3;
      const opacity = row.kind === "ci" ? (selected ? 1 : 0.24) : 0.88;
      return [
        {
          type: "scatter",
          mode: "lines+markers",
          x: [row.low, monthlyCharges.mean, row.high],
          y: [row.y, row.y, row.y],
          line: { color, width },
          marker: { color, size: [5, 8, 5] },
          opacity,
          name: row.label,
          showlegend: false,
          customdata: [row.low, monthlyCharges.mean, row.high].map(() => [
            row.label,
            row.low,
            row.high,
            row.high - monthlyCharges.mean,
          ]),
          hovertemplate:
            "%{customdata[0]}<br>Khoảng: [%{customdata[1]:.2f}; %{customdata[2]:.2f}]<br>Nửa độ rộng: ±%{customdata[3]:.2f}<extra></extra>",
        },
      ];
    }),
  ];

  const lowBound = Math.min(...rawValues, monthlyCharges.mean - monthlyCharges.sd) - 4;
  const highBound = Math.max(...rawValues, monthlyCharges.mean + monthlyCharges.sd) + 4;
  const layout = mergeLayout({
    height: 510,
    margin: { l: 88, r: 30, t: 36, b: 56 },
    hovermode: "closest",
    showlegend: false,
    xaxis: {
      range: [lowBound, highBound],
      title: { text: "MonthlyCharges (khách đã churn, hợp đồng hai năm)" },
      zeroline: false,
    },
    yaxis: {
      range: [-0.55, 6.05],
      tickvals: [4, 3, 2, 1, 0],
      ticktext: ["± 1 SD", "± 1 SE", "80% CI", "95% CI", "99% CI"],
      showgrid: false,
      zeroline: false,
      title: { text: "" },
    },
    annotations: [
      {
        x: monthlyCharges.mean,
        y: 5.03,
        text: `Mean = ${monthlyCharges.mean.toFixed(2)}`,
        showarrow: false,
        yanchor: "top",
        font: { color: COLORS.blue, size: 11 },
      },
    ],
    uirevision: "monthly-intervals",
  });

  return (
    <div className="chart-block chart-uncertainty-intervals">
      <div style={CONTROL_STYLE} role="group" aria-label="Chọn khoảng tin cậy cần nhấn mạnh">
        <span style={{ color: COLORS.grayDark, fontSize: "0.82rem", marginRight: "0.15rem" }}>
          Nhấn mạnh:
        </span>
        {[80, 95, 99].map((level) => (
          <ChoiceButton
            key={level}
            active={confidence === level}
            onClick={() => setConfidence(level)}
          >
            {level}% CI
          </ChoiceButton>
        ))}
      </div>
      <Plot
        data={data}
        layout={layout}
        config={plotConfig}
        pinFormatter={uncertaintyPinFormatter}
        pinResetKey={confidence}
        useResizeHandler
        style={{ width: "100%" }}
      />
      <p style={NOTE_STYLE} aria-live="polite">
        n = {monthlyCharges.n}; mean = {monthlyCharges.mean.toFixed(2)}; SD = {monthlyCharges.sd.toFixed(2)};
        SE = {monthlyCharges.se.toFixed(2)}. {confidence}% CI = [
        {monthlyCharges.intervals[confidence][0].toFixed(2)}; {monthlyCharges.intervals[confidence][1].toFixed(2)}].
        Dải chấm là phối cảnh 48 quan sát được chuẩn hóa theo đúng mean và SD đã lưu trong
        notebook; các thống kê và khoảng là giá trị notebook chính xác.
      </p>
    </div>
  );
}

function nestedIntervalData(items, levels, { cap = false, estimateKey = "rate" } = {}) {
  const traces = [];
  levels.forEach((level) => {
    items.forEach((item, index) => {
      const style = LEVEL_STYLES[level];
      const [low, high] = item.intervals[level];
      traces.push(
        intervalTrace({
          low,
          high,
          estimate: item[estimateKey],
          y: index,
          name: `${level}% CI`,
          color: style.color,
          width: style.width,
          opacity: style.opacity,
          showlegend: index === 0,
          cap,
          hoverLabel: item.label,
        }),
      );
    });
  });
  return traces;
}

/** MultipleLines point estimates with nested 80/95/99% Wilson intervals. */
export function GradedErrorBarsChart() {
  const yValues = multipleLines.map((_, index) => index);
  const data = [
    ...nestedIntervalData(multipleLines, [99, 95, 80]),
    estimateTrace(multipleLines, yValues),
  ];
  const layout = mergeLayout({
    height: 400,
    margin: { l: 162, r: 74, t: 42, b: 58 },
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.18, traceorder: "reversed" },
    xaxis: {
      range: [0.18, 0.34],
      tickformat: ".0%",
      title: { text: "Tỷ lệ rời bỏ" },
      zeroline: false,
    },
    yaxis: {
      tickvals: yValues,
      ticktext: multipleLines.map((item) => item.label),
      autorange: "reversed",
      showgrid: false,
      zeroline: false,
      title: { text: "" },
    },
    shapes: yValues.map((y) => ({
      type: "line",
      x0: 0.18,
      x1: 0.34,
      y0: y,
      y1: y,
      line: { color: "#e3e6e8", width: 1 },
      layer: "below",
    })),
    uirevision: "graded-multiple-lines",
  });

  return (
    <div className="chart-block chart-graded-error-bars">
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      <p style={NOTE_STYLE}>
        Không có dịch vụ thoại: n={formatNumber(multipleLines[0].n)}, churn {formatPercent(
          multipleLines[0].rate,
        )}; một đường dây: n={formatNumber(multipleLines[1].n)}, {formatPercent(
          multipleLines[1].rate,
        )}; nhiều đường dây: n={formatNumber(multipleLines[2].n)}, {formatPercent(
          multipleLines[2].rate,
        )}. Nhóm nhỏ nhất có khoảng rộng nhất.
      </p>
    </div>
  );
}

/** Payment-method differences relative to Credit card (automatic). */
export function DifferenceIntervalChart() {
  const [confidence, setConfidence] = useState("all");
  const levels = confidence === "all" ? [99, 95, 80] : [Number(confidence)];
  const yValues = paymentDifferences.map((_, index) => index);
  const data = [
    ...nestedIntervalData(paymentDifferences, levels, { estimateKey: "diff" }),
    estimateTrace(
      paymentDifferences,
      yValues,
      "Chênh lệch ước lượng",
      COLORS.ink,
      "diff",
    ),
  ];
  const layout = mergeLayout({
    height: 420,
    margin: { l: 194, r: 34, t: 42, b: 62 },
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.18, traceorder: "reversed" },
    xaxis: {
      range: [-0.04, 0.36],
      tickformat: "+.0%",
      title: { text: `Chênh lệch so với ${paymentBase.label}` },
      zeroline: false,
    },
    yaxis: {
      tickvals: yValues,
      ticktext: paymentDifferences.map((item) => item.label),
      autorange: "reversed",
      showgrid: false,
      zeroline: false,
      title: { text: "" },
    },
    shapes: [
      ...yValues.map((y) => ({
        type: "line",
        x0: -0.04,
        x1: 0.36,
        y0: y,
        y1: y,
        line: { color: "#e3e6e8", width: 1 },
        layer: "below",
      })),
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: -0.5,
        y1: yValues.length - 0.5,
        line: { color: COLORS.ink, width: 1.5, dash: "dash" },
      },
    ],
    annotations: [
      {
        x: 0,
        y: 1.08,
        xref: "x",
        yref: "paper",
        text: "Không khác biệt",
        showarrow: false,
        font: { size: 10, color: COLORS.grayDark },
      },
    ],
    uirevision: `difference-${confidence}`,
  });

  return (
    <div className="chart-block chart-difference-intervals">
      <div style={CONTROL_STYLE} role="group" aria-label="Chọn mức tin cậy cho chênh lệch">
        <ChoiceButton active={confidence === "all"} onClick={() => setConfidence("all")}>
          Lồng 80 · 95 · 99%
        </ChoiceButton>
        {[80, 95, 99].map((level) => (
          <ChoiceButton
            key={level}
            active={confidence === String(level)}
            onClick={() => setConfidence(String(level))}
          >
            {level}% CI
          </ChoiceButton>
        ))}
      </div>
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      <p style={NOTE_STYLE} aria-live="polite">
        Nhóm chuẩn: {paymentBase.label}, churn {formatPercent(paymentBase.rate)}, n={formatNumber(
          paymentBase.n,
        )}. Ở mức 95%, chuyển khoản tự động có CI [−1,1%; +4,1%] cắt qua 0; hai
        chênh lệch còn lại không cắt qua 0.
      </p>
    </div>
  );
}

const ENCODING_TABS = [
  { id: "graded-cap", label: "Phân cấp + cap" },
  { id: "graded-no-cap", label: "Phân cấp không cap" },
  { id: "single-cap", label: "95% + cap" },
  { id: "single-no-cap", label: "80% không cap" },
  { id: "strip", label: "Confidence strip" },
  { id: "distribution", label: "Phân phối" },
];

function encodingData(variant) {
  const yValues = multipleLines.map((_, index) => index);
  if (variant === "graded-cap" || variant === "graded-no-cap") {
    return [
      ...nestedIntervalData(multipleLines, [99, 95, 80], {
        cap: variant === "graded-cap",
      }),
      estimateTrace(multipleLines, yValues, "Ước lượng", COLORS.gold),
    ];
  }
  if (variant === "single-cap" || variant === "single-no-cap") {
    const level = variant === "single-cap" ? 95 : 80;
    return [
      ...multipleLines.map((item, index) => {
        const [low, high] = item.intervals[level];
        return intervalTrace({
          low,
          high,
          estimate: item.rate,
          y: index,
          name: `${level}% CI`,
          color: COLORS.ink,
          width: 3,
          showlegend: index === 0,
          cap: variant === "single-cap",
          hoverLabel: item.label,
        });
      }),
      estimateTrace(multipleLines, yValues, "Ước lượng", COLORS.gold),
    ];
  }

  const xMin = 0.192;
  const xMax = 0.322;
  const xGrid = Array.from({ length: 145 }, (_, index) => xMin + ((xMax - xMin) * index) / 144);
  if (variant === "strip") {
    return [
      ...multipleLines.map((item, index) => {
        const standardDeviation =
          (item.intervals[95][1] - item.intervals[95][0]) / (2 * 1.96);
        const density = xGrid.map((x) =>
          Math.exp(-0.5 * ((x - item.rate) / standardDeviation) ** 2),
        );
        return {
          type: "scatter",
          mode: "markers",
          x: xGrid,
          y: xGrid.map(() => index),
          marker: {
            symbol: "square",
            size: 24,
            color: density,
            cmin: 0,
            cmax: 1,
            colorscale: [
              [0, "rgba(8,69,148,0.02)"],
              [0.35, "rgba(8,69,148,0.28)"],
              [1, "rgba(8,69,148,0.98)"],
            ],
            showscale: false,
            line: { width: 0 },
          },
          name: item.label,
          showlegend: false,
          hovertemplate: `${item.label}<br>Tỷ lệ: %{x:.1%}<br>Đậm tương đối: %{marker.color:.2f}<extra></extra>`,
        };
      }),
      ...multipleLines.map((item, index) => ({
        type: "scatter",
        mode: "lines",
        x: [item.rate, item.rate],
        y: [index - 0.24, index + 0.24],
        line: { color: COLORS.gold, width: 5 },
        name: index === 0 ? "Ước lượng" : "Ước lượng",
        showlegend: index === 0,
        hovertemplate: `${item.label}: ${formatPercent(item.rate)}<extra></extra>`,
      })),
    ];
  }

  return [
    ...multipleLines.map((item, index) => {
      const standardDeviation =
        (item.intervals[95][1] - item.intervals[95][0]) / (2 * 1.96);
      const density = xGrid.map((x) =>
        Math.exp(-0.5 * ((x - item.rate) / standardDeviation) ** 2),
      );
      const ridge = density.map((value) => index - value * 0.56);
      return {
        type: "scatter",
        mode: "lines",
        x: [...xGrid, ...xGrid.slice().reverse()],
        y: [...ridge, ...xGrid.map(() => index).reverse()],
        fill: "toself",
        fillcolor: "rgba(66,146,198,0.48)",
        line: { color: COLORS.ink, width: 1.5 },
        name: item.label,
        showlegend: false,
        hoverinfo: "skip",
      };
    }),
    ...multipleLines.map((item, index) => ({
      type: "scatter",
      mode: "lines",
      x: [item.rate, item.rate],
      y: [index - 0.46, index + 0.04],
      line: { color: COLORS.gold, width: 5 },
      name: "Ước lượng",
      showlegend: index === 0,
      hovertemplate: `${item.label}: ${formatPercent(item.rate)}<extra></extra>`,
    })),
  ];
}

/** Six encodings of the same MultipleLines uncertainty (Figure 16.9). */
export function EncodingVariantsChart() {
  const [variant, setVariant] = useState("graded-cap");
  const activeTab = ENCODING_TABS.find((tab) => tab.id === variant);
  const data = useMemo(() => encodingData(variant), [variant]);
  const yValues = multipleLines.map((_, index) => index);
  const layout = mergeLayout({
    height: 430,
    margin: { l: 162, r: 26, t: 42, b: 58 },
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.18, traceorder: "reversed" },
    xaxis: {
      range: [0.192, 0.322],
      tickformat: ".0%",
      title: { text: "Tỷ lệ rời bỏ" },
      zeroline: false,
    },
    yaxis: {
      tickvals: yValues,
      ticktext: multipleLines.map((item) => item.label),
      autorange: "reversed",
      showgrid: false,
      zeroline: false,
      title: { text: "" },
    },
    shapes: yValues.map((y) => ({
      type: "line",
      x0: 0.192,
      x1: 0.322,
      y0: y,
      y1: y,
      line: { color: "#e3e6e8", width: 1 },
      layer: "below",
    })),
    uirevision: `encoding-${variant}`,
  });

  return (
    <div className="chart-block chart-encoding-variants">
      <div style={CONTROL_STYLE} role="tablist" aria-label="Sáu cách mã hóa độ bất định">
        {ENCODING_TABS.map((tab) => (
          <ChoiceButton
            key={tab.id}
            id={`encoding-tab-${tab.id}`}
            role="tab"
            active={variant === tab.id}
            aria-controls="encoding-variant-panel"
            onClick={() => setVariant(tab.id)}
          >
            {tab.label}
          </ChoiceButton>
        ))}
      </div>
      <div
        id="encoding-variant-panel"
        role="tabpanel"
        aria-labelledby={`encoding-tab-${variant}`}
      >
        <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      </div>
      <p style={NOTE_STYLE} aria-live="polite">
        <b>{activeTab.label}.</b> Điểm ước lượng không đổi; chỉ cách mã hóa phân phối
        bootstrap thay đổi. Cap làm rõ điểm kết thúc, còn strip và phân phối nhấn mạnh tính
        liên tục nhưng khó đọc ngưỡng CI chính xác hơn.
      </p>
    </div>
  );
}

/** Contract churn rates as bars with 95% Wilson confidence intervals. */
export function ContractBarChart() {
  const data = [
    {
      type: "bar",
      x: contractRates.map((item) => item.label),
      y: contractRates.map((item) => item.rate),
      marker: {
        color: [COLORS.blueLight, COLORS.blueMid, COLORS.blue],
        line: { color: "#fff", width: 1 },
      },
      error_y: {
        type: "data",
        symmetric: false,
        array: contractRates.map((item) => item.ci[1] - item.rate),
        arrayminus: contractRates.map((item) => item.rate - item.ci[0]),
        color: COLORS.ink,
        thickness: 1.7,
        width: 7,
      },
      text: contractRates.map((item) => formatPercent(item.rate)),
      textposition: "outside",
      customdata: contractRates.map((item) => [item.n, item.ci[0], item.ci[1], item.fullLabel]),
      hovertemplate:
        "%{x} (%{customdata[3]})<br><b>%{y:.1%}</b><br>95% Wilson CI: [%{customdata[1]:.1%}; %{customdata[2]:.1%}]<br>n = %{customdata[0]:,}<extra></extra>",
      name: "Tỷ lệ rời bỏ",
    },
  ];
  const layout = mergeLayout({
    height: 410,
    margin: { l: 62, r: 24, t: 30, b: 70 },
    showlegend: false,
    bargap: 0.3,
    xaxis: { title: { text: "Loại hợp đồng" }, showgrid: false, zeroline: false },
    yaxis: {
      range: [0, 0.5],
      tickformat: ".0%",
      title: { text: "Tỷ lệ rời bỏ" },
      zeroline: true,
    },
    uirevision: "contract-bars",
  });

  return (
    <div className="chart-block chart-contract-bars">
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      <p style={NOTE_STYLE}>
        Chiều cao cột là ước lượng điểm; nét đen là 95% Wilson CI. Hình dạng cột không
        thay thế thông tin bất định, vì vậy mức và loại khoảng luôn được ghi rõ.
      </p>
    </div>
  );
}

/** Frequentist confidence intervals and Bayesian credible intervals side by side. */
export function BayesianComparisonChart() {
  const [view, setView] = useState("both");
  const yBase = bayesianPayments.map((_, index) => index);
  const priorMean =
    bayesianPayments.reduce(
      (sum, item) => sum + item.frequentist.estimate * item.n,
      0,
    ) / bayesianPayments.reduce((sum, item) => sum + item.n, 0);

  const approachTrace = (approach, offset, name, color) => {
    const values = bayesianPayments.map((item) => item[approach]);
    return {
      type: "scatter",
      mode: "markers",
      x: values.map((value) => value.estimate),
      y: yBase.map((y) => y + offset),
      marker: { color, size: 9, line: { color: "#fff", width: 1 } },
      error_x: {
        type: "data",
        symmetric: false,
        array: values.map((value) => value.interval[1] - value.estimate),
        arrayminus: values.map((value) => value.estimate - value.interval[0]),
        color,
        thickness: 2.2,
        width: 6,
      },
      name,
      customdata: bayesianPayments.map((item, index) => [
        item.label,
        item.n,
        values[index].interval[0],
        values[index].interval[1],
      ]),
      hovertemplate:
        "%{customdata[0]}<br><b>%{x:.1%}</b><br>95%: [%{customdata[2]:.1%}; %{customdata[3]:.1%}]<br>n = %{customdata[1]:,}<extra>%{fullData.name}</extra>",
    };
  };

  const data = [];
  if (view === "frequentist" || view === "both") {
    data.push(
      approachTrace(
        "frequentist",
        view === "both" ? -0.13 : 0,
        "Khoảng tin cậy 95%",
        COLORS.blue,
      ),
    );
  }
  if (view === "bayesian" || view === "both") {
    data.push(
      approachTrace(
        "bayesian",
        view === "both" ? 0.13 : 0,
        "Khoảng khả tín Bayes 95%",
        COLORS.grayDark,
      ),
    );
  }

  const layout = mergeLayout({
    height: 450,
    margin: { l: 194, r: 34, t: 44, b: 60 },
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.16 },
    xaxis: {
      range: [0.1, 0.5],
      tickformat: ".0%",
      title: { text: "Tỷ lệ rời bỏ" },
      zeroline: false,
    },
    yaxis: {
      tickvals: yBase,
      ticktext: bayesianPayments.map((item) => item.label),
      autorange: "reversed",
      showgrid: false,
      zeroline: false,
      title: { text: "" },
    },
    shapes: [
      ...yBase.map((y) => ({
        type: "line",
        x0: 0.1,
        x1: 0.5,
        y0: y,
        y1: y,
        line: { color: "#e3e6e8", width: 1 },
        layer: "below",
      })),
      {
        type: "line",
        x0: priorMean,
        x1: priorMean,
        y0: -0.55,
        y1: yBase.length - 0.45,
        line: { color: COLORS.ink, dash: "dash", width: 1.4 },
      },
    ],
    annotations: [
      {
        x: priorMean,
        y: 1.07,
        xref: "x",
        yref: "paper",
        text: `Prior mean ≈ ${formatPercent(priorMean)}`,
        showarrow: false,
        font: { size: 10, color: COLORS.grayDark },
      },
    ],
    uirevision: `bayesian-${view}`,
  });

  return (
    <div className="chart-block chart-bayesian-comparison">
      <div style={CONTROL_STYLE} role="group" aria-label="Chọn cách tiếp cận thống kê">
        <ChoiceButton active={view === "frequentist"} onClick={() => setView("frequentist")}>
          Tần suất
        </ChoiceButton>
        <ChoiceButton active={view === "bayesian"} onClick={() => setView("bayesian")}>
          Bayes
        </ChoiceButton>
        <ChoiceButton active={view === "both"} onClick={() => setView("both")}>
          So sánh cả hai
        </ChoiceButton>
      </div>
      <Plot data={data} layout={layout} config={plotConfig} useResizeHandler style={{ width: "100%" }} />
      <p style={NOTE_STYLE} aria-live="polite">
        Prior là churn chung xấp xỉ 26,6%, strength = 20. Vì các nhóm có cỡ mẫu lớn, CI tần suất
        và CrI Bayes gần nhau; ước lượng Bayes chỉ co nhẹ về prior.
      </p>
    </div>
  );
}

