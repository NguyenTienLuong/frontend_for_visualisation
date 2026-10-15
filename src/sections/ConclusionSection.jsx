import { BookSection, Insight } from "../components/BookSection";
import { formatNumber, formatPercent, shortlist } from "../data/telco";

export default function ConclusionSection() {
  return (
    <BookSection
      id="ket-luan"
      number="05"
      title="Từ bất định đến quyết định thận trọng"
      eyebrow="Kết luận từ ví dụ Telco"
      description="Độ bất định không ngăn ta hành động. Nó buộc ta phân biệt điều dữ liệu đang gợi ý với điều dữ liệu chưa thể chứng minh."
    >
      <div className="conclusion-grid">
        <div className="takeaway-list">
          <article><span>01</span><p>Luôn đọc <strong>ước lượng cùng khoảng</strong>, không xếp hạng chỉ từ point estimate.</p></article>
          <article><span>02</span><p>Khi so hai nhóm, hãy vẽ <strong>CI của chênh lệch</strong> và đặt cạnh mốc 0.</p></article>
          <article><span>03</span><p>Đường xu hướng cũng chỉ là ước lượng; band và HOP cho thấy nhiều đường vẫn hợp lý.</p></article>
          <article><span>04</span><p>Liên hệ trong dữ liệu quan sát <strong>không phải bằng chứng nhân quả</strong>.</p></article>
        </div>
        <div className="closing-statement">
          <span>NGUYÊN TẮC CUỐI</span>
          <p>Không che đi điều ta chưa biết. Hãy cho người xem đủ cấu trúc để họ tự nhìn thấy nó.</p>
        </div>
      </div>

      <div className="shortlist-block">
        <div className="shortlist-heading">
          <div>
            <p className="lesson-tag">MỘT VÍ DỤ RA QUYẾT ĐỊNH</p>
            <h3>Nhóm nào đáng được kiểm tra trước?</h3>
          </div>
          <p>Xếp theo cận dưới Wilson 95%; chỉ giữ nhóm có ít nhất 100 khách.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Hợp đồng</th><th>Thanh toán</th><th>n</th><th>Churn</th><th>95% CI</th><th>Proxy rủi ro/tháng</th></tr></thead>
            <tbody>
              {shortlist.map((row, index) => (
                <tr key={`${row.contract}-${row.payment}`} className={index === 0 ? "priority-row" : ""}>
                  <td>{row.contract}</td><td>{row.payment}</td><td>{formatNumber(row.n)}</td>
                  <td>{formatPercent(row.rate)}</td>
                  <td>{formatPercent(row.ci[0])}–{formatPercent(row.ci[1])}</td>
                  <td>{formatNumber(row.risk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Insight label="Kết luận mô tả — không phải khuyến nghị tự động" tone="paper">
          <p>
            <strong>Theo tháng + séc điện tử</strong> nổi bật với n=1.850, churn 53,7% và CI 95% [51,5%; 56,0%].
            Đây là ưu tiên để <em>kiểm tra</em>; quyết định giữ chân còn cần CLV, chi phí ưu đãi và kiểm định nhân quả.
          </p>
        </Insight>
      </div>

      <footer className="source-footer">
        <div><span>01</span><a href="https://clauswilke.com/dataviz/visualizing-uncertainty.html" target="_blank" rel="noreferrer">Claus O. Wilke · Chapter 16</a></div>
        <div><span>02</span><a href="https://www.kaggle.com/datasets/blastchar/telco-customer-churn" target="_blank" rel="noreferrer">IBM Telco Customer Churn</a></div>
        <p>Chuyển thể tương tác từ notebook đính kèm · React + Plotly.js</p>
      </footer>
    </BookSection>
  );
}
