import { useState } from 'react';
import { useJobStore } from '../../career/state/career-store';
import type { Job } from '../../career/core/types';

const JOB_BOARDS = [
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'indeed', name: 'Indeed', icon: '🔍' },
  { id: 'glassdoor', name: 'Glassdoor', icon: '🚪' },
  { id: 'zip_recruiter', name: 'ZipRecruiter', icon: '⚡' },
];

export function JobSearch() {
  const { jobs: savedJobs, addJob } = useJobStore();
  
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>(['linkedin', 'indeed']);
  const [isRemote, setIsRemote] = useState(false);
  const [maxResults, setMaxResults] = useState(15);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const toggleBoard = (id: string) => {
    setSelectedBoards((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleSearch = async () => {
    if (!query.trim() || !location.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await (window as any).electronAPI.careerHub.runJobspy({
        query,
        location,
        sites: selectedBoards.join(','),
        remote: isRemote,
        results: maxResults
      });

      if (response.success) {
        // Filter out jobs that are already saved
        const fetchedJobs = response.data || [];
        const newUniqueJobs = fetchedJobs.filter((job: any) => {
          const applyUrl = job.job_url || job.job_url_direct;
          return !savedJobs.some((saved) => saved.url === applyUrl);
        });
        setResults(newUniqueJobs);
      } else {
        setError(response.error || 'Unknown error occurred during search.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with scraper engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJob = (job: any) => {
    const newJob: Job = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      url: job.job_url || job.job_url_direct || '',
      title: job.title || 'Unknown Title',
      company: job.company || 'Unknown Company',
      location: job.location || '',
      description: job.description || '',
      isRemote: job.is_remote || false,
      source: job.site || 'JobSpy',
      dateFound: new Date().toISOString(),
      status: 'saved',
      notes: '',
      updatedAt: new Date().toISOString(),
      fitScore: undefined,
    };

    addJob(newJob);
    // Persist
    (window as any).electronAPI?.careerHub?.saveJobs?.([...savedJobs, newJob]);
  };

  const isSaved = (job: any) => {
    const url = job.job_url || job.job_url_direct;
    return savedJobs.some((j) => j.url === url);
  };

  return (
    <div className="js-dashboard" style={{ paddingBottom: '60px' }}>
      {/* Search Configuration */}
      <div className="js-glass-panel">
        <div className="js-header">
          <h2 className="js-header-title">✨ Automated Job Fetcher</h2>
          <p className="js-header-subtitle">
            Directly scrapes live job boards and brings the results into Synapse AI.
          </p>
        </div>

        <div className="js-search-form">
          <div className="js-input-wrapper">
            <label>Job Title / Keywords</label>
            <input
              className="js-input-modern"
              placeholder="e.g. Software Engineer, React"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="js-input-wrapper">
            <label>Location</label>
            <input
              className="js-input-modern"
              placeholder="e.g. San Francisco, CA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="js-boards-grid">
            {JOB_BOARDS.map((board) => (
              <button
                key={board.id}
                className={`js-board-btn ${selectedBoards.includes(board.id) ? 'active' : ''}`}
                onClick={() => toggleBoard(board.id)}
                disabled={loading}
              >
                <span>{board.icon}</span> {board.name}
              </button>
            ))}
            
            <button
              className={`js-board-btn ${isRemote ? 'active' : ''}`}
              onClick={() => setIsRemote(!isRemote)}
              disabled={loading}
              style={{ background: isRemote ? 'rgba(34, 197, 94, 0.15)' : '', borderColor: isRemote ? 'rgba(34, 197, 94, 0.5)' : '', color: isRemote ? '#4ade80' : '' }}
            >
              🏠 Remote Only
            </button>
            
            <select
              className="js-input-modern"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              disabled={loading}
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              <option value={15}>15 Results</option>
              <option value={30}>30 Results</option>
              <option value={50}>50 Results</option>
            </select>
          </div>


          <div className="js-search-action">
            <button 
              className="js-btn-primary" 
              onClick={handleSearch}
              disabled={loading || !query.trim() || !location.trim() || selectedBoards.length === 0}
            >
              {loading ? 'Searching...' : '🚀 Fetch Jobs'}
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="js-error-card">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="js-glass-panel js-loading-state">
          <div className="js-spinner-ring"></div>
          <div className="js-loading-text">Scraping {selectedBoards.length} boards... this takes a few seconds.</div>
        </div>
      )}

      {/* Results Grid */}
      {!loading && results.length > 0 && (
        <div className="js-glass-panel">
          <div className="js-results-header">
            <h3 className="js-results-title">Found {results.length} Jobs</h3>
          </div>
          
          <div className="js-results-grid">
            {results.map((job, idx) => {
              const alreadySaved = isSaved(job);
              const applyUrl = job.job_url || job.job_url_direct;
              
              return (
                <div key={`${job.id || idx}`} className="js-result-card">
                  <div className="js-result-site-badge">{job.site}</div>
                  
                  <h4 className="js-result-title" title={job.title}>{job.title}</h4>
                  <div className="js-result-company">
                    🏢 {job.company}
                  </div>
                  
                  <div className="js-result-meta">
                    {job.location && (
                      <span className="js-result-tag">📍 {job.location}</span>
                    )}
                    {job.is_remote && (
                      <span className="js-result-tag" style={{ color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.3)' }}>
                        🏠 Remote
                      </span>
                    )}
                    {(job.min_amount || job.max_amount) && (
                      <span className="js-result-tag" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                        💰 {job.currency || '$'}{job.min_amount ? Math.round(job.min_amount).toLocaleString() : ''} 
                        {job.max_amount ? ` - ${Math.round(job.max_amount).toLocaleString()}` : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="js-result-spacer"></div>
                  
                  <div className="js-result-actions">
                    {applyUrl && (
                      <button 
                        className="js-btn-view"
                        onClick={() => {
                          if ((window as any).electronAPI?.openExternal) {
                            (window as any).electronAPI.openExternal(applyUrl);
                          } else {
                            window.open(applyUrl, '_blank');
                          }
                        }}
                      >
                        View
                      </button>
                    )}
                    
                    {alreadySaved ? (
                      <button className="js-btn-saved" disabled>
                        ✓ Saved
                      </button>
                    ) : (
                      <button className="js-btn-save" onClick={() => handleSaveJob(job)}>
                        + Save to Manager
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
