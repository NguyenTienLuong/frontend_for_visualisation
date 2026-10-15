import { BookSection } from "../components/BookSection";

function UncertaintySketch() {
  return (
    <div className="uncertainty-sketch" aria-label="Một ước lượng điểm và nhiều kết quả khả dĩ">
      <div className="sketch-axis" />
      <div className="sketch-band band-99" />
      <div className="sketch-band band-95" />
      <div className="sketch-band band-80" />
      <div className="sketch-point" />
      <span className="sketch-label sketch-label-left">có thể</span>
      <span className="sketch-label sketch-label-center">ước lượng</span>
      <span className="sketch-label sketch-label-right">có thể</span>
    </div>
  );
}

export default function IntroductionSection() {
  return (
    <BookSection id="mo-dau" number="00" className="hero-section" eyebrow="Chương 16 · Bản tương tác">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="hero-overline">FUNDAMENTALS OF DATA VISUALIZATION</p>
          <h1>
            Trực quan hóa
            <em>sự bất định</em>
          </h1>
          <p className="hero-lede">
            Một điểm dữ liệu được vẽ ở vị trí rất cụ thể thường tạo cảm giác chắc chắn hơn mức dữ liệu thật sự
            cho phép. Chương này biến phần “chưa biết” ấy thành thứ có thể nhìn thấy, so sánh và diễn giải.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-action"
              onClick={() => document.getElementById("tan-suat")?.scrollIntoView({ behavior: "smooth" })}
            >
              Bắt đầu đọc <span aria-hidden="true">↓</span>
            </button>
            <a
              className="text-action"
              href="https://clauswilke.com/dataviz/visualizing-uncertainty.html"
              target="_blank"
              rel="noreferrer"
            >
              Xem chương gốc <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <p>MỘT CON SỐ KHÔNG PHẢI LÀ TOÀN BỘ CÂU CHUYỆN</p>
          <UncertaintySketch />
          <div className="hero-visual-note">
            <span>95%</span>
            <p>
              Khoảng không phải là hàng rào cứng. Nó là một cách tóm tắt điều nhiều lần lấy mẫu có thể cho ta
              thấy.
            </p>
          </div>
        </div>
      </div>

      <div className="chapter-premise">
        <p className="premise-index">LUẬN ĐIỂM CỦA CHƯƠNG</p>
        <blockquote>
          Gần như mọi bộ dữ liệu đều chứa bất định. Việc có biểu diễn nó hay không — và biểu diễn bằng cách nào —
          làm thay đổi đáng kể điều người xem hiểu từ dữ liệu.
        </blockquote>
        <div className="strategy-pair">
          <div>
            <span className="strategy-symbol precision" aria-hidden="true">⊢</span>
            <p className="strategy-name">Chính xác · gọn</p>
            <p>Error bars và confidence bands phù hợp khi cần nhiều thông tin trong ít không gian.</p>
          </div>
          <div>
            <span className="strategy-symbol intuition" aria-hidden="true">∴</span>
            <p className="strategy-name">Trực giác · dễ cảm</p>
            <p>Frequency framing và HOP giúp người xem “cảm” các kết quả khả dĩ rõ hơn.</p>
          </div>
        </div>
      </div>

      <div className="dataset-strip" aria-label="Thông tin về dữ liệu minh họa">
        <div><strong>7.043</strong><span>khách hàng gốc</span></div>
        <div><strong>4</strong><span>phần kiến thức</span></div>
        <div><strong>14</strong><span>biểu đồ từ notebook</span></div>
        <p>
          <span>Dữ liệu chỉ là vai phụ.</span> Telco Churn được giữ nguyên như notebook để minh họa cách biểu diễn,
          không phải để biến chương sách thành dashboard kinh doanh.
        </p>
      </div>
    </BookSection>
  );
}
