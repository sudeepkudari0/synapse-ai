# Synapse AI — Strategic Analysis Part 3/4
## Architecture Upgrades, Anti-Features & Interview-Specific Features

---

## Required Architecture Upgrades

Your current architecture will **break** if you try to add the features from Part 2 without these foundational changes.

---

### Upgrade 1: Extract State Management from App.tsx

**Problem:** Your `App.tsx` is 451 lines and holds ALL application state — transcription, answers, settings, chat, timers, auto-generation logic. This is unsustainable.

**Solution:** Extract into dedicated state modules:

```
src/
  state/
    session-state.ts      # transcript, conversation, recording
    answer-state.ts       # Q&A pairs, navigation, generation
    profile-state.ts      # resume, JD, preferences
    analytics-state.ts    # delivery metrics, session stats
    app-state.ts          # UI state, panels, timers
```

**Approach:** Use React Context + `useReducer` per domain, or a lightweight store like Zustand (zero boilerplate, 1KB). Do NOT use Redux — too heavy for an overlay app that needs to stay lean.

**Why now:** Every new feature (sessions, analytics, practice mode) adds 50-100 lines to App.tsx. At 800+ lines it becomes unmaintainable. Refactor at 451 lines, not 1200.

**Difficulty:** 🟡 Medium (2-3 days) | **Priority:** 🔴 Do before adding any Tier 2 features

---

### Upgrade 2: Prompt Template Engine

**Problem:** System prompts are hardcoded strings scattered across `useLLM.ts`, `ipc-handlers.ts`, and `App.tsx`. Adding interview-type-aware prompts, framework templates, and role-specific variants will create an unmanageable mess.

**Solution:**

```
src/lib/prompts/
  index.ts                    # template selector
  templates/
    behavioral.ts             # STAR-formatted prompts
    system-design.ts          # structured framework prompts
    coding.ts                 # algorithm-focused prompts
    hr-screening.ts           # concise, professional prompts
    general.ts                # fallback
  modifiers/
    resume-context.ts         # injects user profile
    company-context.ts        # injects company culture
    follow-up-predictor.ts    # generates likely follow-ups
```

Each template is a function: `(context: PromptContext) => { system: string, user: string }`

**Why now:** You currently have exactly 1 system prompt. Adding 5+ interview types × modifiers × modes = combinatorial explosion without a template system.

**Difficulty:** 🟢 Low (1-2 days) | **Priority:** 🔴 Do before Feature 2 (classifier) and Feature 5 (STAR)

---

### Upgrade 3: Session Storage Layer

**Problem:** No persistence layer exists. You'll need one for sessions, profiles, analytics history, and practice scores.

**Solution:** Use filesystem-based JSON storage (not SQLite — avoids native dependency headaches with Electron packaging):

```
electron/main/storage/
  store.ts              # generic typed CRUD: read/write/list/delete JSON files
  session-store.ts      # sessions/{id}.json
  profile-store.ts      # profile.json  
  analytics-store.ts    # analytics/{session-id}.json
```

Storage location: `app.getPath('userData')/synapse-data/`

**Why not SQLite:** Your data is document-shaped (sessions, profiles), not relational. JSON files are human-readable, debuggable, easy to export, and avoid the `better-sqlite3` native compilation nightmare in Electron builds.

**Difficulty:** 🟢 Low (1-2 days) | **Priority:** 🔴 Do before Feature 3 (sessions)

---

### Upgrade 4: Plugin-Ready LLM Pipeline

**Problem:** Your `LLMService` class is a monolith at 522 lines. Adding question classification, follow-up prediction, delivery analysis, and practice evaluation means every new feature piles into this one class.

**Solution:** Refactor into a pipeline pattern:

```typescript
// Conceptual architecture
interface LLMPipeline {
  classify(transcript: string): Promise<InterviewType>;        // lightweight, fast
  generateAnswer(ctx: AnswerContext): AsyncIterable<string>;   // main generation
  predictFollowUps(ctx: FollowUpContext): Promise<string[]>;   // post-generation
  evaluateResponse(ctx: EvalContext): Promise<Score>;           // practice mode
  analyzeDelivery(transcript: string): DeliveryMetrics;        // pure text, no LLM
}
```

Each method uses different models/temperatures/token limits. Classification uses a tiny model. Generation uses the main model. Evaluation needs higher reasoning.

**Why now:** You're about to add 4-5 different LLM call types. Without separation, you'll end up with a 1500-line God class.

