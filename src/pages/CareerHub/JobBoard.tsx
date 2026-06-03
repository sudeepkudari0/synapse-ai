/**
 * Job Board — Kanban-style job tracking
 */

import { useState } from 'react';
import { useJobStore } from '../../career/state/career-store';
import type { Job, JobStatus } from '../../career/core/types';

const COLUMNS: { status: JobStatus; label: string; emoji: string; color: string }[] = [
  { status: 'saved', label: 'Saved', emoji: '💾', color: '#3b82f6' },
  { status: 'applied', label: 'Applied', emoji: '📨', color: '#f59e0b' },
  { status: 'interviewing', label: 'Interviewing', emoji: '💬', color: '#8b5cf6' },
  { status: 'offered', label: 'Offered', emoji: '🎉', color: '#22c55e' },
  { status: 'rejected', label: 'Rejected', emoji: '✗', color: '#ef4444' },
];

export function JobBoard() {
  const { jobs, updateJob, getJobsByStatus } = useJobStore();
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);

  const handleDragStart = (jobId: string) => {
    setDraggedJobId(jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetStatus: JobStatus) => {
    if (!draggedJobId) return;
    updateJob(draggedJobId, { status: targetStatus });
    // Persist
    const updatedJobs = jobs.map((j) => j.id === draggedJobId ? { ...j, status: targetStatus } : j);
    (window as any).electronAPI?.careerHub?.saveJobs?.(updatedJobs);
    setDraggedJobId(null);
  };

  if (jobs.length === 0) {
    return (
      <div className="board-empty">
        <div className="board-empty-icon">📊</div>
        <h3>No jobs to track yet</h3>
        <p>Add jobs from the "My Jobs" tab to start tracking your pipeline.</p>
      </div>
    );
  }

  return (
    <div className="job-board">
      {COLUMNS.map((col) => {
        const colJobs = getJobsByStatus(col.status);
        return (
          <div
            key={col.status}
            className="board-column"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.status)}
          >
            <div className="board-col-header" style={{ borderColor: col.color }}>
              <span className="board-col-emoji">{col.emoji}</span>
              <span className="board-col-label">{col.label}</span>
              <span className="board-col-count">{colJobs.length}</span>
            </div>
            <div className="board-col-body">
              {colJobs.map((job) => (
                <div
                  key={job.id}
                  className={`board-card ${draggedJobId === job.id ? 'board-card-dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(job.id)}
                  onDragEnd={() => setDraggedJobId(null)}
                >
                  <h4 className="board-card-title">{job.title}</h4>
                  <p className="board-card-company">{job.company}</p>
                  {job.location && <p className="board-card-loc">{job.location}</p>}
                  {job.fitScore && (
                    <div className="board-card-score">
                      Score: <strong>{job.fitScore}</strong>/10
                    </div>
                  )}
                </div>
              ))}
              {colJobs.length === 0 && (
                <div className="board-col-empty">Drop jobs here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
