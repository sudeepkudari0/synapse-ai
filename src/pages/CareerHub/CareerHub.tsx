/**
 * Career Hub — Main Container
 * Houses all career management features: Job Search, Tracking, Resume Tailoring, Cover Letters.
 */

import {
  useNavigationStore,
  type CareerTab,
} from "../../state/navigation-store";
import { JobManager } from "./JobManager";
import { JobBoard } from "./JobBoard";
import { TailorPanel } from "./TailorPanel";
import { JobSearch } from "./JobSearch";

const TABS: { id: CareerTab; label: string; icon: string }[] = [
  { id: "jobs", label: "My Jobs", icon: "📋" },
  { id: "tracking", label: "Tracking", icon: "📊" },
  { id: "tailor", label: "Tailor & Apply", icon: "✨" },
  { id: "search", label: "Job Search", icon: "🔍" },
];

export function CareerHub() {
  const { careerTab, setCareerTab, goHome } = useNavigationStore();

  return (
    <div className="career-hub">
      {/* Top Bar */}
      <div className="career-topbar">
        <button
          className="career-back-btn"
          onClick={goHome}
          title="Back to Dashboard"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="career-topbar-title">
          <h1>Career Hub</h1>
        </div>
        <div className="career-topbar-spacer" />
      </div>

      {/* Tab Navigation */}
      <div className="career-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`career-tab ${careerTab === tab.id ? "career-tab-active" : ""}`}
            onClick={() => setCareerTab(tab.id)}
          >
            <span className="career-tab-icon">{tab.icon}</span>
            <span className="career-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="career-content">
        {careerTab === "jobs" && <JobManager />}
        {careerTab === "tracking" && <JobBoard />}
        {careerTab === "tailor" && <TailorPanel />}
        {careerTab === "search" && <JobSearch />}
      </div>
    </div>
  );
}
