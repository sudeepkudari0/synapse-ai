# Synapse AI — Implementation Plan (Part 2)
## Phases 4-6: Advanced Features, Interview-Specific, Polish

> This continues from `docs/IMPLEMENTATION_PLAN.md`. Same progress legend applies.

---

## Phase 4: Code & Screen Intelligence

> **Goal:** Best-in-class support for technical/coding interviews.

### 4.1 Code Interview Assistant (Feature F8)
> Real-time algorithm detection and coding help from screen captures.

- [x] **4.1.1** Create `src/lib/prompts/templates/code-analysis.ts`
  - Vision-specific prompt for coding interviews
  - Extract: problem statement, constraints, examples
  - Classify: problem type (DP, graphs, trees, arrays, strings, etc.)
  - Output: optimal algorithm, time/space complexity, pseudocode, edge cases
- [x] **4.1.2** Add "Code Mode" toggle in widget header
  - When active: screen capture uses coding-specific prompts
  - Changes capture shortcut behavior to use code analysis pipeline
- [x] **4.1.3** Modify `handleCaptureScreen` in App.tsx to branch on Code Mode
  - Code Mode ON → use code-analysis prompt template
  - Code Mode OFF → use existing general analysis prompt
- [x] **4.1.4** Modify `AnswerPanel.tsx` to render code blocks with syntax highlighting
  - Use `<pre><code>` with CSS-based highlighting (no external library)
  - Or lightweight lib if needed: Prism.js (~6KB)
- [x] **4.1.5** Add "Auto-Capture" option in Code Mode
  - Captures screen every 30 seconds automatically
  - Detects if content changed before re-analyzing (basic image diff)
  - Toggle in settings: "Auto-capture in Code Mode" (default: off)
- [x] **4.1.6** Test: Open a LeetCode problem → enable Code Mode → capture → verify algorithm suggestion

### 4.2 Enhanced Screen Capture
> Region selection and prompted analysis.

- [ ] **4.2.1** Create `src/components/RegionSelector/RegionSelector.tsx`
  - Transparent fullscreen overlay for drag-to-select region
  - Canvas-based crop tool
  - Returns cropped image as base64
- [ ] **4.2.2** Add "Region Capture" option alongside full-screen capture
  - New hotkey: Ctrl+Shift+A for region capture
- [ ] **4.2.3** Add optional text prompt input before capture analysis
  - Small input box: "What should I analyze?" (optional, default: auto-analyze)
  - Passes user's prompt to the vision LLM for targeted analysis
- [ ] **4.2.4** Register new global shortcut in `ipc-handlers.ts`
- [ ] **4.2.5** Test: Region capture → select area → add custom prompt → verify targeted analysis

---

## Phase 5: Interview-Specific Features

> **Goal:** Deep specialization for each interview type.

### 5.1 Behavioral Interview Enhancements
> Story bank and authenticity guard.

- [ ] **5.1.1** Add `stories[]` to user profile
  - Each story: `{ title, situation, task, action, result, tags[], metrics[] }`
  - Example tags: leadership, conflict, failure, teamwork, innovation
- [ ] **5.1.2** Create `src/components/SettingsPanel/StoryBank.tsx`
  - CRUD interface for career stories
  - Tag assignment per story
  - "Auto-generate from resume" button (LLM extracts potential stories from resume text)
- [ ] **5.1.3** Modify behavioral prompt template to include story bank
  - Prompt: "Match the question to the most relevant story from the candidate's story bank"
  - If no matching story: generate a generic STAR answer but flag it as "⚠️ No matching story — consider preparing one"
- [ ] **5.1.4** Add authenticity guard: post-generation check
  - If generated answer contains claims not in resume or story bank, add footnote: "⚠️ Verify: this detail isn't in your profile"
- [ ] **5.1.5** Test: Add 3 stories → ask behavioral question → verify answer maps to relevant story

### 5.2 System Design Enhancements
> Phase tracking and estimation helpers.

- [ ] **5.2.1** Create `src/lib/system-design-helper.ts`
  - `detectPhase(transcript: string): 'requirements' | 'estimation' | 'high-level' | 'deep-dive' | 'trade-offs'`
  - Keyword-based phase detection from conversation flow
