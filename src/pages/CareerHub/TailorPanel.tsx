/**
 * Tailor Panel — Resume tailoring + cover letter generation
 * Uses ported cv-tailor core logic via the Electron LLM adapter.
 */

import { useState, useEffect } from 'react';
import { useJobStore } from '../../career/state/career-store';
import { useTailoringStore } from '../../career/state/career-store';
import { ElectronLLMProvider } from '../../career/core/llm-adapter';
import { ResumeEditor } from '../../career/core/resumeEditor';
import { CoverLetterGenerator } from '../../career/core/coverLetter';
import { generateResumePDF, buildFilename } from '../../career/core/pdfGenerator';
import type { MasterResume } from '../../career/core/types';

export function TailorPanel() {
  const { selectedJobId, jobs } = useJobStore();
  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null;

  const {
    masterResume, tailoredResume, coverLetter,
    jdAnalysis, isGenerating, generatingStatus, error,
    setMasterResume, setMasterResumeYaml, setMasterResumeText,
    setTailoredResume, setCoverLetter, setJdAnalysis,
    setIsGenerating, setGeneratingStatus, setError, reset,
  } = useTailoringStore();

  const [jobTitle, setJobTitle] = useState(selectedJob?.title || '');
  const [company, setCompany] = useState(selectedJob?.company || '');
  const [jobDescription, setJobDescription] = useState(selectedJob?.description || selectedJob?.fullDescription || '');
  const [resultTab, setResultTab] = useState<'resume' | 'cover'>('resume');
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync when selected job changes
  useEffect(() => {
    if (selectedJob) {
      setJobTitle(selectedJob.title);
      setCompany(selectedJob.company);
      setJobDescription(selectedJob.description || selectedJob.fullDescription || '');
    }
  }, [selectedJobId]);

  // Load master resume from electron store on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await (window as any).electronAPI?.careerHub?.loadProfile?.();
        if (data?.masterResumeYaml) {
          setMasterResumeYaml(data.masterResumeYaml);
          setMasterResumeText(data.masterResumeText || '');
          // Parse YAML to MasterResume
          const { load } = await import('js-yaml');
          const parsed = load(data.masterResumeYaml) as MasterResume;
          setMasterResume(parsed);
        }
      } catch {
        // Profile not set up yet
      }
    })();
  }, []);

  const handleYamlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      setMasterResumeYaml(text);
      try {
        const { load } = await import('js-yaml');
        const parsed = load(text) as MasterResume;
        setMasterResume(parsed);
        // Persist to electron
        (window as any).electronAPI?.careerHub?.saveProfile?.({
          masterResumeYaml: text,
          masterResumeText: '',
        });
      } catch (err: any) {
        setError('Invalid YAML file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    if (!jobDescription.trim() || !jobTitle.trim() || !company.trim()) {
      setError('Please fill in Job Title, Company, and Job Description');
      return;
    }
    if (!masterResume) {
      setError('Please upload your master resume YAML first');
      return;
    }

    reset();
    setIsGenerating(true);
    setError(null);

    try {
      const provider = new ElectronLLMProvider();
      const resumeEditor = new ResumeEditor(provider);
      const coverLetterGen = new CoverLetterGenerator(provider);

      setGeneratingStatus('Analyzing job description...');
      const { resume, jdAnalysis: analysis } = await resumeEditor.optimize(
        masterResume,
        jobDescription,
        jobTitle,
        company,
      );
      setTailoredResume(resume);
      setJdAnalysis(analysis);

      setGeneratingStatus('Generating cover letter...');
      const letter = await coverLetterGen.generate(company, jobTitle, jobDescription, resume);
      setCoverLetter(letter);

      setGeneratingStatus('');
    } catch (err: any) {
      setError(err.message || 'Generation failed');
      setGeneratingStatus('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!tailoredResume || !masterResume) return;
    try {
      const filename = buildFilename(masterResume.name);
      await generateResumePDF(tailoredResume, filename, masterResume);
    } catch (err: any) {
      setError('PDF generation failed: ' + err.message);
    }
  };

  const handleDownloadText = (text: string, suffix: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${company}_${jobTitle}_${suffix}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tailor-panel">
      {/* Resume Upload */}
      {!masterResume && (
        <div className="tailor-upload-card">
          <div className="tailor-upload-icon">📄</div>
          <h3>Upload Your Master Resume</h3>
          <p>Upload a YAML-formatted master resume to get started with AI-powered tailoring.</p>
          <label className="tailor-upload-btn">
            📂 Choose YAML File
            <input type="file" accept=".yaml,.yml" onChange={handleYamlUpload} hidden />
          </label>
        </div>
      )}

      {/* Input Form */}
      {masterResume && (
        <div className="tailor-form-card">
          <div className="tailor-form-header">
            <div className="tailor-resume-info">
              <span className="tailor-check">✓</span>
              <span>Resume loaded: <strong>{masterResume.name}</strong></span>
            </div>
            <label className="tailor-change-btn">
              Change
              <input type="file" accept=".yaml,.yml" onChange={handleYamlUpload} hidden />
            </label>
          </div>

          <div className="tailor-inputs">
            <div className="tailor-row">
              <input
                type="text"
                placeholder="Job Title *"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="tailor-input"
              />
              <input
                type="text"
                placeholder="Company *"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="tailor-input"
              />
            </div>
            <textarea
              placeholder="Paste job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="tailor-textarea"
              rows={6}
            />
          </div>

          <button
            className={`tailor-generate-btn ${isGenerating ? 'tailor-generating' : ''}`}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="tailor-loading">
                <span className="tailor-spinner" />
                {generatingStatus || 'Generating...'}
              </span>
            ) : (
              '✨ Generate Tailored Resume & Cover Letter'
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="tailor-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {(tailoredResume || coverLetter) && (
        <div className="tailor-results-card">
          {/* Result Tabs */}
          <div className="tailor-result-tabs">
            <button
              className={`tailor-result-tab ${resultTab === 'resume' ? 'active' : ''}`}
              onClick={() => setResultTab('resume')}
            >
              📄 Resume
            </button>
            <button
              className={`tailor-result-tab ${resultTab === 'cover' ? 'active' : ''}`}
              onClick={() => setResultTab('cover')}
            >
              ✉️ Cover Letter
            </button>
          </div>

          {/* Resume Result */}
          {resultTab === 'resume' && tailoredResume && (
            <div className="tailor-result-content">
              <div className="tailor-result-actions">
                <button className="tailor-action-btn" onClick={() => handleCopy(tailoredResume)}>
                  {copySuccess ? '✓ Copied!' : '📋 Copy'}
                </button>
                <button className="tailor-action-btn" onClick={() => handleDownloadText(tailoredResume, 'Resume')}>
                  📝 TXT
                </button>
                <button className="tailor-action-btn tailor-action-primary" onClick={handleDownloadPDF}>
                  📑 Download PDF
                </button>
              </div>
              <pre className="tailor-preview">{tailoredResume}</pre>
            </div>
          )}

          {/* Cover Letter Result */}
          {resultTab === 'cover' && coverLetter && (
            <div className="tailor-result-content">
              <div className="tailor-result-actions">
                <button className="tailor-action-btn" onClick={() => handleCopy(coverLetter)}>
                  {copySuccess ? '✓ Copied!' : '📋 Copy'}
                </button>
                <button className="tailor-action-btn" onClick={() => handleDownloadText(coverLetter, 'CoverLetter')}>
                  ⬇️ Download
                </button>
              </div>
              <div className="tailor-preview tailor-preview-letter">{coverLetter}</div>
            </div>
          )}

          {/* JD Analysis */}
          {jdAnalysis && (
            <details className="tailor-analysis">
              <summary>
                📊 JD Analysis
                <span className="tailor-analysis-count">
                  {(jdAnalysis.hard_skills?.length || 0) + (jdAnalysis.tools_technologies?.length || 0)} keywords
                </span>
              </summary>
              <div className="tailor-analysis-body">
                <div><strong>Hard Skills:</strong> {jdAnalysis.hard_skills?.join(', ') || 'None'}</div>
                <div><strong>Tools & Tech:</strong> {jdAnalysis.tools_technologies?.join(', ') || 'None'}</div>
                <div><strong>Must Have:</strong> {jdAnalysis.keyword_priorities?.must_have?.join(', ') || 'None'}</div>
                <div><strong>Nice to Have:</strong> {jdAnalysis.keyword_priorities?.nice_to_have?.join(', ') || 'None'}</div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
