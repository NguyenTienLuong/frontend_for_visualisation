import { BookSection, FigureCaption, Insight } from "../components/BookSection";
import TheoryDetails from "../components/TheoryDetails";
import { TrendExplorer } from "../charts/TrendCharts";

export default function TrendSection() {
  return (
    <BookSection
      id="duong-xu-huong"
      number="03"
      title="Độ bất định của đường xu hướng"
      figureRange="Hình 16.15–16.18"
      description="Một đường khớp là cả một chuỗi ước lượng liên kết với nhau. Dải tin cậy, các đường fit thay thế và dải phân cấp là ba cửa sổ khác nhau nhìn vào cùng một họ xu hướng hợp lý."
    >
      <div className="lesson-panel">
        <div className="lesson-intro">
          <p className="lesson-tag">TỪ MỘT ĐƯỜNG ĐẾN MỘT HỌ ĐƯỜNG</p>
          <h3>Xu hướng tốt nhất chỉ là một thành viên trong nhiều xu hướng khả dĩ.</h3>
          <p>
            Dữ liệu được gom thành bảy khoảng tenure như notebook. Chuyển giữa bốn cách biểu diễn để xem dải màu
            được hình thành từ những đường cụ thể ra sao — và vì sao phi tuyến còn thêm bất định về hình dạng.
          </p>
        </div>
        <div className="chart-shell trend-shell"><TrendExplorer /></div>
        <FigureCaption figure="Hình chuyển thể 16.15–16.18">
          Tỷ lệ churn theo tenure bin; các đường bootstrap minh họa dùng seed cố định để có kết quả ổn định giữa
          các lần tải trang.
        </FigureCaption>
        <Insight>
          <p>
            Độ dốc tuyến tính khoảng <strong>−0,006 mỗi tháng</strong>: tenure cao đi cùng churn thấp hơn trong mẫu.
            Dải nở và co theo vị trí vì cả intercept lẫn slope đều không được biết chắc.
          </p>
        </Insight>
        <TheoryDetails title="Vì sao dải quanh đường thẳng lại cong?">
          <p>
            Mỗi đường thay thế vẫn thẳng, nhưng có thể vừa dịch lên/xuống vừa xoay do slope khác nhau. Bao ngoài
            cả họ đường tạo thành một dải có mép cong. Với fit phi tuyến, các đường còn thay đổi độ uốn, nên bất
            định không chỉ là “đường trung tâm ± một lượng cố định”.
          </p>
        </TheoryDetails>
      </div>
    </BookSection>
  );
}