- [ ] **5.2.2** Add phase indicator in overlay when system-design type is detected
  - Shows: "📐 Phase: High-Level Design" with suggested transition prompts
- [ ] **5.2.3** Create estimation helper functions
  - `estimateQPS(users, actionsPerDay)`, `estimateStorage(recordSize, recordsPerDay, retentionYears)`
  - Triggered when estimation-related keywords detected in transcript
  - Shows quick calculation in a tooltip/popover
- [ ] **5.2.4** Modify system-design prompt to include "suggest components" based on problem type
  - Auto-suggest: load balancer, cache, message queue, CDN, database type based on requirements
- [ ] **5.2.5** Test: Mock system design conversation → verify phase detection and component suggestions

### 5.3 HR/Screening Enhancements
> Salary handling and red flag framing.

- [ ] **5.3.1** Add salary preferences to profile
  - Fields: `currentSalary`, `targetSalary`, `negotiationStrategy: 'deflect' | 'anchor-high' | 'market-rate'`
- [ ] **5.3.2** Create salary question detector in `interview-classifier.ts`
  - Detect: compensation, salary, pay, package, benefits, equity
  - When detected: switch to salary-specific prompt with user's strategy
- [ ] **5.3.3** Add red-flag question detector
  - Detect: gap in resume, why did you leave, fired, terminated, short tenure
  - Auto-switch to diplomatic framing prompt
- [ ] **5.3.4** Enforce conciseness in HR prompts: hard limit at 150 words
- [ ] **5.3.5** Test: "What are your salary expectations?" → verify deflection/anchoring based on setting

### 5.4 Company-Specific Prep Database (Feature F10)
> Curated interview patterns per company.

- [ ] **5.4.1** Create `src/data/companies/` directory
  - JSON files per company: `amazon.json`, `google.json`, `meta.json`, `microsoft.json`, `apple.json`
  - Schema: `{ name, values[], interviewStructure, commonQuestions[], evaluationCriteria[], tips[] }`
- [ ] **5.4.2** Create initial data for top 10 companies
  - Amazon (16 Leadership Principles), Google (Googleyness, L3-L7 expectations), Meta (move fast values), Microsoft (growth mindset), Apple (secrecy/attention to detail)
  - Plus: Netflix, Stripe, Uber, Airbnb, LinkedIn
- [ ] **5.4.3** Create `src/lib/company-context.ts`
  - `getCompanyContext(companyName: string): CompanyData | null`
  - Fuzzy matching on company name from profile
- [ ] **5.4.4** Integrate company context into prompt templates
  - When company is set: inject values, evaluation criteria, and tips into system prompt
- [ ] **5.4.5** Allow user to add custom company data in Settings
- [ ] **5.4.6** Test: Set target company to "Amazon" → behavioral question → verify LP alignment in answer

---

## Phase 6: Advanced & Polish

> **Goal:** Scoring, multi-language, and production polish.

### 6.1 Interview Simulation with Scoring (Feature F12)
> Structured mock interviews with objective scoring.

- [ ] **6.1.1** Extend practice mode with scoring calibration
  - Score dimensions: completeness (1-10), structure (1-10), specificity (1-10), relevance (1-10), communication (1-10)
  - Overall score: weighted average
- [ ] **6.1.2** Create `src/lib/scoring-engine.ts`
  - `scoreAnswer(question, spokenAnswer, interviewType, profile): Promise<AnswerScore>`
  - Uses evaluator prompt template
  - Returns per-dimension scores + overall + specific feedback
- [ ] **6.1.3** Create progress tracking across sessions
  - Store scores in `userData/synapse-data/progress/{interviewType}.json`
  - Track: average score over time, weakest dimensions, most improved areas
- [ ] **6.1.4** Create `src/components/PracticeMode/ProgressDashboard.tsx`
  - Shows score trends over last 10 sessions per interview type
  - Highlights weakest areas with suggested focus drills
  - Simple text-based charts (no charting library)
- [ ] **6.1.5** Test: Complete 3 practice sessions → verify progress tracking shows trends

### 6.2 Multi-Language Support (Feature F11)
> Support non-English interviews and ESL candidates.

- [ ] **6.2.1** Add language preference to settings
  - `interviewLanguage: string` (default: 'en')
  - `isESLMode: boolean` (default: false)
