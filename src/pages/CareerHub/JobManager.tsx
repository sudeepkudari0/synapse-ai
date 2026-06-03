/**
 * Job Manager — Save, view, and manage jobs
 */

import { useState } from "react";
import { useJobStore } from "../../career/state/career-store";
import type { Job, JobStatus } from "../../career/core/types";
import { useNavigationStore } from "@/state/navigation-store";

const STATUS_OPTIONS: {
  value: JobStatus | "all";
  label: string;
  color: string;
}[] = [
  { value: "all", label: "All Jobs", color: "#6366f1" },
  { value: "saved", label: "Saved", color: "#3b82f6" },
  { value: "applied", label: "Applied", color: "#f59e0b" },
  { value: "interviewing", label: "Interviewing", color: "#10b981" },
  { value: "offered", label: "Offered", color: "#22c55e" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
  { value: "archived", label: "Archived", color: "#6b7280" },
];

export function JobManager() {
  const {
    jobs,
    searchQuery,
    statusFilter,
    setSearchQuery,
    setStatusFilter,
    addJob,
    updateJob,
    removeJob,
    getFilteredJobs,
  } = useJobStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const filteredJobs = getFilteredJobs();

  const handleAddJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const newJob: Job = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      url: (fd.get("url") as string) || "",
      title: (fd.get("title") as string) || "",
      company: (fd.get("company") as string) || "",
      location: (fd.get("location") as string) || "",
      description: (fd.get("description") as string) || "",
      isRemote: (fd.get("isRemote") as string) === "on",
      source: (fd.get("source") as string) || "manual",
      dateFound: new Date().toISOString(),
      status: "saved",
      notes: "",
      updatedAt: new Date().toISOString(),
    };

    addJob(newJob);
    // Persist
    (window as any).electronAPI?.careerHub?.saveJobs?.([...jobs, newJob]);
    setShowAddForm(false);
    form.reset();
  };

  const handleStatusChange = (jobId: string, newStatus: JobStatus) => {
    updateJob(jobId, { status: newStatus });
    const updatedJobs = jobs.map((j) =>
      j.id === jobId ? { ...j, status: newStatus } : j,
    );
    (window as any).electronAPI?.careerHub?.saveJobs?.(updatedJobs);
  };

  return (
    <div className="job-manager">
      {/* Search & Filter Bar */}
      <div className="jm-toolbar">
        <div className="jm-search">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="jm-filters">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`jm-filter-btn ${statusFilter === opt.value ? "jm-filter-active" : ""}`}
              onClick={() => setStatusFilter(opt.value)}
              style={
                statusFilter === opt.value
                  ? { borderColor: opt.color, color: opt.color }
                  : {}
              }
            >
              {opt.label}
              {opt.value !== "all" && (
                <span className="jm-filter-count">
                  {jobs.filter((j) => j.status === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          className="jm-add-btn"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "✕ Cancel" : "+ Add Job"}
        </button>
      </div>

      {/* Add Job Form */}
      {showAddForm && (
        <form className="jm-add-form" onSubmit={handleAddJob}>
          <div className="jm-form-grid">
            <input name="title" placeholder="Job Title *" required />
            <input name="company" placeholder="Company *" required />
            <input name="location" placeholder="Location" />
            <input name="url" placeholder="Job URL" type="url" />
            <input name="source" placeholder="Source (e.g. LinkedIn)" />
            <label className="jm-remote-label">
              <input name="isRemote" type="checkbox" />
              Remote
            </label>
          </div>
          <textarea
            name="description"
            placeholder="Job description (paste here)"
            rows={4}
          />
          <button type="submit" className="jm-submit-btn">
            Save Job
          </button>
        </form>
      )}

      {/* Job List */}
      <div className="jm-list">
        {filteredJobs.length === 0 ? (
          <div className="jm-empty">
            <div className="jm-empty-icon">📋</div>
            <h3>No jobs yet</h3>
            <p>
              Add jobs manually or use the Job Search tab to discover
              opportunities.
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              className={`jm-job-card ${expandedJobId === job.id ? "jm-job-expanded" : ""}`}
            >
              <div
                className="jm-job-header"
                onClick={() =>
                  setExpandedJobId(expandedJobId === job.id ? null : job.id)
                }
              >
                <div className="jm-job-info">
                  <h3 className="jm-job-title">{job.title}</h3>
                  <p className="jm-job-company">
                    {job.company} · {job.location} {job.isRemote ? "🏠" : ""}
                  </p>
                </div>
                <div className="jm-job-actions">
                  <select
                    className="jm-status-select"
                    value={job.status}
                    onChange={(e) =>
                      handleStatusChange(job.id, e.target.value as JobStatus)
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    {STATUS_OPTIONS.filter((o) => o.value !== "all").map(
                      (opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ),
                    )}
                  </select>
                  {job.fitScore && (
                    <span
                      className={`jm-score jm-score-${job.fitScore >= 7 ? "high" : job.fitScore >= 5 ? "mid" : "low"}`}
                    >
                      {job.fitScore}/10
                    </span>
                  )}
                </div>
              </div>

              {expandedJobId === job.id && (
                <div className="jm-job-details">
                  {job.url && (
                    <a
                      href={job.url}
                      className="jm-job-url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🔗 View Original Posting
                    </a>
                  )}
                  {job.description && (
                    <div className="jm-job-desc">
                      <h4>Description</h4>
                      <p>
                        {job.description.slice(0, 500)}
                        {job.description.length > 500 ? "..." : ""}
                      </p>
                    </div>
                  )}
                  <div className="jm-job-meta">
                    <span>
                      Found: {new Date(job.dateFound).toLocaleDateString()}
                    </span>
                    <span>Source: {job.source}</span>
                  </div>
                  <div className="jm-job-bottom-actions">
                    <button
                      className="jm-action-btn jm-action-tailor"
                      onClick={() => {
                        // Navigate to tailor tab with this job pre-loaded
                        const navStore = useNavigationStore.getState();
                        const jobStoreState = useJobStore.getState();
                        jobStoreState.setSelectedJob(job.id);
                        navStore.setCareerTab("tailor");
                      }}
                    >
                      ✨ Tailor Resume
                    </button>
                    <button
                      className="jm-action-btn jm-action-delete"
                      onClick={() => {
                        removeJob(job.id);
                        const updatedJobs = jobs.filter((j) => j.id !== job.id);
                        (window as any).electronAPI?.careerHub?.saveJobs?.(
                          updatedJobs,
                        );
                      }}
                    >
                      🗑 Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {jobs.length > 0 && (
        <div className="jm-stats">
          <div className="jm-stat">
            <span className="jm-stat-value">{jobs.length}</span>
            <span className="jm-stat-label">Total</span>
          </div>
          <div className="jm-stat">
            <span className="jm-stat-value">
              {jobs.filter((j) => j.status === "applied").length}
            </span>
            <span className="jm-stat-label">Applied</span>
          </div>
          <div className="jm-stat">
            <span className="jm-stat-value">
              {jobs.filter((j) => j.status === "interviewing").length}
            </span>
            <span className="jm-stat-label">Interviewing</span>
          </div>
        </div>
      )}
    </div>
  );
}
