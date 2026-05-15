# Synapse AI — Master Implementation Plan

> **Purpose:** This is the single source of truth for all planned work. If a conversation is lost, provide this file to the AI and say "continue from where we left off." The AI will read the checkboxes and resume from the first unchecked item.
>
> **Strategy docs:** See `docs/strategy/part1-4` for full analysis, competitor research, and rationale.
>
> **Last updated:** 2026-05-15

---

## Project Context (For New Conversations)

**What is Synapse AI?**
An Electron desktop app that acts as a real-time AI interview copilot. It overlays transparently on screen, transcribes interviews using local Whisper.cpp (CUDA), separates speaker audio (user vs interviewer) via Silero VAD, auto-detects questions, and generates AI answers via Ollama (local) with Gemini/Groq cloud fallback.

**Tech stack:** Electron 33 + React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Whisper.cpp (CUDA server) + Ollama (qwen3-vl:2b) + Silero VAD v5

**Key directories:**
```
electron/main/          → Electron main process (IPC, whisper, LLM, window, settings)
electron/preload/       → IPC bridge
src/                    → React renderer (components, hooks, state, lib)
src/components/         → FloatingWidget, ChatPanel, SettingsPanel, shared, ui
src/hooks/              → useDrag, useLLM, useMixedAudioRecorder, useWhisper
src/lib/                → logger, transcript-stabilizer, utils
docs/strategy/          → Strategic analysis (4 parts)
```

**Current capabilities:** Real-time transcription, speaker separation, auto question detection (regex), AI answer generation (generic prompts), screen capture + vision analysis, session timer, global hotkeys, content protection.

**Current limitations:** No personal context (resume/JD), no interview-type awareness, fragile question detection, zero session persistence, generic prompts, no delivery analytics, no practice mode.

---

## Progress Legend

- `[ ]` = Not started
- `[~]` = In progress
- `[x]` = Complete
- `[!]` = Blocked (see notes)

---

## Phase 1: Architecture Foundation

> **Goal:** Refactor core architecture to support all future features without tech debt.

### 1.1 State Management — Zustand Migration
> Extract all state from App.tsx (451 lines) into dedicated Zustand stores.

- [x] **1.1.1** Install Zustand: `bun add zustand`
- [x] **1.1.2** Create `src/state/session-store.ts`
  - State: `conversation`, `isRecording`, `sessionTime`, transcription queue refs
  - Actions: `startSession`, `stopSession`, `addChatBlock`, `clearTranscript`
- [x] **1.1.3** Create `src/state/answer-store.ts`
  - State: `answers`, `currentAnswerIndex`, `isGenerating`
  - Actions: `addAnswer`, `updateAnswer`, `navigateAnswer`, `clearAnswers`
- [x] **1.1.4** Create `src/state/ui-store.ts`
  - State: `isExpanded`, `isSettingsOpen`, `isChatOpen`, `isCapturing`
  - Actions: `toggleExpanded`, `toggleSettings`, `toggleChat`
- [x] **1.1.5** Create `src/state/profile-store.ts`
  - State: `resume`, `jobDescription`, `targetCompany`, `targetRole`, `skills[]`
  - Actions: `updateProfile`, `loadProfile`, `clearProfile`
- [x] **1.1.6** Refactor `App.tsx` to consume Zustand stores instead of local useState/useRef
  - Target: App.tsx should be under 100 lines after refactor
- [x] **1.1.7** Verify all existing functionality works identically after migration

### 1.2 Prompt Template Engine
> Centralized prompt system that swaps templates based on interview type.

- [x] **1.2.1** Create `src/lib/prompts/types.ts`
  - Define `InterviewType` enum: `behavioral`, `technical`, `system-design`, `coding`, `hr-screening`, `case-study`, `general`
  - Define `PromptContext` interface: `{ interviewType, resume?, jobDescription?, company?, conversationHistory, currentQuestion }`
  - Define `PromptTemplate` interface: `{ system: string, user: string }`
- [x] **1.2.2** Create `src/lib/prompts/templates/behavioral.ts`
  - STAR-formatted system prompt
  - Insists on Situation/Task/Action/Result headers
  - Limits answer to ~300 words (2 min speaking time)
  - Injects resume context for story matching
- [x] **1.2.3** Create `src/lib/prompts/templates/technical.ts`
  - Problem → Approach → Key Points → Edge Cases format
  - Technically precise, uses candidate's skill set
