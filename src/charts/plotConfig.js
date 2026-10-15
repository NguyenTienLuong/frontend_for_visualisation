import { COLORS } from "../data/telco";

export const plotConfig = {
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
  toImageButtonOptions: {
    format: "png",
    filename: "truc-quan-hoa-bat-dinh",
    scale: 2,
  },
};

export const baseFont = {
  family: '"IBM Plex Sans", "Segoe UI", sans-serif',
  color: COLORS.ink,
  size: 13,
};

export const baseLayout = {
  autosize: true,
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: baseFont,
  margin: { l: 58, r: 28, t: 54, b: 54 },
  hoverlabel: {
    bgcolor: "#ffffff",
    bordercolor: "#d8dde3",
    font: { color: COLORS.ink, size: 12 },
  },
  xaxis: {
    gridcolor: "#e4e7e9",
    zerolinecolor: "#7d8790",
    tickfont: { color: COLORS.grayDark },
    title: { standoff: 14 },
  },
  yaxis: {
    gridcolor: "#e4e7e9",
    zerolinecolor: "#7d8790",
    tickfont: { color: COLORS.grayDark },
    title: { standoff: 12 },
  },
};

export const mergeLayout = (overrides = {}) => ({
  ...baseLayout,
  ...overrides,
  xaxis: { ...baseLayout.xaxis, ...(overrides.xaxis || {}) },
  yaxis: { ...baseLayout.yaxis, ...(overrides.yaxis || {}) },
});
