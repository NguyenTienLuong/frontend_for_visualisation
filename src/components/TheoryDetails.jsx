export default function TheoryDetails({ title = "Đọc thêm lý thuyết", children }) {
  return (
    <details className="theory-details">
      <summary>
        <span>{title}</span>
        <span className="details-icon" aria-hidden="true" />
      </summary>
      <div className="theory-content">{children}</div>
    </details>
  );
}