**Difficulty:** 🟡 Medium (3-4 days) | **Priority:** 🟡 Do before Tier 2 features

---

### Upgrade 5: Background Worker for Analytics

**Problem:** Delivery analytics (filler word counting, talk-time calculation, complexity scoring) should NOT run on the renderer thread. Your overlay needs to stay at 60fps.

**Solution:** Use Electron's `utilityProcess` (Electron 33 supports this) or a Web Worker in the renderer for pure text analysis tasks. Analytics runs asynchronously and pushes results via IPC events.

```
electron/main/workers/
  analytics-worker.ts    # runs delivery analysis off main thread
```

**Why now:** Not urgent for Tier 1, but required before Feature 6 (Delivery Analytics). If analytics blocks the renderer, the overlay stutters during the interview — unacceptable.

**Difficulty:** 🟡 Medium (2-3 days) | **Priority:** 🟡 Do before Feature 6

---

### Upgrade 6: Settings Schema Migration System

**Problem:** Your `settings.ts` reads a flat JSON file. As you add profile data, model preferences per interview type, analytics settings, keybind customization — the settings file grows and needs versioning. Old installs need migration.

**Solution:** Add a `version` field to settings. On load, run migrations sequentially:

```typescript
const MIGRATIONS: Record<number, (s: any) => any> = {
  2: (s) => ({ ...s, profile: { resume: '', jobDescription: '' }, version: 2 }),
  3: (s) => ({ ...s, analytics: { enabled: true }, version: 3 }),
};
```

**Difficulty:** 🟢 Low (half day) | **Priority:** 🟡 Do before shipping any settings changes

---

## Features That Sound Cool But Are Actually Useless

> [!CAUTION]
> These will waste your time, bloat the product, and not move the needle on interview outcomes. Avoid them.

### ❌ 1. AI Avatar / Virtual Coach Face
**Why it sounds cool:** "Friendly AI coach face in the corner giving encouragement"
**Why it's useless:** Adds GPU load, distracts from the actual interview, provides zero information value. Users need answers, not a cartoon face. This is what bad AI products do to seem "human."

### ❌ 2. Live Video Feed Analysis
**Why it sounds cool:** "Analyze interviewer's facial expressions for sentiment"
**Why it's useless:** Requires camera access (which users won't grant during an interview), unreliable sentiment detection, and the information is not actionable. What would the user do differently if they knew the interviewer looked "confused"? Nothing they can act on in real-time.

### ❌ 3. Cloud Sync / Account System
**Why it sounds cool:** "Access your data from anywhere"
**Why it's useless for you:** Destroys your core differentiator (privacy). Adds massive infrastructure cost. Interview prep data is inherently time-bounded — users don't need 5 years of session history on their phone. Local-only IS the feature.

### ❌ 4. Social Features / Leaderboard
**Why it sounds cool:** "Compete with friends on practice scores"
**Why it's useless:** Interview prep is deeply personal and anxiety-laden. Nobody wants their practice scores compared. This adds complexity without improving outcomes. Pramp tried social and it's a ghost town.

