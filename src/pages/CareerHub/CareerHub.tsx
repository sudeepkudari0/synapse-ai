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
  { id: "tailor", label: "Tailor CV", icon: "✨" },
  { id: "search", label: "Job Search", icon: "🔍" },
];

export function CareerHub() {
  const { careerTab, setCareerTab } = useNavigationStore();

  return (
    <div className="career-hub">


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
