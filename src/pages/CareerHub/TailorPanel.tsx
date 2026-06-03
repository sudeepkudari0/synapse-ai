/**
 * Tailor Panel — Resume tailoring + cover letter generation
 * Uses ported cv-tailor core logic via the Electron LLM adapter.
 */

import { useState, useEffect } from "react";
import { useJobStore } from "../../career/state/career-store";
import { useTailoringStore } from "../../career/state/career-store";
import { ElectronLLMProvider } from "../../career/core/llm-adapter";
import { ResumeEditor } from "../../career/core/resumeEditor";
import { CoverLetterGenerator } from "../../career/core/coverLetter";
import {
  generateResumePDF,
  buildFilename,
} from "../../career/core/pdfGenerator";
import type { MasterResume, Job } from "../../career/core/types";

export function TailorPanel() {
  const { jobs, updateJob } = useJobStore();
  const savedJobs = jobs.filter((j) => j.status === "saved");

  const {
    masterResume,
    isGenerating,
    generatingStatus,
    error,
    setMasterResume,
    setMasterResumeYaml,
    setMasterResumeText,
    setIsGenerating,
    setGeneratingStatus,
    setError,
    reset,
  } = useTailoringStore();

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  // Load master resume from electron store on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await (
          window as any
        ).electronAPI?.careerHub?.loadProfile?.();
        if (data?.masterResumeYaml) {
          setMasterResumeYaml(data.masterResumeYaml);
          setMasterResumeText(data.masterResumeText || "");
          const { load } = await import("js-yaml");
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
        const { load } = await import("js-yaml");
        const parsed = load(text) as MasterResume;
        setMasterResume(parsed);
        (window as any).electronAPI?.careerHub?.saveProfile?.({
          masterResumeYaml: text,
          masterResumeText: "",
        });
        setError(null);
      } catch (err: any) {
        setError("Invalid YAML file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const processJob = async (job: Job) => {
    if (!masterResume) throw new Error("Master resume is missing");

    const provider = new ElectronLLMProvider();
    const resumeEditor = new ResumeEditor(provider);
    const coverLetterGen = new CoverLetterGenerator(provider);

    let jd = job.description || job.fullDescription || "";

    // Fetch JD if too short
    if (jd.length < 200 && job.url) {
      if (!(window as any).electronAPI?.careerHub?.fetchUrl) {
        throw new Error(
          "Backend update required: Please completely restart the Synapse AI app.",
        );
      }
      setGeneratingStatus("Fetching job page...");
      const fetchRes = await (window as any).electronAPI.careerHub.fetchUrl(
        job.url,
      );
      if (fetchRes?.success && fetchRes.html) {
        setGeneratingStatus("Extracting job description...");
        const html = fetchRes.html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ");

        const extractPrompt = `You are a job description extractor. Extract ONLY the job description (responsibilities, requirements, qualifications, etc.) from the following text. Do not include headers, footers, or navigation links.\n\nTEXT:\n${html.substring(0, 30000)}`;
        const jdExtractedResponse = await provider.generate(extractPrompt, {
          systemPrompt: "You are an expert recruiter.",
          temperature: 0.1,
        });
        const jdExtracted = jdExtractedResponse.content;

        if (jdExtracted && jdExtracted.length > 50) {
          jd = jdExtracted;
          updateJob(job.id, { description: jdExtracted });
        }
      }
    }

    if (!jd.trim()) {
      throw new Error("Could not find or extract Job Description.");
    }

    setGeneratingStatus("Analyzing job description...");
    const { resume } = await resumeEditor.optimize(
      masterResume,
      jd,
      job.title,
      job.company,
    );

    setGeneratingStatus("Generating cover letter...");
    const letter = await coverLetterGen.generate(
      job.company,
      job.title,
      jd,
      resume,
    );

    // Save outputs directly to the job object for persistence
    updateJob(job.id, {
      tailoredResumeText: resume,
      coverLetterText: letter,
    });
  };

  const handleTailorJob = async (job: Job) => {
    if (!masterResume) {
      setError("Please upload your master resume YAML first");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setActiveJobId(job.id);
    reset();
    setIsGenerating(true);
    setError(null);

    try {
      await processJob(job);
      setGeneratingStatus("");
    } catch (err: any) {
      setError(err.message || "Generation failed");
      setGeneratingStatus("");
    } finally {
      setIsGenerating(false);
      setActiveJobId(null);
    }
  };

  const handleTailorAll = async () => {
    if (!masterResume) {
      setError("Please upload your master resume YAML first");
      return;
    }

    // Only tailor jobs that don't already have a resume/cover letter
    const jobsToProcess = savedJobs.filter(
      (j) => !j.tailoredResumeText || !j.coverLetterText,
    );

    if (jobsToProcess.length === 0) {
      alert("All saved jobs are already tailored!");
      return;
    }

    reset();
    setIsGenerating(true);
    setError(null);

    try {
      for (const job of jobsToProcess) {
        setActiveJobId(job.id);
        await processJob(job);
      }
      setGeneratingStatus("");
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setIsGenerating(false);
      setActiveJobId(null);
    }
  };

  const handleCopy = (jobId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccessId(jobId);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const handleDownloadPDF = async (resumeText: string) => {
    if (!resumeText || !masterResume) return;
    try {
      const filename = buildFilename(masterResume.name);
      await generateResumePDF(resumeText, filename, masterResume);
    } catch (err: any) {
      setError("PDF generation failed: " + err.message);
    }
  };

  return (
    <div className="tailor-panel js-dashboard">
      {/* Header section */}
      <div
        className="js-header"
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 className="js-header-title">✨ Tailor CV & Apply</h2>
          <p className="js-header-subtitle">
            Extract JDs, automatically tailor your Master Resume, and generate
            Cover Letters instantly.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label
            className="js-btn-view"
            style={{ cursor: "pointer", background: "rgba(255,255,255,0.05)" }}
          >
            📄 {masterResume ? "Update Master Resume" : "Upload Master Resume"}
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleYamlUpload}
              hidden
            />
          </label>

          <button
            className={`js-btn-primary ${isGenerating ? "tailor-generating" : ""}`}
            onClick={handleTailorAll}
            disabled={isGenerating || savedJobs.length === 0 || !masterResume}
          >
            Tailor All
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="js-error-card" style={{ marginBottom: "24px" }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Saved Jobs Grid */}
      <div className="js-glass-panel" style={{ marginBottom: "24px" }}>
        <div className="js-results-header">
          <h3 className="js-results-title">Saved Jobs Ready for Tailoring</h3>
        </div>

        {savedJobs.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.5)",
            }}
          >
            <p>
              No saved jobs found. Search for jobs and save them to see them
              here.
            </p>
          </div>
        ) : (
          <div className="js-results-grid">
            {savedJobs.map((job) => {
              const isProcessing = isGenerating && activeJobId === job.id;
              const isTailored =
                !!job.tailoredResumeText || !!job.coverLetterText;

              return (
                <div
                  key={job.id}
                  className="js-result-card"
                  style={{
                    border: isProcessing
                      ? "1px solid rgba(96, 165, 250, 0.5)"
                      : isTailored
                        ? "1px solid rgba(74, 222, 128, 0.3)"
                        : undefined,
                  }}
                >
                  <div className="js-result-site-badge">
                    {job.source || "Saved"}
                  </div>

                  <h4 className="js-result-title" title={job.title}>
                    {job.title}
                  </h4>
                  <div className="js-result-company">🏢 {job.company}</div>

                  <div className="js-result-meta">
                    {job.location && (
                      <span className="js-result-tag">📍 {job.location}</span>
                    )}
                    {job.isRemote && (
                      <span
                        className="js-result-tag"
                        style={{
                          color: "#4ade80",
                          borderColor: "rgba(74, 222, 128, 0.3)",
                        }}
                      >
                        🏠 Remote
                      </span>
                    )}
                  </div>

                  <div className="js-result-spacer"></div>

                  <div
                    className="js-result-actions"
                    style={{ marginTop: "16px" }}
                  >
                    <button
                      className={`js-btn-primary ${isProcessing ? "tailor-generating" : ""}`}
                      onClick={() => handleTailorJob(job)}
                      disabled={isGenerating}
                      style={{
                        width: "100%",
                        justifyContent: "center",
                        background: isTailored
                          ? "rgba(255, 255, 255, 0.1)"
                          : undefined,
                        color: isTailored ? "#cbd5e1" : undefined,
                      }}
                    >
                      {isProcessing ? (
                        <span
                          className="tailor-loading"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span className="tailor-spinner" />
                          {generatingStatus || "Processing..."}
                        </span>
                      ) : isTailored ? (
                        "Re-Tailor"
                      ) : (
                        "Tailor"
                      )}
                    </button>

                    {job.tailoredResumeText && (
                      <button
                        className="js-btn-primary"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          marginTop: "8px",
                          background: "#3b82f6",
                          borderColor: "#2563eb",
                        }}
                        onClick={() =>
                          handleDownloadPDF(job.tailoredResumeText!)
                        }
                      >
                        Download PDF
                      </button>
                    )}

                    {job.coverLetterText && (
                      <button
                        className="js-btn-view"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          marginTop: "8px",
                          background: "rgba(74, 222, 128, 0.15)",
                          color: "#4ade80",
                          borderColor: "rgba(74, 222, 128, 0.3)",
                        }}
                        onClick={() => handleCopy(job.id, job.coverLetterText!)}
                      >
                        {copySuccessId === job.id ? "✓ Copied!" : "Copy Letter"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
