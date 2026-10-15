export const COLORS = {
  ink: "#17222f",
  blue: "#084594",
  blueMid: "#4292c6",
  blueLight: "#9ecae1",
  bluePale: "#deebf7",
  blueMist: "#eff6fb",
  gray: "#aeb5bd",
  grayDark: "#66717d",
  paper: "#fbfaf6",
  red: "#a33a43",
  gold: "#bd7b22",
};

export const frequencyGroups = {
  "Month-to-month": { rate: 0.427, count: 43, n: 3875 },
  "Two year": { rate: 0.0285, count: 3, n: 1685 },
};

export const genderDifference = {
  female: 0.27,
  male: 0.262,
  estimate: 0.008,
  low95: -0.013,
  high95: 0.029,
  femaleHigher: 0.769,
  maleHigher: 0.231,
};

export const monthlyCharges = {
  n: 48,
  mean: 86.78,
  sd: 28.92,
  se: 4.17,
  intervals: {
    80: [81.35, 92.2],
    95: [78.38, 95.17],
    99: [75.57, 97.98],
  },
};

export const multipleLines = [
  {
    key: "No phone service",
    label: "Không có dịch vụ thoại",
    n: 680,
    rate: 0.25,
    intervals: { 80: [0.228, 0.271], 95: [0.218, 0.282], 99: [0.207, 0.293] },
  },
  {
    key: "No",
    label: "Một đường dây",
    n: 3385,
    rate: 0.251,
    intervals: { 80: [0.241, 0.26], 95: [0.236, 0.265], 99: [0.231, 0.269] },
  },
  {
    key: "Yes",
    label: "Nhiều đường dây",
    n: 2967,
    rate: 0.286,
    intervals: { 80: [0.276, 0.297], 95: [0.27, 0.303], 99: [0.265, 0.308] },
  },
];

export const paymentDifferences = [
  {
    label: "Chuyển khoản tự động",
    fullLabel: "Bank transfer (automatic)",
    n: 1542,
    rate: 0.167,
    diff: 0.015,
    intervals: { 80: [-0.002, 0.032], 95: [-0.011, 0.041], 99: [-0.02, 0.05] },
  },
  {
    label: "Séc qua bưu điện",
    fullLabel: "Mailed check",
    n: 1604,
    rate: 0.192,
    diff: 0.039,
    intervals: { 80: [0.022, 0.056], 95: [0.013, 0.066], 99: [0.004, 0.074] },
  },
  {
    label: "Séc điện tử",
    fullLabel: "Electronic check",
    n: 2365,
    rate: 0.453,
    diff: 0.3,
    intervals: { 80: [0.282, 0.318], 95: [0.273, 0.328], 99: [0.264, 0.337] },
  },
];

export const paymentBase = {
  label: "Thẻ tín dụng tự động",
  fullLabel: "Credit card (automatic)",
  n: 1521,
  rate: 0.153,
};

export const contractRates = [
  { label: "Theo tháng", fullLabel: "Month-to-month", n: 3875, rate: 0.4271, ci: [0.4116, 0.4427] },
  { label: "Một năm", fullLabel: "One year", n: 1472, rate: 0.1128, ci: [0.0976, 0.13] },
  { label: "Hai năm", fullLabel: "Two year", n: 1685, rate: 0.0285, ci: [0.0216, 0.0376] },
];

export const bayesianPayments = [
  {
    label: "Chuyển khoản tự động",
    frequentist: { estimate: 0.167, interval: [0.15, 0.187] },
    bayesian: { estimate: 0.169, interval: [0.15, 0.188] },
    n: 1542,
  },
  {
    label: "Thẻ tín dụng tự động",
    frequentist: { estimate: 0.153, interval: [0.135, 0.171] },
    bayesian: { estimate: 0.154, interval: [0.136, 0.172] },
    n: 1521,
  },
  {
    label: "Séc qua bưu điện",
    frequentist: { estimate: 0.192, interval: [0.173, 0.212] },
    bayesian: { estimate: 0.193, interval: [0.174, 0.212] },
    n: 1604,
  },
  {
    label: "Séc điện tử",
    frequentist: { estimate: 0.453, interval: [0.433, 0.473] },
    bayesian: { estimate: 0.451, interval: [0.431, 0.471] },
    n: 2365,
  },
];

export const tenureBins = [
  { label: "1–6", n: 1470, churned: 784, rate: 0.533333, x: 2.529252 },
  { label: "7–12", n: 705, churned: 253, rate: 0.358865, x: 9.397163 },
  { label: "13–24", n: 1024, churned: 294, rate: 0.287109, x: 18.351562 },
  { label: "25–36", n: 832, churned: 180, rate: 0.216346, x: 30.338942 },
  { label: "37–48", n: 762, churned: 145, rate: 0.190289, x: 42.581365 },
  { label: "49–60", n: 832, churned: 120, rate: 0.144231, x: 54.489183 },
  { label: "61–72", n: 1407, churned: 93, rate: 0.066098, x: 68.110163 },
];

export const shortlist = [
  { contract: "Theo tháng", payment: "Séc điện tử", n: 1850, rate: 0.537, ci: [0.515, 0.56], monthly: 74.99, risk: 74540 },
  { contract: "Theo tháng", payment: "Chuyển khoản tự động", n: 589, rate: 0.341, ci: [0.304, 0.38], monthly: 69.09, risk: 13886 },
  { contract: "Theo tháng", payment: "Thẻ tín dụng tự động", n: 543, rate: 0.328, ci: [0.29, 0.368], monthly: 67.68, risk: 12047 },
  { contract: "Theo tháng", payment: "Séc qua bưu điện", n: 893, rate: 0.316, ci: [0.286, 0.347], monthly: 46.05, risk: 12986 },
  { contract: "Một năm", payment: "Séc điện tử", n: 347, rate: 0.184, ci: [0.147, 0.229], monthly: 79.1, risk: 5062 },
];

export const formatPercent = (value, digits = 1) =>
  new Intl.NumberFormat("vi-VN", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatNumber = (value, digits = 0) =>
  new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