### ❌ 5. Browser Extension Version
**Why it sounds cool:** "No need to install a desktop app"
**Why it's useless:** Browser extensions can't capture system audio (interviewer's voice), can't use Whisper.cpp natively, can't be invisible to screen sharing. You'd rebuild the product with worse capabilities. The desktop app IS the moat.

### ❌ 6. Voice Cloning / TTS
**Why it sounds cool:** "Read answers aloud in a natural voice"
**Why it's useless:** The user is IN an interview — they can't play audio. TTS is for accessibility, not for live interviews. The overlay text is the correct UX.

### ❌ 7. Auto-Type Answers into Chat
**Why it sounds cool:** "Automatically type answers into the video call chat"
**Why it's useless and dangerous:** Extremely detectable, ethically problematic, and would get users flagged/banned. The product should coach, not impersonate.

### ❌ 8. Blockchain-Based Credential Verification
**Why it sounds cool:** Never. Nobody said this sounds cool.
**Why it's useless:** Self-explanatory. Including it because I've seen it on AI product roadmaps and it makes me sad.

---

## Interview-Type-Specific Feature Matrix

### Software Engineering Interviews

| Sub-type | Specific Features Needed |
|----------|------------------------|
| **DSA/Coding** | Screen capture → problem extraction → algorithm classification → complexity analysis → pseudocode hints → edge case warnings |
| **System Design** | Framework scaffold (Requirements → Estimation → High-Level → Deep Dive → Trade-offs). Auto-suggest components (load balancer, cache, queue, DB) based on detected problem type. Estimate calculations helper. |
| **Code Review** | Capture code screenshot → identify bugs, code smells, security issues → suggest fixes with explanations |
| **Take-Home Discussion** | User uploads their solution beforehand. AI prepares defense points, anticipated questions about design choices, alternative approaches they should know |

**Key prompt modifier:**
```
You are a senior software engineer interviewer coach. The candidate's tech stack: {profile.skills}.
For coding: provide the optimal algorithm, time/space complexity, and clean code.
For system design: use structured phases and suggest specific technologies.
Never give vague advice. Be technically precise.
```

---

### Behavioral Interviews

| Aspect | Specific Features Needed |
|--------|------------------------|
| **STAR Enforcement** | Every answer MUST use Situation-Task-Action-Result format with bold headers |
| **Story Bank** | User pre-loads 5-8 key career stories. AI maps incoming questions to the most relevant story. |
| **Metrics Injection** | Prompt insists on quantifiable results: "increased by X%", "reduced from Y to Z", "managed team of N" |
| **Authenticity Guard** | If the AI generates something that contradicts the resume, flag it. Users must sound truthful. |

**Key prompt modifier:**
```
Format every answer using STAR method with clear headers.
Pull specific examples from the candidate's resume: {profile.resume}
Always include quantified results. If the resume doesn't have metrics, use reasonable estimates and flag them.
Keep answers under 2 minutes of speaking time (~300 words).
```

---

### HR / Screening Interviews

| Aspect | Specific Features Needed |
|--------|------------------------|
| **Salary Negotiation Helper** | Detect salary questions. Provide market-data-aware deflection/anchoring strategies. |
| **Red Flag Detector** | Detect questions about gaps, terminations, short tenures. Provide diplomatic framing. |
| **Culture Fit Alignment** | If company profile is loaded, align answers to company values |
| **Conciseness Enforcer** | HR screens should be 30-60 second answers. Hard limit in prompt. |

**Key prompt modifier:**
```
This is an HR screening call. Answers must be concise (under 60 seconds / 150 words).
Be professional, positive, and forward-looking.
Never badmouth previous employers.
For salary questions: deflect to "I'm focused on finding the right fit" unless the candidate has a target range set.
```

---

### System Design Interviews

| Aspect | Specific Features Needed |
|--------|------------------------|
| **Phase Tracker** | Detect which phase the candidate is in (requirements, estimation, high-level, deep-dive) and provide phase-appropriate hints |
| **Back-of-Envelope Calculator** | Quick estimation helpers: QPS calculations, storage estimates, bandwidth |
| **Component Suggester** | Based on the detected problem, suggest relevant components with trade-offs |
| **Trade-Off Prompter** | After the design phase, auto-suggest "You should discuss: consistency vs availability, SQL vs NoSQL for this use case" |

**Key prompt modifier:**
```
This is a system design interview. Structure your response in phases:
1. Clarifying Requirements (functional + non-functional)
2. Back-of-envelope estimation
3. High-level design (with specific technology choices)
4. Deep-dive on 1-2 critical components
5. Trade-offs and alternatives
Include specific numbers (QPS, storage, latency targets).
```

---

### Sales / Business Interviews

| Aspect | Specific Features Needed |
|--------|------------------------|
| **Revenue/Metric Framing** | Every answer should connect to business outcomes: revenue, pipeline, conversion |
| **Objection Handling** | Detect challenge/pushback questions. Provide structured rebuttals. |
| **Case Study Framework** | Market sizing, go-to-market, competitive analysis frameworks |
| **Storytelling Coach** | Sales interviews reward compelling narratives. Different tone than engineering. |

**Key prompt modifier:**
```
This is a sales/business interview. Frame every answer in terms of business impact.
Use specific revenue numbers, growth percentages, and deal sizes from the resume.
For objection-handling questions: acknowledge, reframe, provide evidence, close.
Be confident and assertive. Use power language.
Keep answers story-driven, not technical.
```

---

> [!IMPORTANT]
> The interview-type-specific prompts are the **single highest-leverage change** you can make to answer quality. Same LLM, same infrastructure, dramatically different output — just by swapping the system prompt based on detected interview type.

---

**Next: Part 4 → 6-month vision, 2-year vision, moat strategy, and prioritized execution plan.**

Say "next" when ready.
