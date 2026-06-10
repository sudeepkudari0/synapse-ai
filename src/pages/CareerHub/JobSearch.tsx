import { useState, useEffect } from 'react';
import { useJobStore } from '../../career/state/career-store';
import { useNavigationStore } from '../../state/navigation-store';
import type { Job } from '../../career/core/types';

const JOB_BOARDS = [
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'indeed', name: 'Indeed', icon: '🔍' },
  { id: 'glassdoor', name: 'Glassdoor', icon: '🚪' },
  { id: 'zip_recruiter', name: 'ZipRecruiter', icon: '⚡' },
];

const IT_JOBS = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Site Reliability Engineer (SRE)',
  'Mobile Developer',
  'Machine Learning Engineer',
  'Data Scientist',
  'Data Engineer',
  'Cloud Architect',
  'Cybersecurity Analyst',
  'UI/UX Designer',
  'Product Manager',
  'QA Automation Engineer',
  'Database Administrator',
  'System Administrator'
];

const IT_LOCATIONS = [
  'Bangalore',
  'Hyderabad',
  'Pune',
  'Noida',
  'Chennai',
  'Gurgaon',
  'Mumbai',
  'Delhi',
  'Kolkata',
  'Ahmedabad',
  'Kochi',
  'Remote'
];

interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}

function SearchableDropdown({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="js-input-wrapper" style={{ position: 'relative', zIndex: isOpen ? 50 : 1 }}>
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="js-input-modern"
          style={{ width: '100%', paddingRight: '40px' }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setFocusedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIsOpen(true);
              setFocusedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIsOpen(true);
              setFocusedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
              if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
                e.preventDefault();
                onChange(filteredOptions[focusedIndex]);
                setIsOpen(false);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          disabled={disabled}
        />
        {/* Toggle Dropdown Button */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent input from blurring
            if (!disabled) setIsOpen(!isOpen);
          }}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: disabled ? 'none' : 'auto'
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Floating suggestion list */}
        {isOpen && filteredOptions.length > 0 && (
          <div className="js-suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99 }}>
            {filteredOptions.map((opt, idx) => (
              <button
                key={opt}
                type="button"
                className="js-suggestion"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur so click handler succeeds
                  onChange(opt);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: focusedIndex === idx ? 'rgba(99, 102, 241, 0.15)' : 'none',
                  color: focusedIndex === idx ? '#e2e8f0' : '#94a3b8',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [pythonStatus, setPythonStatus] = useState<{ checked: boolean; pythonAvailable: boolean; venvReady: boolean }>({
    checked: false,
    pythonAvailable: false,
    venvReady: false
  });

  useEffect(() => {
    if ((window as any).electronAPI?.careerHub?.checkJobspy) {
      (window as any).electronAPI.careerHub.checkJobspy().then((res: any) => {
        if (res.success) {
          setPythonStatus({
            checked: true,
            pythonAvailable: res.pythonAvailable,
            venvReady: res.venvReady
          });
        } else {
          setPythonStatus(prev => ({ ...prev, checked: true }));
        }
      }).catch(() => {
        setPythonStatus(prev => ({ ...prev, checked: true }));
      });
    }
  }, []);

  const toggleBoard = (id: string) => {
    setSelectedBoards((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSetupStatus(null);
    
    // Check python status again before search starts to ensure it hasn't changed
    if ((window as any).electronAPI?.careerHub?.checkJobspy) {
      try {
        const res = await (window as any).electronAPI.careerHub.checkJobspy();
        if (res.success) {
          setPythonStatus({
            checked: true,
            pythonAvailable: res.pythonAvailable,
            venvReady: res.venvReady
          });
        }
      } catch (e) {}
    }

    // Set up status handler
    const removeListener = (window as any).electronAPI?.careerHub?.onSetupStatus?.((status: string) => {
      if (status === 'creating_venv') {
        setSetupStatus('Creating Python virtual environment...');
      } else if (status === 'installing_requirements') {
        setSetupStatus('Installing scraper dependencies (jobspy, pandas)...');
      } else if (status === 'running') {
        setSetupStatus('Executing JobSpy scraper...');
      }
    });

    try {
      const response = await (window as any).electronAPI.careerHub.runJobspy({
        query,
        location,
        sites: selectedBoards.join(','),
        remote: isRemote,
        results: maxResults
      });

      if (response.success) {
        setResults(response.data || []);
        // update setup status so it doesn't show in UI anymore, and update venv status
        setPythonStatus(prev => ({ ...prev, venvReady: true }));
      } else {
        setError(response.error || 'Unknown error occurred during search.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with scraper engine.');
    } finally {
      setLoading(false);
      setSetupStatus(null);
      if (removeListener) removeListener();
    }
  };

  const handleSaveJob = (job: any) => {
    const applyUrl = job.job_url || job.job_url_direct || '';
    const newJob: Job = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      url: applyUrl,
      title: job.title || 'Untitled Role',
      company: job.company || 'Unknown Company',
      location: job.location || 'Remote',
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
      {pythonStatus.checked && !pythonStatus.pythonAvailable && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          color: '#f87171',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>Python 3 Not Found</h4>
            <p style={{ margin: 0, color: '#fca5a5' }}>
              Synapse AI uses <strong>python-jobspy</strong> to scrape job boards offline. 
              To enable this feature, please install Python 3.9+ on your system and restart the app.
              Once Python is installed, Synapse AI will automatically configure the required packages on your first search.
            </p>
          </div>
        </div>
      )}

      {pythonStatus.checked && pythonStatus.pythonAvailable && !pythonStatus.venvReady && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          color: '#a5b4fc',
          fontSize: '13px'
        }}>
          <span style={{ fontSize: '18px' }}>ℹ️</span>
          <div>
            Synapse AI will automatically initialize the local Python scraping environment (via <code>pip install python-jobspy pandas</code>) on your first search.
          </div>
        </div>
      )}

      {/* Search Configuration */}
      <div className="js-glass-panel">
        <div className="js-header">
          <h2 className="js-header-title">✨ Automated Job Fetcher</h2>
          <p className="js-header-subtitle">
            Directly scrapes live job boards and brings the results into Synapse AI.
          </p>
        </div>

        <div className="js-search-form">
          <SearchableDropdown
            label="Job Title / Keywords"
            placeholder="e.g. Software Engineer, React"
            value={query}
            onChange={setQuery}
            options={IT_JOBS}
            disabled={loading}
          />

          <SearchableDropdown
            label="Location"
            placeholder="e.g. Bangalore, Hyderabad"
            value={location}
            onChange={setLocation}
            options={IT_LOCATIONS}
            disabled={loading}
          />

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
          <div className="js-loading-text">
            {setupStatus === 'creating_venv' && "Setting up Python Environment (creating venv)... This happens only once."}
            {setupStatus === 'installing_requirements' && "Installing dependencies (python-jobspy, pandas, beautifulsoup4, tls-client)... This may take up to 2-3 minutes on first run."}
            {setupStatus === 'searching' && `Scraping ${selectedBoards.length} boards... this takes a few seconds.`}
            {!setupStatus && `Fetching jobs...`}
          </div>
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

                    <button
                      className="js-btn-prep"
                      onClick={() => {
                        const prepJob = {
                          role: job.title || '',
                          company: job.company || '',
                          jobDescription: job.description || ''
                        };
                        localStorage.setItem('prepJob', JSON.stringify(prepJob));
                        useNavigationStore.getState().setActiveModule('interview');
                      }}
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#a5b4fc',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginLeft: '6px'
                      }}
                    >
                      🎙️ Prep
                    </button>
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
