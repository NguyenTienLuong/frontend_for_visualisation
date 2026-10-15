export function BookSection({
  id,
  number,
  eyebrow = "Chương 16",
  title,
  description,
  figureRange,
  children,
  className = "",
}) {
  return (
    <section id={id} className={`book-section ${className}`.trim()} data-section={id}>
      <header className="section-heading">
        <div className="section-number" aria-hidden="true">
          {number}
        </div>
        <div className="section-heading-copy">
          <div className="section-meta">
            <span>{eyebrow}</span>
            {figureRange ? <span>{figureRange}</span> : null}
          </div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function Insight({ label = "Điều cần đọc từ hình", children, tone = "blue" }) {
  return (
    <aside className={`insight insight-${tone}`}>
      <span className="insight-mark" aria-hidden="true">
        ↳
      </span>
      <div>
        <p className="insight-label">{label}</p>
        <div className="insight-copy">{children}</div>
      </div>
    </aside>
  );
}

export function FigureCaption({ figure, children }) {
  return (
    <div className="figure-caption">
      <span>{figure}</span>
      <p>{children}</p>
    </div>
  );
}