- [ ] **6.2.2** Modify whisper model loading to support multilingual models
  - When language is not 'en': use `ggml-base.bin` (multilingual) instead of `ggml-small.en.bin`
  - Add language parameter to whisper server transcription request
- [ ] **6.2.3** Add ESL mode prompt modifier
  - When ESL: append to prompts "Use simple vocabulary. Avoid idioms. Suggest pronunciation-safe word alternatives for technical terms."
- [ ] **6.2.4** Add grammar check mode
  - Analyze user's transcript for common ESL grammar errors
  - Show gentle suggestions: "Consider: 'I managed' instead of 'I was managing'"
- [ ] **6.2.5** Test: Enable ESL mode → verify simpler vocabulary in generated answers

### 6.3 Export & Sharing
> Get data out of the app in useful formats.

- [ ] **6.3.1** Session export to Markdown
  - Full transcript with speaker labels
  - All Q&A pairs
  - Delivery metrics summary
  - One-click "Copy to Clipboard" or "Save as .md"
- [ ] **6.3.2** Session export to PDF (optional, lower priority)
  - Use simple HTML-to-PDF generation via Electron's `printToPDF`
- [ ] **6.3.3** Practice progress export
  - Export scoring history as CSV or markdown table
- [ ] **6.3.4** Test: Export a session → verify markdown is clean and complete

### 6.4 UX Polish & Performance
> Final polish pass before considering it "v2.0 complete."

- [ ] **6.4.1** Keyboard shortcut for every major action
  - Document all shortcuts in a "Shortcuts" section in Settings
  - Make shortcuts customizable (store in settings)
- [ ] **6.4.2** Answer generation latency optimization
  - Profile time from question detection to first token
  - Target: under 3 seconds end-to-end
  - If slow: reduce context window, use smaller classification model
- [ ] **6.4.3** Memory usage audit
  - Profile Electron app memory during 1-hour session
  - Fix any memory leaks (especially in audio buffers and transcript accumulation)
  - Target: under 300MB renderer process
- [ ] **6.4.4** Error recovery
  - Whisper server crash → auto-restart with backoff
  - Ollama not running → clear error message with "Start Ollama" instructions
  - Session save failure → retry + user notification
- [ ] **6.4.5** Onboarding flow for first-time users
  - First launch: guided setup (paste resume, select model, test connection)
  - Skip option for experienced users

---

## Implementation Order Summary

```
Phase 1 (Foundation)     → Do first, enables everything else
  1.1 Zustand migration
  1.2 Prompt templates
  1.3 Storage layer
  1.4 Settings migration

Phase 2 (Core Intel)     → Highest impact on answer quality
  2.1 Resume context     ← START HERE after Phase 1
  2.2 Interview classifier
  2.3 Smart question detection
  2.4 Session persistence
  2.5 Follow-up predictor

Phase 3 (Coaching)       → Transforms from tool to coach
  3.1 STAR frameworks
  3.2 Delivery analytics
  3.3 Practice mode

Phase 4 (Code Intel)     → Technical interview support
  4.1 Code assistant
  4.2 Enhanced capture

Phase 5 (Specialization) → Deep interview-type features
  5.1 Behavioral stories
  5.2 System design helper
  5.3 HR/salary handling
  5.4 Company database

Phase 6 (Polish)         → Production readiness
  6.1 Scoring engine
  6.2 Multi-language
  6.3 Export
  6.4 UX polish
```

---

## How to Resume in a New Conversation

Paste this to the AI:

```
I'm building Synapse AI — read these files for full context:
1. docs/IMPLEMENTATION_PLAN.md (progress tracker — check the checkboxes)
2. docs/IMPLEMENTATION_PLAN_PART2.md (phases 4-6)
3. docs/strategy/ (full strategic analysis)

Continue from the first unchecked [ ] item in the implementation plan.
The codebase is an Electron + React + Vite + TypeScript app.
Key files: src/App.tsx, electron/main/ipc-handlers.ts, src/hooks/useLLM.ts
State management: Zustand. LLM: Ollama (qwen3-vl:2b). STT: Whisper.cpp CUDA server.
```

---

> **Total tasks: 89** across 6 phases. Each task is atomic and independently testable.
