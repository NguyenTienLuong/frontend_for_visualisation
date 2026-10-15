function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z" />
      <path d="M4 18.5A3.5 3.5 0 0 1 7.5 15H20" />
      <path d="M8 6h7M8 9h5" />
    </svg>
  );
}

export default function Sidebar({ sections, activeId, onNavigate, progress, mobileOpen, onClose }) {
  return (
    <>
      <button
        type="button"
        className={`sidebar-scrim ${mobileOpen ? "visible" : ""}`}
        aria-label="Đóng mục lục"
        onClick={onClose}
      />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Mục lục chương">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <BookIcon />
          </div>
          <div>
            <p>DATA VISUALIZATION</p>
            <strong>Uncertainty</strong>
          </div>
          <button type="button" className="sidebar-close" aria-label="Đóng mục lục" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="reading-progress" aria-label={`Đã đọc ${Math.round(progress)}%`}>
          <div style={{ width: `${progress}%` }} />
        </div>

        <p className="sidebar-kicker">MỤC LỤC · CHƯƠNG 16</p>
        <nav>
          {sections.map((section) => {
            const active = section.id === activeId;
            return (
              <div className={`toc-group ${active ? "active" : ""}`} key={section.id}>
                <button type="button" onClick={() => onNavigate(section.id)}>
                  <span className="toc-number">{section.number}</span>
                  <span className="toc-title">{section.shortTitle}</span>
                  <span className="toc-dot" aria-hidden="true" />
                </button>
                {section.children && active ? (
                  <div className="toc-children">
                    {section.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onNavigate(section.id, child.id)}
                      >
                        {child.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <span>DATASET MINH HỌA</span>
          <p>Telco Customer Churn</p>
          <small>7.043 khách hàng · 21 biến</small>
        </div>
      </aside>
    </>
  );
}
