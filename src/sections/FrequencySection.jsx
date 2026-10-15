import { BookSection, FigureCaption, Insight } from "../components/BookSection";
import ChartTabs from "../components/ChartTabs";
import TheoryDetails from "../components/TheoryDetails";
import {
  FrequencyFrameChart,
  QuantileDotPlot,
  SamplingDistributionChart,
} from "../charts/FrequencyCharts";

export default function FrequencySection() {
  const tabs = [
    {
      id: "tan-suat",
      index: "A",
      label: "100 khách hàng",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">TỪ XÁC SUẤT ĐẾN CON NGƯỜI</p>
            <h3>Nếu chọn ngẫu nhiên một khách hàng, ô nào sẽ được tô?</h3>
            <p>
              Một tỷ lệ đơn lẻ khá trừu tượng. Đặt nó vào 100 kết quả cụ thể giúp ta đồng thời nhìn thấy tần suất
              và sự khó đoán của từng trường hợp riêng lẻ.
            </p>
          </div>
          <div className="chart-shell"><FrequencyFrameChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.1">
            Mỗi ô là một khách hàng; ô xanh là khách đã rời dịch vụ. So sánh hợp đồng theo tháng với hợp đồng hai
            năm — đúng ví dụ trong notebook.
          </FigureCaption>
          <Insight>
            <p>
              <strong>43/100</strong> khách theo tháng rời dịch vụ, so với khoảng <strong>3/100</strong> khách ký hai
              năm. Cùng một xác suất, dạng tần suất tạo cảm giác cụ thể hơn một cột cao 42,7%.
            </p>
          </Insight>
          <TheoryDetails title="Vì sao các ô được xáo trộn?">
            <p>
              Nếu gom tất cả ô xanh về một phía, hình chỉ còn là một biểu đồ phần-trên-tổng. Việc xáo vị trí nhắc
              rằng ta biết tỷ lệ của cả nhóm nhưng không biết trước khách hàng cụ thể nào sẽ rời đi.
            </p>
          </TheoryDetails>
        </div>
      ),
    },
    {
      id: "quantile-dot",
      index: "B",
      label: "Quantile dot plot",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">RỜI RẠC HÓA MỘT PHÂN PHỐI</p>
            <h3>Hai mức độ chi tiết, cùng một phân phối.</h3>
            <p>
              Đúng như notebook, panel 10 chấm giúp đọc nhanh vì mỗi chấm mang khoảng 10% xác suất; panel 50 chấm
              cho thấy hình dạng phân phối chi tiết hơn với khoảng 2% xác suất mỗi chấm.
            </p>
          </div>
          <div className="chart-shell"><QuantileDotPlot /></div>
          <FigureCaption figure="Hình chuyển thể 16.3">
            Phân phối bootstrap của chênh lệch tỷ lệ churn Nữ − Nam, hiển thị đồng thời bằng 10 và 50 chấm đại diện
            như cell 11 của notebook.
          </FigureCaption>
          <Insight>
            <p>
              Ước lượng tốt nhất chỉ là <strong>+0,8 điểm phần trăm</strong>; khoảng 95% đi qua 0. Các kết quả khả dĩ
              vẫn xuất hiện ở cả hai phía, nên khác biệt giới tính chưa rõ ràng.
            </p>
          </Insight>
        </div>
      ),
    },
    {
      id: "sampling-distribution",
      index: "C",
      label: "Phân phối kết quả",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">KHÔNG CHỈ MỘT ƯỚC LƯỢNG</p>
            <h3>Tô toàn bộ miền kết quả để nhìn thấy độ bất định.</h3>
            <p>
              Đường mật độ dùng lại profile 10 chấm trong notebook. Phần bên trái mốc 0 biểu diễn các kết quả Nam
              cao hơn; phần bên phải biểu diễn các kết quả Nữ cao hơn.
            </p>
          </div>
          <div className="chart-shell"><SamplingDistributionChart /></div>
          <FigureCaption figure="Chuyển thể cell 13">
            Mật độ hai màu, đường ước lượng và khoảng bootstrap 95% được dựng lại trực tiếp theo notebook; các thông
            số chính luôn hiện trong khung thay vì chỉ phụ thuộc vào hover.
          </FigureCaption>
          <Insight>
            <p>
              Đường 0 nằm trong vùng phân phối đậm nhất. Một con số dương trong mẫu hiện tại không đủ để loại bỏ
              những kết quả âm hợp lý trong các mẫu khác.
            </p>
          </Insight>
        </div>
      ),
    },
  ];

  return (
    <BookSection
      id="tan-suat"
      number="01"
      title="Diễn đạt xác suất dưới dạng tần suất"
      figureRange="Hình 16.1–16.3"
      description="Xác suất trở nên dễ hiểu hơn khi được chuyển thành những kết quả rời rạc mà ta có thể đếm. Đây là điểm khởi đầu trực giác trước khi đi vào error bar và dải tin cậy."
    >
      <ChartTabs tabs={tabs} ariaLabel="Các cách diễn đạt xác suất" />
    </BookSection>
  );
}
