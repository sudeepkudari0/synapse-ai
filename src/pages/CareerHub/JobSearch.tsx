/**
 * Job Search — Google-powered multi-board job search
 * Ported from cv-tailor/src/features/jobSearch
 */

import { useState } from 'react';

const JOB_BOARDS = [
  { id: 'google', name: 'Google Search', icon: '🌐', template: '"{role}" jobs "{location}"', supportsLocation: true },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', template: 'site:linkedin.com/jobs "{role}" "{location}"', supportsLocation: true },
  { id: 'indeed', name: 'Indeed', icon: '🔍', template: 'site:indeed.com "{role}" "{location}"', supportsLocation: true },
  { id: 'glassdoor', name: 'Glassdoor', icon: '🚪', template: 'site:glassdoor.com/job-listing "{role}" "{location}"', supportsLocation: true },
  { id: 'naukri', name: 'Naukri', icon: '🇮🇳', template: 'site:naukri.com "{role}" "{location}"', supportsLocation: true },
  { id: 'remoteok', name: 'RemoteOK', icon: '🏠', template: 'site:remoteok.com "{role}"', supportsLocation: false },
  { id: 'weworkremotely', name: 'WeWorkRemotely', icon: '🌍', template: 'site:weworkremotely.com "{role}"', supportsLocation: false },
  { id: 'wellfound', name: 'Wellfound', icon: '🚀', template: 'site:wellfound.com/jobs "{role}"', supportsLocation: false },
  { id: 'dice', name: 'Dice', icon: '🎲', template: 'site:dice.com "{role}" "{location}"', supportsLocation: true },
  { id: 'ziprecruiter', name: 'ZipRecruiter', icon: '⚡', template: 'site:ziprecruiter.com "{role}" "{location}"', supportsLocation: true },
];

const TIME_PERIODS = [
  { id: '24h', label: 'Last 24 hours', param: '&tbs=qdr:d' },
  { id: '3d', label: 'Last 3 days', param: '&tbs=qdr:d3' },
  { id: '7d', label: 'Last week', param: '&tbs=qdr:w' },
  { id: '14d', label: 'Last 2 weeks', param: '&tbs=qdr:w2' },
  { id: '30d', label: 'Last month', param: '&tbs=qdr:m' },
  { id: 'any', label: 'Any time', param: '' },
];

const POPULAR_ROLES = [
  'Software Engineer', 'Senior Software Engineer', 'Full Stack Developer',
  'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
  'Data Engineer', 'ML Engineer', 'Cloud Engineer',
  'Product Manager', 'Data Scientist', 'Mobile Developer',
];

export function JobSearch() {
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>(['google', 'linkedin', 'indeed']);
  const [timePeriod, setTimePeriod] = useState('7d');
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);

  const toggleBoard = (id: string) => {
    setSelectedBoards((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const buildSearchUrl = (board: typeof JOB_BOARDS[0]): string => {
    let query = board.template
      .replace('{role}', role)
      .replace('{location}', board.supportsLocation ? location : '');
    const encoded = encodeURIComponent(query);
    const dateFilter = TIME_PERIODS.find((t) => t.id === timePeriod)?.param || '';
    return `https://www.google.com/search?q=${encoded}${dateFilter}`;
  };

  const handleSearch = () => {
    if (!role.trim()) return;
    const boards = JOB_BOARDS.filter((b) => selectedBoards.includes(b.id));
    for (const board of boards) {
      const url = buildSearchUrl(board);
      // In Electron, use shell.openExternal instead of window.open
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className="job-search">
      <div className="js-form-card">
        <h3 className="js-heading">🔍 Search Jobs Across Multiple Boards</h3>

        {/* Role Input */}
        <div className="js-input-group">
          <label>Job Role</label>
          <div className="js-role-input-wrapper">
            <input
              type="text"
              placeholder="e.g. Software Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onFocus={() => setShowRoleSuggestions(true)}
              onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 200)}
              className="js-input"
            />
            {showRoleSuggestions && !role && (
              <div className="js-suggestions">
                {POPULAR_ROLES.map((r) => (
                  <button key={r} className="js-suggestion" onClick={() => { setRole(r); setShowRoleSuggestions(false); }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Location Input */}
        <div className="js-input-group">
          <label>Location</label>
          <input
            type="text"
            placeholder="e.g. San Francisco, CA or Remote"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="js-input"
          />
        </div>

        {/* Time Period */}
        <div className="js-input-group">
          <label>Posted Within</label>
          <div className="js-time-pills">
            {TIME_PERIODS.map((tp) => (
              <button
                key={tp.id}
                className={`js-pill ${timePeriod === tp.id ? 'js-pill-active' : ''}`}
                onClick={() => setTimePeriod(tp.id)}
              >
                {tp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Board Selection */}
        <div className="js-input-group">
          <label>Search On</label>
          <div className="js-boards">
            {JOB_BOARDS.map((board) => (
              <button
                key={board.id}
                className={`js-board ${selectedBoards.includes(board.id) ? 'js-board-active' : ''}`}
                onClick={() => toggleBoard(board.id)}
              >
                <span className="js-board-icon">{board.icon}</span>
                <span className="js-board-name">{board.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <button
          className="js-search-btn"
          onClick={handleSearch}
          disabled={!role.trim() || selectedBoards.length === 0}
        >
          🚀 Search {selectedBoards.length} Board{selectedBoards.length !== 1 ? 's' : ''}
        </button>

        <p className="js-hint">
          Opens each selected board as a Google search tab in your browser.
        </p>
      </div>
    </div>
  );
}