- [x] **1.2.4** Create `src/lib/prompts/templates/system-design.ts`
  - Requirements → Estimation → High-Level → Deep Dive → Trade-offs
  - Suggests specific technologies
  - Includes estimation helpers
- [x] **1.2.5** Create `src/lib/prompts/templates/coding.ts`
  - Algorithm classification + complexity analysis
  - Pseudocode + clean code output
  - Edge case enumeration
- [x] **1.2.6** Create `src/lib/prompts/templates/hr-screening.ts`
  - Concise (under 150 words)
  - Professional, positive tone
  - Salary question deflection strategies
- [x] **1.2.7** Create `src/lib/prompts/templates/general.ts`
  - Fallback template (improved version of current generic prompt)
- [x] **1.2.8** Create `src/lib/prompts/index.ts`
  - `getPromptTemplate(context: PromptContext): PromptTemplate` — selector function
  - Applies resume/JD/company modifiers on top of base template
- [x] **1.2.9** Modify `src/hooks/useLLM.ts` to use prompt template engine instead of hardcoded prompts
- [x] **1.2.10** Verify answer generation works with new prompt system

### 1.3 Session Storage Layer
> Filesystem-based JSON storage for sessions, profiles, analytics.

- [x] **1.3.1** Create `electron/main/storage/store.ts`
  - Generic typed CRUD: `read<T>(path)`, `write<T>(path, data)`, `list(dir)`, `delete(path)`
  - All paths relative to `app.getPath('userData')/synapse-data/`
  - Auto-create directories on write
- [x] **1.3.2** Create `electron/main/storage/session-store.ts`
  - `saveSession(session: SessionData): void`
  - `loadSession(id: string): SessionData`
  - `listSessions(): SessionSummary[]`
  - `deleteSession(id: string): void`
  - SessionData: `{ id, startTime, endTime, duration, interviewType, conversation[], answers[], deliveryMetrics?, tags[] }`
- [x] **1.3.3** Create `electron/main/storage/profile-store.ts`
  - `saveProfile(profile: UserProfile): void`
  - `loadProfile(): UserProfile`
  - UserProfile: `{ resume, jobDescription, targetCompany, targetRole, skills[], stories[] }`
- [x] **1.3.4** Register IPC handlers for storage operations in `ipc-handlers.ts`
  - `session:save`, `session:load`, `session:list`, `session:delete`
  - `profile:save`, `profile:load`
- [x] **1.3.5** Update `electron/preload/` to expose new IPC channels
- [x] **1.3.6** Update `electron/types/ipc.ts` with new channel constants

### 1.4 Settings Schema Migration
> Version settings.json so old installs auto-migrate.

- [x] **1.4.1** Add `version: number` field to `AppSettings` interface (default: 1)
- [x] **1.4.2** Create migration runner in `electron/main/settings.ts`
  - `MIGRATIONS` map: version number → transform function
  - On load: run all migrations from current version to latest
- [x] **1.4.3** Create migration v1→v2: add `profile` fields, `interviewType` preference
- [x] **1.4.4** Test: delete settings.json, verify fresh install creates v2 settings

---

## Phase 2: Core Intelligence Features

> **Goal:** Transform answer quality from generic to personalized and interview-aware.

### 2.1 Resume & Job Description Context Engine (Feature F1)
> Every AI answer grounded in user's actual experience.

- [x] **2.1.1** Create `src/components/SettingsPanel/ProfileSection.tsx`
  - Textarea for resume paste (plaintext/markdown)
  - Textarea for job description paste
  - Input fields: target company, target role
  - "Save Profile" button
  - Visual indicator: "Profile loaded ✓" or "No profile set"
- [x] **2.1.2** Create `src/hooks/useProfile.ts`
  - Loads profile from IPC on mount
  - Provides `profile`, `saveProfile`, `isProfileLoaded`
- [x] **2.1.3** Integrate profile into `SettingsPanel` component (add ProfileSection as a tab/section)
- [x] **2.1.4** Modify prompt template engine to inject resume context when available
  - All templates should include resume as grounding context
  - JD should be used to emphasize relevant experience
- [x] **2.1.5** Modify `useLLM.ts` → `generateInterviewAnswer` to load and pass profile context
- [x] **2.1.6** Test: Set profile → ask behavioral question → verify answer references resume details

