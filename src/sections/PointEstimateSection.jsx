import { BookSection, FigureCaption, Insight } from "../components/BookSection";
import ChartTabs from "../components/ChartTabs";
import TheoryDetails from "../components/TheoryDetails";
import {
  BayesianComparisonChart,
  ContractBarChart,
  DifferenceIntervalChart,
  EncodingVariantsChart,
  GradedErrorBarsChart,
  UncertaintyIntervalsChart,
} from "../charts/PointEstimateCharts";

export default function PointEstimateSection() {
  const tabs = [
    {
      id: "sd-se-ci",
      index: "A",
      label: "SD · SE · CI",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">NĂM KHOẢNG · NĂM Ý NGHĨA</p>
            <h3>Độ phân tán của khách hàng không phải độ bất định của trung bình.</h3>
            <p>
              SD mô tả các quan sát khác nhau đến đâu. SE và khoảng tin cậy mô tả ta đã xác định trung bình chính
              xác đến đâu; cỡ mẫu lớn hơn thường làm các khoảng này hẹp lại.
            </p>
          </div>
          <div className="chart-shell"><UncertaintyIntervalsChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.5">
            MonthlyCharges của 48 khách đã churn và có hợp đồng hai năm: mean 86,78; SD 28,92; SE 4,17.
          </FigureCaption>
          <Insight>
            <p>
              Cá nhân phân tán khá rộng, nhưng trung bình được ước lượng hẹp hơn nhiều. Khi tăng mức tin cậy từ 80%
              lên 99%, khoảng phải rộng ra để đạt coverage cao hơn.
            </p>
          </Insight>
          <TheoryDetails title="Cách đọc khoảng tin cậy đúng">
            <p>
              Với một khoảng 95% đã quan sát, không nói “tham số thật có 95% xác suất nằm trong khoảng”. Cách tiếp
              cận tần suất là: nếu lặp quy trình lấy mẫu rất nhiều lần, khoảng được dựng theo cùng cách sẽ bao phủ
              tham số thật khoảng 95% số lần.
            </p>
          </TheoryDetails>
        </div>
      ),
    },
    {
      id: "graded-bars",
      index: "B",
      label: "Graded bars",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">NHIỀU MỨC CHẮC CHẮN CÙNG LÚC</p>
            <h3>Đường đậm ở giữa, đường nhạt mở rộng ra ngoài.</h3>
            <p>
              Graded error bars chồng các mức 80%, 95% và 99%. Chúng tránh tạo cảm giác hai đầu error bar là giới
              hạn tuyệt đối của mọi giá trị có thể.
            </p>
          </div>
          <div className="chart-shell"><GradedErrorBarsChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.6–16.7">
            Tỷ lệ churn theo số đường dây điện thoại; nhóm nhỏ hơn có khoảng rộng hơn dù point estimate tương tự.
          </FigureCaption>
          <Insight>
            <p>
              Nhóm không có dịch vụ thoại chỉ có <strong>n=680</strong>, nên khoảng rộng hơn rõ rệt so với nhóm một
              đường dây có <strong>n=3.385</strong>.
            </p>
          </Insight>
        </div>
      ),
    },
    {
      id: "difference-ci",
      index: "C",
      label: "CI chênh lệch",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">SO SÁNH TRỰC TIẾP VỚI 0</p>
            <h3>Đừng đoán khác biệt từ hai error bars riêng lẻ.</h3>
            <p>
              Khi câu hỏi là “hai nhóm có khác nhau không?”, đại lượng cần vẽ là chính chênh lệch giữa hai nhóm.
              Mốc 0 trở thành đường tham chiếu rõ ràng.
            </p>
          </div>
          <div className="chart-shell"><DifferenceIntervalChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.8">
            Chênh lệch churn của ba phương thức thanh toán so với thẻ tín dụng tự động; khoảng lấy từ bootstrap.
          </FigureCaption>
          <Insight>
            <p>
              Chuyển khoản tự động chỉ cao hơn <strong>1,5 điểm</strong> và CI 95% cắt qua 0. Séc điện tử cao hơn
              khoảng <strong>30 điểm</strong>, với toàn bộ khoảng nằm bên phải 0.
            </p>
          </Insight>
        </div>
      ),
    },
    {
      id: "encoding-variants",
      index: "D",
      label: "Cách biểu diễn",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">CÙNG DỮ LIỆU · KHÁC CÁCH ĐỌC</p>
            <h3>Cap, độ dày, dải mờ hay cả phân phối?</h3>
            <p>
              Mỗi encoding đánh đổi giữa độ gọn, độ chính xác và khả năng gợi cảm giác bất định. Hãy đổi kiểu hiển
              thị mà không đổi point estimate để quan sát sự khác biệt.
            </p>
          </div>
          <div className="chart-shell"><EncodingVariantsChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.9">
            Sáu cách biểu diễn cùng bootstrap distribution của ba nhóm MultipleLines.
          </FigureCaption>
          <Insight>
            <p>
              Error bars cho ranh giới mức tin cậy dễ đọc; confidence strip và distribution cho thấy hình dạng liên
              tục tốt hơn nhưng khó suy ra chính xác một ngưỡng 95% bằng mắt.
            </p>
          </Insight>
          <div className="subfigure-divider" />
          <div className="lesson-intro compact">
            <p className="lesson-tag">KHI ERROR BAR ĐI CÙNG BIỂU ĐỒ CỘT</p>
            <h3>Chiều cao cột không thay thế thông tin bất định.</h3>
          </div>
          <div className="chart-shell compact-chart"><ContractBarChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.10">
            Tỷ lệ churn theo loại hợp đồng; error bars là 95% Wilson CI và được ghi rõ thay vì để người xem đoán.
          </FigureCaption>
        </div>
      ),
    },
    {
      id: "frequentist-bayesian",
      index: "E",
      label: "CI ↔ CrI",
      content: (
        <div className="lesson-panel">
          <div className="lesson-intro">
            <p className="lesson-tag">HAI CÁCH SUY LUẬN</p>
            <h3>Khoảng có hình thức giống nhau nhưng phát biểu khác nhau.</h3>
            <p>
              Frequentist CI được hiểu qua repeated sampling. Bayesian credible interval mô tả nơi tham số được kỳ
              vọng nằm dựa trên dữ liệu và prior.
            </p>
          </div>
          <div className="chart-shell"><BayesianComparisonChart /></div>
          <FigureCaption figure="Hình chuyển thể 16.13">
            Bốn phương thức thanh toán; prior đặt tại churn toàn mẫu 26,6% với strength 20, đúng phần code đã chạy
            trong notebook.
          </FigureCaption>
          <Insight>
            <p>
              Các nhóm đều lớn nên hai kết quả gần nhau. Bayesian estimate dịch nhẹ về trung bình chung — hiệu ứng
              <em> shrinkage</em> — nhưng dữ liệu vẫn chi phối.
            </p>
          </Insight>
          <TheoryDetails title="Một khác biệt nhỏ trong notebook">
            <p>
              Phần mô tả notebook ghi prior Beta(1,1), nhưng cell thực thi lại dùng prior thực nghiệm có trung bình
              bằng churn toàn mẫu và strength 20. Bản tương tác theo cell đã chạy vì đó là nguồn của các con số đang
              hiển thị.
            </p>
          </TheoryDetails>
        </div>
      ),
    },
  ];

  return (
    <BookSection
      id="uoc-luong-diem"
      number="02"
      title="Độ bất định của ước lượng điểm"
      figureRange="Hình 16.5–16.13"
      description="Một point estimate là phỏng đoán tốt nhất từ mẫu, không phải giá trị thật được biết chắc. Error bars giúp đặt phỏng đoán ấy vào một phạm vi — nhưng chỉ hữu ích khi ta ghi rõ chúng biểu diễn đại lượng nào."
    >
      <ChartTabs tabs={tabs} ariaLabel="Các cách trực quan hóa ước lượng điểm" />
    </BookSection>
  );
}
