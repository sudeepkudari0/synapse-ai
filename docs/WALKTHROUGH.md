# Synapse AI — Feature Walkthrough & Verification Guide

> **Purpose:** This document is your hands-on checklist to verify every feature implemented across Phases 1–6.  
> **How to use:** Go phase by phase. Each section tells you exactly what to do, where to look, and what you should see.  
> **Estimated time:** ~45 minutes for a full walkthrough.

---

## Pre-Flight Checklist

Before starting, make sure the app runs:

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Make sure Ollama is running (if using local LLM)
ollama serve

# Terminal 3: Make sure Whisper server is running (if testing audio)
# (your whisper server command)
```

**Quick smoke test:**
- [ ] App window appears as an overlay
- [ ] Widget is draggable (grab the header bar)
- [ ] Widget collapses/expands when clicking the chevron
- [ ] `Ctrl+Shift+H` toggles the widget

---

## Phase 1: Foundation (Zustand + Prompts + Storage)

> These are internals — you verify them indirectly through later features.

### 1.1 Zustand State Management
**Where:** All state lives in `src/state/`

| What to check | How | Expected |
|---|---|---|
| Stores load without error | Open the app, check DevTools console | No errors mentioning "zustand" or "store" |
| UI Store works | Click Settings gear icon → panel opens | Other panels (Chat, History) close automatically |
| Panel exclusivity | Open Settings, then click Chat icon | Settings closes, Chat opens — only one panel at a time |

### 1.2 Prompt Templates
**Where:** `src/lib/prompts/templates/`

| What to check | How | Expected |
|---|---|---|
| Templates exist | Check the folder in your editor | Files: `behavioral.ts`, `technical.ts`, `system-design.ts`, `coding.ts`, `hr-screening.ts`, `general.ts`, `interviewer.ts`, `evaluator.ts`, `code-analysis.ts` |
| No import errors | App starts without console errors | Clean startup |

### 1.3 Storage Layer
**Where:** `electron/main/storage/`

| What to check | How | Expected |
|---|---|---|
| Session saves work | Record a short session → stop recording → check `%APPDATA%/electro-hid/synapse-data/sessions/` | A `.json` file appears with your session data |
| Profile saves work | Go to Settings → fill in Resume/Role → reload app | Your data persists after restart |

### 1.4 Settings System
**Where:** `electron/main/settings.ts`

| What to check | How | Expected |
|---|---|---|
| Settings persist | Change any setting → restart app | Setting is remembered |
| Migration works | Check `%APPDATA%/electro-hid/settings.json` | File has `"version": 4` |
| New fields exist | Open the JSON file | Should see `autoCaptureCodingMode`, `showDeliveryMetrics`, `interviewLanguage`, `isESLMode` |

---

## Phase 2: Core Intelligence

### 2.1 Resume Context
**Where:** Settings Panel → Profile section

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click ⚙️ gear icon to open Settings | Settings panel opens |
| 2 | Find "Resume / Background" textarea | Should be visible in the profile section |
| 3 | Paste a sample resume (even just a few lines) | Text saves |
| 4 | Fill in Target Role: "Software Engineer" | Saves |
| 5 | Fill in Target Company: "Google" | Saves |
| 6 | Close Settings, generate an answer | Answer should reference your resume context — look for your skills/experience being mentioned |

### 2.2 Interview Type Classification
**Where:** Answer badges in the AnswerPanel

| Step | Action | Expected Result |
|---|---|---|
| 1 | Start recording, speak a behavioral question: "Tell me about a time you led a team" | Transcript appears in the panel |
| 2 | Click ✨ (Generate Answer) or wait for auto-detect | Answer should show a badge: `Detected: behavioral` |
| 3 | Ask a technical question: "Explain how a hash map works" | Badge should switch to `Detected: technical` |
| 4 | Ask: "Design a URL shortener" | Badge: `Detected: system-design` |

### 2.3 Smart Question Detection
**Where:** Automatic answer generation

| Step | Action | Expected Result |
|---|---|---|
| 1 | Start recording | Transcript panel shows text |
| 2 | Speak a clear question ending with "?" | After a brief pause (~3s), answer auto-generates |
| 3 | Speak a statement (not a question) | No auto-generation — it should wait for actual questions |

### 2.4 Session History
**Where:** Clock icon in header → History panel

| Step | Action | Expected Result |
|---|---|---|
| 1 | Record a session, get some answers, stop recording | Session auto-saves |
| 2 | Click the 🕐 History icon | List of past sessions appears |
| 3 | Click a session | Full detail view with transcript, answers, metrics |
| 4 | Click "Copy MD" button | Markdown copied to clipboard — paste in a text editor to verify |
| 5 | Click ".md" download button | `.md` file downloads |
| 6 | Click ".json" download button | `.json` file downloads with structured data |

### 2.5 Follow-Up Predictor
**Where:** Answer panel, below the main answer

| Step | Action | Expected Result |
|---|---|---|
| 1 | Generate an answer to any question | Answer appears |
| 2 | Look for "Likely Follow-up Questions" section | Expandable section below the answer |
| 3 | Click to expand | Shows 2-4 predicted follow-up questions |

---

## Phase 3: Coaching Engine

### 3.1 STAR Framework & Structured Answers
**Where:** AnswerPanel content

| Step | Action | Expected Result |
|---|---|---|
| 1 | Ask a behavioral question (e.g., "Tell me about a time you failed") | Answer should have **Situation:**, **Task:**, **Action:**, **Result:** headers |
| 2 | Look at the markdown rendering | Headers, bold text, and bullets render properly (not raw markdown) |
| 3 | Check the "Bullets" toggle in the answer footer | Toggles between paragraph and bullet-point modes for future answers |

### 3.2 Delivery Analytics
**Where:** Bottom of the main widget view (MetricsBar)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Start recording and speak for 30+ seconds | MetricsBar appears at the bottom |
| 2 | Speak with some filler words ("um", "like", "you know") | Filler word count increments |
| 3 | Check WPM (words per minute) | Should show a realistic number (120-180 for normal speech) |
| 4 | Check Talk Ratio | Shows what % of time you've been speaking |
| 5 | Stop recording, check session history | Metrics are saved with the session |

### 3.3 Practice Mode (Mock Interviews)
**Where:** 🎓 Graduation Cap icon in header

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click 🎓 icon | Practice Mode panel opens |
| 2 | Select interview type: "Behavioral" | Dropdown works |
| 3 | Set role, company, question count (3 for quick test) | Fields accept input |
| 4 | Click "Start Practice Session" | First AI-generated question appears |
| 5 | Type or speak your answer | Answer text area captures input |
| 6 | Click "Submit & Evaluate" | AI evaluates your answer with score and feedback |
| 7 | Complete all questions | Results screen shows with scores, strengths, improvements |
| 8 | Check session history | Practice session saved with `practice` tag |

**Also check:**
| Step | Action | Expected Result |
|---|---|---|
| 9 | On the setup screen, click "View Progress" | Progress Dashboard opens |
| 10 | If you've done practice sessions, check the charts | Score history bars and focus areas visible |

---

## Phase 4: Code & Screen Intelligence

### 4.1 Code Interview Assistant
**Where:** `</>` Code Mode button in the header (next to camera)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Find the `</>` button in the header | Should be between Camera and Sparkles buttons |
| 2 | Click it | Button glows **emerald green** with a ring indicator |
| 3 | Hover over it | Tooltip: "Code Mode ON (captures use coding prompts)" |
| 4 | Open a LeetCode/coding problem in your browser | Any coding problem visible on screen |
| 5 | Press `Ctrl+Shift+S` (or click Camera) | Answer streams in with structured format: |
| | | **Problem Statement** → **Classification** → **Approach** → **Complexity** → **Solution** (code block) → **Edge Cases** |
| 6 | Check the code block rendering | Should have: language label (e.g., "PYTHON"), dark background, hover-to-show "Copy" button |
| 7 | Click `</>` again to disable | Button returns to normal (no glow) |
| 8 | Capture again without Code Mode | Regular "Screen Analysis" answer (not structured for coding) |

**Code Block Rendering (verify in any answer with code):**
| What | Expected |
|---|---|
| Inline code | Green text on dark background: `like this` |
| Code blocks | Dark container with language badge header + copy button |
| Copy button | Appears on hover, copies code to clipboard |

### 4.2 Enhanced Screen Capture (Region Selection)
**Where:** ✂️ Crop button in header + `Ctrl+Shift+A`

| Step | Action | Expected Result |
|---|---|---|
| 1 | Find the Crop (✂️) button in the header | Should be between Camera and Code Mode buttons |
| 2 | Click it (or press `Ctrl+Shift+A`) | **Full-screen darkened overlay** appears with your screen as background |
| 3 | Read the instructions at the top | "Drag to select region • Enter to confirm • Esc to cancel" |
| 4 | Click and drag to select a region | Selected area brightens, rest stays dark. Blue dashed border around selection. Size indicator (e.g., "640×480") |
| 5 | Release mouse | "Analyze Region" and "Cancel" buttons appear at the bottom |
| 6 | Click "Analyze Region" | Overlay closes, answer starts streaming |
| 7 | Press `Esc` instead | Overlay closes, nothing happens |

> ⚠️ **Note:** Region capture works with Code Mode too! If Code Mode is ON, the cropped region uses the coding prompt.

---

## Phase 5: Interview-Specific Features

### 5.1 Story Bank
**Where:** Settings Panel → (you'd need to add the StoryBank component to Settings UI)

> **Important:** The `StoryBank.tsx` component is created but may need to be wired into your Settings panel. Check if it's visible in Settings. If not, the component exists at `src/components/SettingsPanel/StoryBank.tsx` and needs to be imported into `SettingsPanel.tsx`.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open Settings | Look for "Story Bank" section |
| 2 | Click "Add Story" | Form appears with STAR fields (Situation, Task, Action, Result) |
| 3 | Fill in a story title and all STAR fields | All fields accept input |
| 4 | Select tags (leadership, conflict, etc.) | Tags toggle on/off with visual feedback |
| 5 | Add metrics (e.g., "20% revenue increase") | Metric pills appear |
| 6 | Click "Save Story" | Story appears in the list |
| 7 | Click a story to expand it | Shows S/T/A/R with color-coded labels |
| 8 | If resume is filled: click "Auto-generate" | LLM extracts stories from resume (may take a few seconds) |
| 9 | Ask a behavioral question | Answer should reference your story bank |

**Behavioral Prompt Enhancement:**
| What | Expected |
|---|---|
| With stories matching the question | Answer uses your real story details |
| Without matching stories | Answer adds: "💡 Tip: Add a real story about this topic to your Story Bank" |
| Claims not in your profile | Answer adds: "⚠️ Verify: this detail isn't in your profile" |

### 5.2 System Design Helper
**Where:** `src/lib/system-design-helper.ts` — detection happens in the background

| Step | Action | Expected Result |
|---|---|---|
| 1 | Set interview type to "system-design" in Settings | Type changes |
| 2 | Start a mock conversation about "Design Twitter" | Transcript accumulates |
| 3 | Speak about requirements, then estimation, then architecture | The system internally tracks phases |

**To verify the code works (developer check):**
```typescript
// In browser DevTools console:
import { detectPhase } from './lib/system-design-helper';
detectPhase("let's talk about the requirements and use cases");
// → { phase: 'requirements', label: 'Requirements Gathering', ... }