### 2.2 Interview Type Classifier (Feature F2)
> Auto-detect interview type from conversation and switch prompts dynamically.

- [x] **2.2.1** Create `src/lib/interview-classifier.ts`
  - `classifyQuestion(text: string): InterviewType` — keyword scoring (instant, no LLM)
  - Keyword maps: behavioral words (tell me about a time, describe a situation, conflict, challenge), technical (implement, algorithm, data structure, complexity), system design (design a, scale, architecture, database), HR (salary, why this company, where do you see yourself, strengths/weaknesses), coding (write code, function, solve, output)
  - Confidence threshold: if score is ambiguous, return `general`
- [x] **2.2.2** Create `src/lib/interview-classifier.test.ts` (optional but recommended)
  - Test against 20+ real interview questions per category
- [x] **2.2.3** Integrate classifier into answer generation flow in App.tsx / session-store
  - On question detection → classify → pass type to prompt template engine
  - Store detected type in session state
- [x] **2.2.4** Add visual indicator in overlay header showing detected interview type (small badge)
- [x] **2.2.5** Test: Ask different question types → verify prompt template switches correctly

### 2.3 Smart Question Detection (Feature F4)
> Replace fragile regex with LLM-powered detection.

- [x] **2.3.1** Create `src/lib/question-detector.ts`
  - `isQuestion(text: string, context: string[]): Promise<{isQuestion: boolean, confidence: number}>`
  - Uses a lightweight Ollama call with a classification-only prompt
  - Prompt: "Given this conversation context, is the last statement a question or prompt that expects a response? Reply only YES or NO."
  - Timeout: 500ms max — if LLM doesn't respond, fall back to regex
- [x] **2.3.2** Add configurable setting: `questionDetectionMode: 'regex' | 'llm' | 'hybrid'`
  - `hybrid` (default): try LLM, fall back to regex on timeout
- [x] **2.3.3** Replace regex block in App.tsx (lines 96-109) with new detector
- [x] **2.3.4** Add debounce/cooldown: don't re-trigger if an answer was generated in last 10 seconds
- [x] **2.3.5** Test: "Walk me through your last project." → should detect as question (no `?` present)

### 2.4 Session Persistence (Feature F3)
> Auto-save sessions, browse history, review past interviews.

- [x] **2.4.1** Auto-save session on `stopRecording()`
  - Collect: conversation, answers, sessionTime, detected interviewType, timestamp
  - Save via `session:save` IPC
- [x] **2.4.2** Create `src/components/SessionHistory/SessionHistory.tsx`
  - List of past sessions with: date, duration, interview type, question count
  - Click to expand: full transcript + answers
  - Delete button per session
- [x] **2.4.3** Create `src/components/SessionHistory/SessionDetail.tsx`
  - Full transcript view with speaker labels
  - All Q&A pairs with answers
  - Session metadata (duration, type, timestamp)
- [x] **2.4.4** Add "History" button/tab in widget header (alongside Settings and Chat)
- [x] **2.4.5** Wire up IPC: load session list on History open, load full session on click
- [x] **2.4.6** Add session export: "Copy as Markdown" button that copies full session to clipboard
- [x] **2.4.7** Test: Complete a recording session → stop → reopen app → verify session appears in history

### 2.5 Predictive Follow-Up Engine (Feature F9)
> Show likely follow-up questions after each answer.

- [ ] **2.5.1** Create `src/lib/follow-up-predictor.ts`
  - `predictFollowUps(question: string, answer: string, interviewType: InterviewType): Promise<string[]>`
  - Prompt: "Based on this interview Q&A, what are the 3 most likely follow-up questions? Return only the questions, numbered 1-3."
  - Returns array of 3 predicted follow-ups
- [ ] **2.5.2** Integrate into answer generation flow: after main answer completes, fire follow-up prediction
- [ ] **2.5.3** Add follow-ups display in `AnswerPanel.tsx`
  - Collapsible section below the main answer: "Likely follow-ups ▸"
  - Shows 3 predicted questions
- [ ] **2.5.4** Test: Generate answer → verify follow-ups appear within 2-3 seconds after answer completes

---

## Phase 3: Coaching & Analytics Features

> **Goal:** Transform from "answer generator" to "interview coach."

### 3.1 STAR Framework & Structured Answers (Feature F5)
> Answers formatted for real-time delivery, not reading.

