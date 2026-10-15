import { BookSection, FigureCaption, Insight } from "../components/BookSection";
import TheoryDetails from "../components/TheoryDetails";
import { HopChart } from "../charts/HopChart";

export default function HopSection() {
  return (
    <BookSection
      id="hop"
      number="04"
      title="Biểu đồ kết quả giả định (HOP)"
      figureRange="Hình 16.19–16.22"
      description="Static intervals rất dễ bị hiểu như min/max hoặc ranh giới đúng–sai. HOP thay chúng bằng một chuỗi kết quả có xác suất tương đương, mỗi lần chỉ cho thấy một khả năng."
    >
      <div className="hop-reading-guide" aria-label="Ba bước đọc HOP">
        <div><span>01</span><p>Nhìn một đường, không nhìn một dải.</p></div>
        <div><span>02</span><p>Ghi nhận hình dạng đổi qua từng khung.</p></div>
        <div><span>03</span><p>Cảm nhận phần nào ổn định, phần nào dao động.</p></div>
      </div>

      <div className="lesson-panel hop-panel">
        <div className="lesson-intro">
          <p className="lesson-tag">20 KỊCH BẢN · CÙNG MỘT DỮ LIỆU</p>
          <h3>Đừng kéo đường này thành đường kia. Hãy thay cả kết quả.</h3>
          <p>
            Chương gốc cảnh báo rằng morphing chậm có thể khiến người xem khó phán đoán xác suất. Trình phát này
            dùng cắt cảnh hoặc mờ nhanh, đồng thời cho phép dừng và bước từng khung.
          </p>
        </div>
        <div className="chart-shell hop-shell"><HopChart /></div>
        <FigureCaption figure="Hình chuyển thể 16.19–16.22">
          Hai mươi đường cong tenure–churn khả dĩ. Điểm đen giữ nguyên; chỉ kết quả giả định thay đổi theo thời gian.
        </FigureCaption>
        <Insight>
          <p>
            Phần giảm mạnh ở tenure thấp xuất hiện khá bền, nhưng độ uốn và mức churn ở từng vị trí vẫn thay đổi.
            HOP làm rõ: không có một đường “thật” duy nhất được dữ liệu xác định hoàn toàn.
          </p>
        </Insight>
        <TheoryDetails title="Điều kiện để một HOP không gây hiểu lầm">
          <p>
            Các khung được chiếu phải đại diện đúng cho phân phối kết quả khả dĩ. Quá ít khung hoặc chọn khung thiên
            lệch có thể phóng đại một câu chuyện hiếm. Vì vậy app giữ seed cố định, đủ 20 khung như notebook và cho
            phép người đọc xem lại từng khung.
          </p>
        </TheoryDetails>
      </div>
    </BookSection>
  );
}
