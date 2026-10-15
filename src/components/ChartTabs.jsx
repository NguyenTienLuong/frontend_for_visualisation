import { useEffect, useId, useMemo, useState } from "react";

export default function ChartTabs({ tabs, ariaLabel = "Chọn cách trực quan hóa" }) {
  const fallbackId = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const tabIdKey = tabIds.join("|");

  useEffect(() => {
    const openRequestedTab = (event) => {
      const requestedId = event.detail?.id;
      if (tabIds.includes(requestedId)) {
        setActiveId(requestedId);
      }
    };
    window.addEventListener("open-chart-tab", openRequestedTab);
    return () => window.removeEventListener("open-chart-tab", openRequestedTab);
  }, [tabIdKey]);

  const activeTab = tabs.find((tab) => tab.id === activeId) || tabs[0];

  useEffect(() => {
    if (!activeTab) return undefined;

    let secondFrame;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    });
    const settledTimer = window.setTimeout(
      () => window.dispatchEvent(new Event("resize")),
      320,
    );

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settledTimer);
    };
  }, [activeTab?.id]);

  if (!activeTab) return null;

  return (
    <div className="chart-tabs">
      <div className="tab-list-wrap">
        <div className="tab-list" role="tablist" aria-label={ariaLabel}>
          {tabs.map((tab) => {
            const selected = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={selected ? "active" : ""}
                onClick={() => setActiveId(tab.id)}
              >
                {tab.index ? <span>{tab.index}</span> : null}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        key={activeTab.id}
        id={`panel-${activeTab.id}`}
        className="tab-panel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab.id}`}
        data-tab-panel={fallbackId}
      >
        {activeTab.content}
      </div>
    </div>
  );
}
