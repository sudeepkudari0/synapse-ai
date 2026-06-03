/**
 * Dashboard — Module Launcher
 * Landing screen for Synapse AI with two module cards.
 */

import { useNavigationStore } from '../state/navigation-store';

export function Dashboard() {
  const setActiveModule = useNavigationStore((s) => s.setActiveModule);

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-logo">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" fill="url(#logoGrad)" />
                <path d="M10 16.5L14 20.5L22 12.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="logoGrad" x1="2" y1="2" x2="30" y2="30">
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="dashboard-title">Synapse AI</h1>
              <p className="dashboard-subtitle">Your Career Intelligence Platform</p>
            </div>
          </div>
        </div>

        {/* Module Cards */}
        <div className="module-grid">
          {/* Interview Assistant */}
          <button
            className="module-card module-interview"
            onClick={() => setActiveModule('interview')}
          >
            <div className="module-icon-wrapper module-icon-interview">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className="module-content">
              <h2 className="module-name">Interview Assistant</h2>
              <p className="module-desc">
                Real-time AI-powered interview help with live transcription,
                question detection, and intelligent answer generation.
              </p>
              <div className="module-tags">
                <span className="module-tag">Live Transcription</span>
                <span className="module-tag">AI Answers</span>
                <span className="module-tag">Screen Analysis</span>
              </div>
            </div>
            <div className="module-arrow">→</div>
          </button>

          {/* Career Hub */}
          <button
            className="module-card module-career"
            onClick={() => setActiveModule('career-hub')}
          >
            <div className="module-icon-wrapper module-icon-career">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="module-content">
              <h2 className="module-name">Career Hub</h2>
              <p className="module-desc">
                Search jobs, manage applications, tailor resumes with AI,
                generate cover letters, and export polished PDFs.
              </p>
              <div className="module-tags">
                <span className="module-tag">Job Search</span>
                <span className="module-tag">Resume Tailoring</span>
                <span className="module-tag">Cover Letters</span>
                <span className="module-tag">PDF Export</span>
              </div>
            </div>
            <div className="module-arrow">→</div>
          </button>
        </div>

        {/* Footer */}
        <div className="dashboard-footer">
          <p>Built with ♥ for career seekers everywhere</p>
        </div>
      </div>
    </div>
  );
}