detectPhase("we need to handle 10000 queries per second");
// → { phase: 'estimation', label: 'Estimation', ... }
```

### 5.3 HR/Screening Enhancements
**Where:** Automatic when HR-type questions detected

| Step | Action | Expected Result |
|---|---|---|
| 1 | Ask: "What are your salary expectations?" | Answer uses deflection strategy (default) |
| 2 | Ask: "Why did you leave your last job?" | Answer uses diplomatic framing — never negative about past employers |
| 3 | Ask: "Tell me about a gap in your resume" | Frames gap positively (learning, personal project, etc.) |
| 4 | Check answer length | HR answers should be concise (~150 words) |

### 5.4 Company-Specific Context
**Where:** Affects answer generation when target company is set

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to Settings → set Target Company to "Amazon" | Saves |
| 2 | Ask a behavioral question | Answer should reference Amazon Leadership Principles |
| 3 | Change to "Google" | Answers shift to Googleyness, cognitive ability framing |
| 4 | Change to "Meta" | Answers emphasize "Move Fast", impact |

**Supported companies (fuzzy matched):**
Amazon, Google, Meta, Microsoft, Apple, Netflix, Stripe, Uber, Airbnb, LinkedIn

---

## Phase 6: Advanced & Polish

### 6.1 Scoring Engine & Progress Dashboard
**Where:** Practice Mode → "View Progress"

| Step | Action | Expected Result |
|---|---|---|
| 1 | Complete 2-3 practice sessions (even short ones with 3 questions) | Sessions save |
| 2 | Go to Practice Mode → click "View Progress" | Progress Dashboard opens |
| 3 | Check "Avg Score" box | Shows numeric average |
| 4 | Check "Sessions" count | Shows how many practice sessions you've done |
| 5 | Check "Trend" indicator | Arrow up (improving), flat (stable), or down (declining) |
| 6 | Check "Score History" bars | Color-coded bars: green (≥7), amber (5-6), red (<5) |
| 7 | Check "Focus Areas" section | Highlights your weakest dimensions with tips |
| 8 | Click arrow to go back | Returns to Practice Setup |

### 6.2 Multi-Language / ESL Support
**Where:** `src/lib/esl-support.ts` + Settings

| Step | Action | Expected Result |
|---|---|---|
| 1 | Check `settings.json` for `interviewLanguage` | Should be `"en"` by default |
| 2 | Check for `isESLMode` | Should be `false` by default |

**To verify ESL grammar checker (developer check):**
```typescript
import { checkGrammar } from './lib/esl-support';
checkGrammar("I was working on this project since 3 years");
// → [{ original: "since 3 years", suggestion: "for 3 years", rule: "..." }]
```

**To verify whisper model selection:**
```typescript
import { getWhisperModelForLanguage } from './lib/esl-support';
getWhisperModelForLanguage('en');   // → 'small.en'
getWhisperModelForLanguage('ja');   // → 'base' (multilingual)
```

### 6.3 Session Export
**Where:** Session History → Session Detail view

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open a past session from History | Session Detail view opens |
| 2 | Click "Copy MD" | Markdown text copied to clipboard |
| 3 | Paste into a text editor | Clean markdown with headers, transcript, Q&A, metrics |
| 4 | Click ".md" button | File download: `synapse-session-YYYY-MM-DD.md` |
| 5 | Open the .md file | Proper markdown formatting |
| 6 | Click ".json" button | File download: `synapse-session-YYYY-MM-DD.json` |
| 7 | Open the .json file | Valid JSON with session structure |

### 6.4 UX Polish

#### Keyboard Shortcuts
**Where:** `ShortcutsReference.tsx` (needs wiring into Settings)

| Shortcut | Action | How to Test |
|---|---|---|
| `Ctrl+Shift+R` | Toggle Recording | Press it → recording starts/stops |
| `Ctrl+Shift+S` | Capture Full Screen | Press it → screen analyzed |
| `Ctrl+Shift+A` | Region Capture | Press it → selection overlay appears |
| `Ctrl+Shift+G` | Generate Answer | Press with transcript → answer generates |
| `Ctrl+Shift+H` | Toggle Widget | Press it → widget collapses/expands |

#### Status Indicator
**Where:** `StatusIndicator.tsx` (needs wiring into widget)

| State | Expected Display |
|---|---|
| No model loaded | Gray "No Model" with disconnect icon |
| Model loading | Amber "Loading Model..." with spinner |
| Model loaded, not recording | Green "Ready" with checkmark |
| Recording active | Green "Listening" with wifi icon |
| Model error | Red "Model Error" with alert icon |

#### Code Mode Visual Indicator
| State | Expected |
|---|---|
| Code Mode OFF | `</>` button is normal (zinc/gray) |
| Code Mode ON | `</>` button glows emerald green with ring border |

---

## Quick Reference: Where Everything Lives

### State Stores (`src/state/`)
| Store | Purpose |
|---|---|
| `ui-store.ts` | Panel visibility, code mode, bullet points |
| `answer-store.ts` | AI-generated answers |
| `session-store.ts` | Recording state, conversation, session timer |
| `profile-store.ts` | Resume, skills, stories |
| `practice-store.ts` | Practice mode lifecycle |

### Key Libraries (`src/lib/`)
| File | Purpose |
|---|---|
| `interview-classifier.ts` | Detects interview question type |
| `question-detector.ts` | Detects if a transcript segment is a question |
| `follow-up-predictor.ts` | Predicts likely follow-up questions |
| `delivery-analyzer.ts` | Filler words, WPM, talk ratio |
| `system-design-helper.ts` | Phase detection, estimation, component suggestions |
| `company-context.ts` | Company interview data (10 companies) |
| `scoring-engine.ts` | Multi-dimension scoring, progress tracking |
| `esl-support.ts` | ESL prompt modifier, grammar checker |
| `session-export.ts` | Markdown/JSON export |
| `transcript-stabilizer.ts` | Smooths real-time transcription |

### Prompt Templates (`src/lib/prompts/templates/`)
| Template | When Used |
|---|---|
| `behavioral.ts` | "Tell me about a time..." questions |
| `technical.ts` | "Explain how X works" questions |
| `system-design.ts` | "Design a system that..." questions |
| `coding.ts` | Algorithm/coding questions (transcript) |
| `code-analysis.ts` | Screen capture in Code Mode (vision) |
| `hr-screening.ts` | Salary, gaps, "why this company" |
| `general.ts` | Anything that doesn't fit above |
| `interviewer.ts` | Practice mode question generation |
| `evaluator.ts` | Practice mode answer evaluation |

### Components
| Component | Location | Purpose |
|---|---|---|
| `FloatingWidget` | `src/components/FloatingWidget/` | Main overlay container |
| `WidgetHeader` | same folder | All action buttons |
| `AnswerPanel` | same folder | AI answer display with code renderer |
| `TranscriptPanel` | same folder | Live transcript |
| `ShortcutsReference` | same folder | Keyboard shortcuts panel |
| `RegionSelector` | `src/components/RegionSelector/` | Drag-to-select screen region |
| `PracticeMode` | `src/components/PracticeMode/` | Mock interview container |
| `PracticeSetup` | same folder | Interview config form |
| `PracticeSession` | same folder | Active Q&A during practice |
| `PracticeResults` | same folder | Post-practice scorecard |
| `ProgressDashboard` | same folder | Score trends across sessions |
| `StoryBank` | `src/components/SettingsPanel/` | STAR story CRUD |
| `MetricsBar` | `src/components/DeliveryMetrics/` | Live speaking metrics |
| `StatusIndicator` | `src/components/shared/` | Model/recording status |
| `SessionHistory` | `src/components/SessionHistory/` | Past session list |
| `SessionDetail` | same folder | Full session view + export |

---

## Known Integration Points to Wire Up

> Some components are built but may need to be explicitly added to the UI:

| Component | Where to Add | Current Status |
|---|---|---|
| `StoryBank` | Import into `SettingsPanel.tsx` | Component built, needs UI wiring |
| `ShortcutsReference` | Import into `SettingsPanel.tsx` or `FloatingWidget.tsx` | Component built, needs UI wiring |
| `StatusIndicator` | Import into `WidgetHeader.tsx` or `FloatingWidget.tsx` | Component built, needs UI wiring |
| ESL grammar display | Show grammar suggestions in transcript area | Logic built in `esl-support.ts`, needs UI component |
| System design phase indicator | Show phase badge in overlay | Logic built in `system-design-helper.ts`, needs UI badge |
| Company context injection | Wire `formatCompanyContextForPrompt()` into prompt generation in `App.tsx` | Logic built, needs prompt-generation hook integration |

To wire these up, the pattern is always:
1. Import the component
2. Add it to the JSX tree in the appropriate parent
3. Pass the required props

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Widget doesn't appear | Electron window not created | Check `electron/main/window.ts` |
| No audio transcription | Whisper server not running | Start your whisper CUDA server |
| AI answers empty | Ollama not running or no API key | Check Settings → test Ollama connection |
| Screen capture black | Content protection blocking self-capture | This is expected — it captures other windows |
| Settings reset on restart | Migration failed | Delete `settings.json` and restart |
| Practice mode stuck | State didn't reset properly | Reload the app (Ctrl+Shift+R in DevTools) |
| Code blocks not styled | ReactMarkdown not processing fences | Check `AnswerPanel.tsx` custom code renderer |

---

*Last updated: May 16, 2026 — Covers Phases 1–6 (89 tasks)*
