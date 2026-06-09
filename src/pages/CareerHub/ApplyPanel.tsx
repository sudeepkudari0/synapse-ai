/**
 * Apply Panel — Auto-Apply Dashboard
 * Orchestrates autonomous applications via Claude Code.
 */

import { useState, useEffect, useRef } from "react";
import { useJobStore, useTailoringStore } from "../../career/state/career-store";
import { generateResumePDFBlob } from "../../career/core/pdfGenerator";
import {
  Building2,
  MapPin,
  Sparkles,
  Play,
  Eye,
  AlertTriangle,
  Terminal,
  StopCircle,
  KeyRound,
  FileText,
  DollarSign
} from "lucide-react";

interface StatusLog {
  timestamp: string;
  text: string;
}

export function ApplyPanel() {
  const { jobs, updateJob } = useJobStore();
  const { masterResume } = useTailoringStore();

  const [settings, setSettings] = useState<any>(null);
  const [capsolverKey, setCapsolverKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Filter for jobs that have tailoredResumeText and are in saved state
  const readyJobs = jobs.filter(
    (j) => j.status === "saved" && j.tailoredResumeText
  );

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState(false);
  const [agentStatus, setAgentStatus] = useState<
    "idle" | "running" | "applied" | "expired" | "captcha" | "login_issue" | "failed" | "stopped"
  >("idle");
  const [currentStep, setCurrentStep] = useState("");
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"monitor" | "raw">("monitor");
  const [cost, setCost] = useState(0);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Load app settings to get/set CapSolver key
  useEffect(() => {
    (async () => {
      try {
        const res = await (window as any).electronAPI?.getSettings?.();
        if (res?.success && res.settings) {
          setSettings(res.settings);
          setCapsolverKey(res.settings.capsolverApiKey || "");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    })();
  }, []);

  // Set up status event listener for auto-apply streams
  useEffect(() => {
    if (!(window as any).electronAPI?.careerHub?.onApplyStatus) return;

    const unsubscribe = (window as any).electronAPI.careerHub.onApplyStatus(
      (eventData: {
        status: string;
        action?: string;
        log?: string;
        rawLog?: string;
        cost?: number;
      }) => {
        if (eventData.status) {
          setAgentStatus(eventData.status as any);
        }
        if (eventData.action) {
          setCurrentStep(eventData.action);
          appendLog(`[STEP] ${eventData.action}`);
        }
        if (eventData.log) {
          appendLog(eventData.log);
        }
        if (eventData.rawLog) {
          setRawLogs((prev) => [...prev, eventData.rawLog!]);
        }
        if (eventData.cost !== undefined) {
          setCost(eventData.cost);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Scroll to bottom of logs on update
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, rawLogs, activeTab]);

  const appendLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, text }]);
  };

  const stripAnsi = (str: string) => {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
  };

  const handleSaveKey = async () => {
    if (!settings) return;
    setIsSavingKey(true);
    try {
      const updated = await (window as any).electronAPI?.updateSettings?.({
        ...settings,
        capsolverApiKey: capsolverKey,
      });
      if (updated?.success) {
        setSettings(updated.settings);
        appendLog(`[SYSTEM] CapSolver API key updated.`);
      }
    } catch (e) {
      console.error(e);
      appendLog(`[SYSTEM] Error updating CapSolver key.`);
    } finally {
      setIsSavingKey(false);
    }
  };

  const startApplication = async (job: any, dryRun = false) => {
    if (!masterResume) {
      alert("Please upload your master resume in the Tailor CV tab first.");
      return;
    }
    if (!job.tailoredResumeText) {
      alert("This job does not have a tailored resume. Tailor it first.");
      return;
    }

    setActiveJobId(job.id);
    setIsDryRun(dryRun);
    setAgentStatus("running");
    setCurrentStep("Compiling tailored resume PDF...");
    setLogs([]);
    setRawLogs([]);
    setCost(0);

    appendLog(`[SYSTEM] Launching apply agent for "${job.title}" at "${job.company}"`);
    appendLog(`[SYSTEM] Dry-run mode: ${dryRun ? "ENABLED (Will review but NOT submit)" : "DISABLED (Full Auto-Submit)"}`);

    try {
      // 1. Generate resume PDF Blob
      const blob = await generateResumePDFBlob(
        job.tailoredResumeText,
        masterResume
      );

      // 2. Convert Blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(",")[1];

        // 3. Launch IPC run
        const res = await (window as any).electronAPI.careerHub.runApply({
          job: {
            url: job.url,
            title: job.title,
            company: job.company,
            salary: job.salary,
          },
          resumePdfBase64: base64data,
          resumeText: job.tailoredResumeText,
          coverLetterText: job.coverLetterText || "",
          dryRun,
        });

        if (res?.success) {
          const finalStatus = res.data?.status || "applied";
          const msg = res.data?.message || "Finished application";
          
          // Update status in frontend store
          if (finalStatus === "applied") {
            updateJob(job.id, {
              status: "applied",
              appliedAt: new Date().toISOString(),
            });
          }
          
          setAgentStatus(finalStatus);
          setCurrentStep(msg);
          appendLog(`[SYSTEM] Complete. Status: ${finalStatus.toUpperCase()} - ${msg}`);
        } else {
          setAgentStatus("failed");
          setCurrentStep(res?.error || "Agent execution failed");
          appendLog(`[SYSTEM] Error: ${res?.error || "Execution failed"}`);
        }
      };
    } catch (err: any) {
      console.error(err);
      setAgentStatus("failed");
      setCurrentStep(err.message || "Failed starting runner");
      appendLog(`[SYSTEM] Error: ${err.message || "Failed starting runner"}`);
    }
  };

  const handleStopAgent = async () => {
    appendLog("[SYSTEM] Stopping agent...");
    try {
      const res = await (window as any).electronAPI.careerHub.stopApply();
      if (res?.success) {
        setAgentStatus("stopped");
        setCurrentStep("Stopped by user");
        appendLog("[SYSTEM] Agent terminated successfully.");
      }
    } catch (e) {
      console.error(e);
      appendLog("[SYSTEM] Failed to stop agent cleanly.");
    }
  };

  return (
    <div className="apply-panel space-y-6">
      {/* Disclaimer / Setup Notice */}
      <div className="bg-amber-950/35 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-200">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-amber-300">Prerequisites & Authentication</p>
          <p>
            This runner automates form filling by orchestrating Claude Code. Ensure you have run{" "}
            <code className="bg-amber-950/60 px-1.5 py-0.5 rounded font-mono text-xs text-amber-400">
              claude login
            </code>{" "}
            in your terminal first. When running, browser windows will pop up so you can monitor progress.
          </p>
        </div>
      </div>

      {/* Top Options Bar (CapSolver Configuration) */}
      <div className="bg-[#12121e]/80 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">CapSolver Configuration</h3>
            <p className="text-xs text-slate-400">Used for autonomous CAPTCHA solving</p>
          </div>
        </div>
        <div className="flex items-center gap-2 max-w-md w-full">
          <input
            type="password"
            placeholder="Capsolver API Key..."
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-slate-200 focus:outline-none focus:border-indigo-500"
            value={capsolverKey}
            onChange={(e) => setCapsolverKey(e.target.value)}
          />
          <button
            onClick={handleSaveKey}
            disabled={isSavingKey}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50"
          >
            {isSavingKey ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Split layout: Queue and Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Job Queue (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Ready Queue</span>
            <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full font-normal">
              {readyJobs.length} jobs
            </span>
          </h2>

          {readyJobs.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-xl p-8 text-center text-slate-400 space-y-3">
              <FileText className="w-8 h-8 mx-auto text-slate-500" />
              <p className="text-sm">No tailored CVs ready for application.</p>
              <p className="text-xs text-slate-500">
                Go to <strong>Tailor CV</strong> and generate a tailored resume for your saved jobs.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {readyJobs.map((job) => (
                <div
                  key={job.id}
                  className={`p-4 bg-[#12121e]/80 border rounded-xl transition ${
                    activeJobId === job.id
                      ? "border-indigo-500 shadow-lg shadow-indigo-500/5"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <h4 className="font-semibold text-white text-sm line-clamp-1">{job.title}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{job.company}</span>
                        <span className="text-slate-600">•</span>
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{job.location}</span>
                      </p>
                    </div>

                    {job.fitScore !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          job.fitScore >= 8
                            ? "bg-green-500/10 text-green-400"
                            : job.fitScore >= 6
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        {job.fitScore}/10
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    <button
                      onClick={() => startApplication(job, true)}
                      disabled={agentStatus === "running"}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Dry Run
                    </button>
                    <button
                      onClick={() => startApplication(job, false)}
                      disabled={agentStatus === "running"}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Auto Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Console/Status Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <span>Agent Monitor</span>
            </h2>
            {agentStatus === "running" && (
              <button
                onClick={handleStopAgent}
                className="flex items-center gap-1.5 py-1 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition animate-pulse"
              >
                <StopCircle className="w-4 h-4" />
                Cancel Agent
              </button>
            )}
          </div>

          <div className="border border-white/5 rounded-xl bg-[#0a0a0f] overflow-hidden flex flex-col h-[550px] shadow-2xl">
            {/* Terminal Header & Tabs */}
            <div className="px-4 py-2 bg-[#111119] border-b border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("monitor")}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeTab === "monitor"
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Agent Monitor
                </button>
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeTab === "raw"
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Raw CLI Console
                </button>
              </div>
              <div className="flex items-center gap-4 text-slate-400">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      agentStatus === "running"
                        ? "bg-blue-500 animate-ping"
                        : agentStatus === "applied"
                        ? "bg-green-500"
                        : agentStatus === "idle"
                        ? "bg-slate-500"
                        : "bg-rose-500"
                    }`}
                  />
                  <span className="font-semibold text-slate-400 capitalize">
                    {agentStatus === "running"
                      ? `Running: ${isDryRun ? "Dry Run" : "Live Apply"}`
                      : agentStatus}
                  </span>
                </div>
                {cost > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>${cost.toFixed(3)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Current Step Tracker */}
            {currentStep && (
              <div className="px-4 py-2 bg-indigo-950/20 border-b border-white/5 text-xs text-indigo-300 font-medium">
                Current: {currentStep}
              </div>
            )}

            {/* Logs Body */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-2 select-text selection:bg-indigo-500/35 selection:text-white">
              {activeTab === "monitor" ? (
                logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 text-center p-8">
                    <Terminal className="w-8 h-8 text-slate-800" />
                    <p>Console is silent. Trigger a job from the queue to start streaming logs.</p>
                  </div>
                ) : (
                  logs.map((log, index) => {
                    let textClass = "text-slate-300";
                    if (log.text.startsWith("[SYSTEM]")) {
                      textClass = "text-indigo-400 font-bold";
                    } else if (log.text.startsWith("[STEP]")) {
                      textClass = "text-emerald-400 font-bold";
                    } else if (log.text.includes("RESULT:APPLIED")) {
                      textClass = "text-green-400 font-bold bg-green-950/20 p-1 rounded border border-green-500/20";
                    } else if (log.text.includes("RESULT:FAILED")) {
                      textClass = "text-rose-400 font-bold bg-rose-950/20 p-1 rounded border border-rose-500/20";
                    } else if (log.text.startsWith("Error")) {
                      textClass = "text-rose-400";
                    }

                    return (
                      <div key={index} className="flex gap-2 items-start">
                        <span className="text-slate-600 select-none shrink-0">[{log.timestamp}]</span>
                        <span className={`${textClass} break-words whitespace-pre-wrap flex-1`}>
                          {log.text}
                        </span>
                      </div>
                    );
                  })
                )
              ) : (
                rawLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 text-center p-8">
                    <Terminal className="w-8 h-8 text-slate-800" />
                    <p>No raw terminal output captured yet.</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-zinc-300 select-text leading-tight font-mono">
                    {stripAnsi(rawLogs.join(""))}
                  </pre>
                )
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
