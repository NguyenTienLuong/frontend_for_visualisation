export const sections = [
  {
    id: "mo-dau",
    number: "00",
    shortTitle: "Mở đầu",
    title: "Nhìn thấy điều ta chưa biết",
  },
  {
    id: "tan-suat",
    number: "01",
    shortTitle: "Xác suất như tần suất",
    title: "Diễn đạt xác suất dưới dạng tần suất",
    figureRange: "Hình 16.1–16.3",
    children: [
      { id: "tan-suat", title: "100 khách hàng" },
      { id: "quantile-dot", title: "Quantile dot plot" },
      { id: "sampling-distribution", title: "Phân phối kết quả" },
    ],
  },
  {
    id: "uoc-luong-diem",
    number: "02",
    shortTitle: "Ước lượng điểm",
    title: "Độ bất định của ước lượng điểm",
    figureRange: "Hình 16.5–16.13",
    children: [
      { id: "sd-se-ci", title: "SD, SE và CI" },
      { id: "graded-bars", title: "Graded error bars" },
      { id: "difference-ci", title: "CI của chênh lệch" },
      { id: "encoding-variants", title: "Sáu cách biểu diễn" },
      { id: "frequentist-bayesian", title: "CI và khoảng khả tín" },
    ],
  },
  {
    id: "duong-xu-huong",
    number: "03",
    shortTitle: "Đường xu hướng",
    title: "Độ bất định của đường xu hướng",
    figureRange: "Hình 16.15–16.18",
    children: [
      { id: "confidence-band", title: "Dải tin cậy" },
      { id: "alternative-lines", title: "Các đường khả dĩ" },
      { id: "graded-bands", title: "Dải phân cấp" },
      { id: "nonlinear-fit", title: "Xu hướng phi tuyến" },
    ],
  },
  {
    id: "hop",
    number: "04",
    shortTitle: "Kết quả giả định",
    title: "Biểu đồ kết quả giả định (HOP)",
    figureRange: "Hình 16.19–16.22",
  },
  {
    id: "ket-luan",
    number: "05",
    shortTitle: "Kết luận",
    title: "Từ bất định đến quyết định thận trọng",
  },
];

export const flatSectionIds = sections.map((section) => section.id);