- [ ] **3.1.1** Update behavioral prompt template to enforce STAR with markdown headers
  - Output format: `**Situation:** ...\n**Task:** ...\n**Action:** ...\n**Result:** ...`
- [ ] **3.1.2** Update system-design template to enforce phased structure with headers
- [ ] **3.1.3** Update coding template to enforce Problem/Approach/Code/Complexity structure
- [ ] **3.1.4** Modify `AnswerPanel.tsx` to render markdown properly
  - Parse and render bold headers, bullet points, code blocks
  - Consider lightweight markdown renderer (or manual parsing for performance)
- [ ] **3.1.5** Add "Bullet Points" toggle in AnswerPanel
  - When enabled: prompt appends "Use concise bullet points, not paragraphs"
  - When disabled: full structured answer
- [ ] **3.1.6** Test: Behavioral question → verify STAR headers appear in answer

### 3.2 Delivery Analytics (Feature F6)
> Analyze user's speaking patterns and provide real-time feedback.

- [ ] **3.2.1** Create `src/lib/delivery-analyzer.ts`
  - Input: conversation blocks (user's blocks only)
  - Output: `DeliveryMetrics { fillerWordCount, fillerWords: Map<string,number>, totalWords, avgAnswerDuration, talkTimeRatio, uniqueWordRatio, longestPause }`
  - Filler words list: um, uh, like, you know, basically, actually, literally, right, so, I mean
  - Talk-time ratio: user speaking time / total session time
- [ ] **3.2.2** Create `src/components/DeliveryMetrics/MetricsBar.tsx`
  - Small horizontal bar at bottom of overlay (when recording)
  - Shows: 🎤 Talk: 45% | 📝 Fillers: 12 | ⏱ Avg: 1:45
  - Updates every 10 seconds (not every frame)
- [ ] **3.2.3** Create `src/components/DeliveryMetrics/MetricsReport.tsx`
  - Post-session detailed report
  - Filler word breakdown (which words, how many times)
  - Talk-time chart (simple text-based, no charting library needed)
  - Improvement suggestions based on metrics
- [ ] **3.2.4** Integrate analytics into session save: include `DeliveryMetrics` in saved session data
- [ ] **3.2.5** Add analytics toggle in Settings: "Show delivery metrics during session" (default: on)
- [ ] **3.2.6** Test: Record a session → verify metrics bar shows live data → stop → verify report

### 3.3 Practice Mode — Mock Interviews (Feature F7)
> AI-driven mock interviews for daily practice.

- [ ] **3.3.1** Create `src/state/practice-store.ts`
  - State: `isPracticeMode`, `practiceConfig`, `currentQuestionIndex`, `practiceQuestions[]`, `evaluations[]`
  - PracticeConfig: `{ interviewType, role, company?, questionCount: 5-10 }`
- [ ] **3.3.2** Create `src/lib/prompts/templates/interviewer.ts`
  - System prompt for AI playing interviewer role
  - Generates contextual questions based on resume + interview type + role
  - Adjusts difficulty progressively
- [ ] **3.3.3** Create `src/lib/prompts/templates/evaluator.ts`
  - System prompt for evaluating user's spoken answer
  - Scoring criteria: completeness, structure, specificity, relevance, conciseness
  - Output: score (1-10), strengths, improvements, model answer
- [ ] **3.3.4** Create `src/components/PracticeMode/PracticeSetup.tsx`
  - Select interview type, role, company (optional), question count
  - "Start Practice" button
- [ ] **3.3.5** Create `src/components/PracticeMode/PracticeSession.tsx`
  - Shows current AI question (displayed as text, not spoken)
  - User speaks their answer (uses existing whisper transcription)
  - "Next Question" button or auto-advance after silence
  - Shows AI evaluation after each answer
- [ ] **3.3.6** Create `src/components/PracticeMode/PracticeResults.tsx`
  - Summary: overall score, per-question scores, strengths, areas to improve
  - Comparison to previous practice sessions (if any)
- [ ] **3.3.7** Add "Practice" toggle/mode switch in widget header
- [ ] **3.3.8** Save practice sessions with tag `type: 'practice'` to session store
- [ ] **3.3.9** Test: Start practice → behavioral → 3 questions → speak answers → verify scoring works

---

*Continued in Phase 4-6 → see `docs/IMPLEMENTATION_PLAN_PART2.md`*
