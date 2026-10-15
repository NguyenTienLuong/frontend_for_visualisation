import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import { sections } from "./config/sections";
import IntroductionSection from "./sections/IntroductionSection";
import FrequencySection from "./sections/FrequencySection";
import PointEstimateSection from "./sections/PointEstimateSection";
import TrendSection from "./sections/TrendSection";
import HopSection from "./sections/HopSection";
import ConclusionSection from "./sections/ConclusionSection";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function App() {
  const [activeId, setActiveId] = useState(sections[0].id);
  const [progress, setProgress] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sectionIds = useMemo(() => sections.map((section) => section.id), []);

  useEffect(() => {
    const targets = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-14% 0px -68% 0px", threshold: [0, 0.12, 0.3, 0.55] },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sectionIds]);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    const targetId =
      window.location.hash.slice(1) || new URLSearchParams(window.location.search).get("section");
    if (!targetId) return undefined;
    const scrollToTarget = () => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    };
    const earlyTimer = window.setTimeout(scrollToTarget, 220);
    const settledTimer = window.setTimeout(scrollToTarget, 1800);
    return () => {
      window.clearTimeout(earlyTimer);
      window.clearTimeout(settledTimer);
    };
  }, []);

  const navigate = (sectionId, tabId) => {
    setMobileOpen(false);
    setActiveId(sectionId);
    if (tabId) {
      window.dispatchEvent(new CustomEvent("open-chart-tab", { detail: { id: tabId } }));
    }
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  };

  const activeSection = sections.find((section) => section.id === activeId) || sections[0];

  return (
    <div className="app-shell">
      <Sidebar
        sections={sections}
        activeId={activeId}
        onNavigate={navigate}
        progress={progress}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <header className="mobile-header">
        <button type="button" aria-label="Mở mục lục" onClick={() => setMobileOpen(true)}>
          <MenuIcon />
        </button>
        <div>
          <span>{activeSection.number}</span>
          <p>{activeSection.shortTitle}</p>
        </div>
        <small>{Math.round(progress)}%</small>
      </header>

      <main id="noi-dung">
        <IntroductionSection />
        <FrequencySection />
        <PointEstimateSection />
        <TrendSection />
        <HopSection />
        <ConclusionSection />
      </main>

      <button
        type="button"
        className={`back-to-top ${progress > 20 ? "visible" : ""}`}
        aria-label="Về đầu trang"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ↑
      </button>
    </div>
  );
}
