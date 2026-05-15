# Synapse AI — Strategic Analysis Part 2/4
## Feature Proposals — Full Technical Specs & ROI

---

## Tier 1: Immediate MVP Additions (Ship in 2-4 weeks)

---

### Feature 1: Resume & Job Description Context Engine

| Dimension | Detail |
|-----------|--------|
| **User problem** | Every AI answer is generic. Users can't trust or use answers that don't reflect their actual experience. |
| **Why competitors fail** | Final Round AI stores resumes in the cloud — privacy-conscious users (especially at FAANG) won't use it. Otter.ai doesn't generate answers at all. |
| **Technical approach** | Add a "Profile" tab in Settings. Accept resume paste (plaintext/markdown) + job description paste. Store in `settings.json` under `userData/profile.json`. Inject into every LLM system prompt as grounding context. Parse key entities (skills, years, companies) into structured JSON for faster prompt construction. |
| **Implementation** | New `electron/main/profile.ts` module. New `useProfile` hook. Modify `useLLM.ts` `generateInterviewAnswer` to always load and inject profile. Add a "Profile" section in `SettingsPanel`. |
| **Difficulty** | 🟢 Low (3-5 days) |
| **Retention impact** | 🔴 Critical — this alone doubles answer quality and makes the product sticky |
| **Monetization** | Free tier: 1 profile. Pro: unlimited profiles per job application |
| **Local-first** | ✅ Perfect fit — all data stays in `userData` |

---

### Feature 2: Interview Type Classifier

| Dimension | Detail |
|-----------|--------|
| **User problem** | A system design question gets the same treatment as "tell me about a conflict with a coworker." The answer format, depth, and structure should be fundamentally different. |
| **Why competitors fail** | Final Round AI uses one-size-fits-all prompting. Google Interview Warmup pre-selects categories but doesn't auto-detect. Nobody does real-time dynamic classification. |
| **Technical approach** | Create a prompt classifier that runs on the first detected question. Categories: `behavioral`, `technical`, `system-design`, `coding`, `hr-screening`, `case-study`, `situational`. Use a lightweight LLM call (or even regex + keyword scoring for zero-latency) to classify. Once classified, swap the system prompt template. |
| **Implementation** | New `src/lib/interview-classifier.ts` with keyword scoring (instant) + LLM fallback (accurate). Map of category → system prompt template in `src/lib/prompt-templates.ts`. Modify `triggerAutoAnswer()` in `App.tsx` to pass detected category. |
| **Difficulty** | 🟢 Low (2-3 days) |
| **Retention impact** | 🟡 High — answers feel 10x more relevant |
| **Monetization** | All categories free. Pro: custom prompt templates per category |
| **Local-first** | ✅ Runs locally via Ollama or even pure regex |

---

### Feature 3: Session Persistence & History

| Dimension | Detail |
|-----------|--------|
| **User problem** | User finishes a 45-minute interview, closes the app, and loses everything. No review, no learning, no reference for the next round. |
| **Why competitors fail** | Final Round AI saves to cloud (privacy issue). Pramp requires video recording consent from both parties. Nobody offers private, local session archives. |
| **Technical approach** | Auto-save session data to `userData/sessions/{timestamp}.json` containing: full transcript (with speaker labels), all generated Q&A pairs, session duration, interview type detected, metadata. Add a "Past Sessions" view accessible from the widget. |
| **Implementation** | New `electron/main/session-store.ts` — CRUD for sessions using filesystem JSON. New IPC handlers: `session:save`, `session:list`, `session:load`, `session:delete`. New `SessionHistory` component. Auto-save on `stopRecording()`. |
| **Difficulty** | 🟢 Low (3-4 days) |
| **Retention impact** | 🔴 Critical — creates a reason to come back. Transforms single-use tool into a longitudinal platform. |
| **Monetization** | Free: last 5 sessions. Pro: unlimited + export to markdown/PDF |
| **Local-first** | ✅ Everything in local filesystem |

---

### Feature 4: Smart Question Detection (LLM-Powered)

| Dimension | Detail |
|-----------|--------|
| **User problem** | Current regex detection misses implicit questions, statements-as-questions, and multi-part questions. False negatives = missed answers. False positives = noise. |
| **Why competitors fail** | Nobody has solved real-time question boundary detection in live interviews. It's an unsolved UX problem. |
| **Technical approach** | Replace the regex check with a tiny LLM classification call. After each interviewer speech segment ends (VAD `onSpeechEnd`), send the last 2-3 blocks to the LLM with a classification-only prompt: "Is the interviewer asking a question or making a statement that expects a response? Reply YES or NO." Use Ollama with a small model (qwen3:0.6b) for sub-200ms latency. |
| **Implementation** | New `src/lib/question-detector.ts`. Separate lightweight Ollama call (not the main generation model). Replace the regex block in `App.tsx` lines 96-109. Add a confidence threshold to prevent over-triggering. |
| **Difficulty** | 🟡 Medium (4-5 days, needs latency tuning) |
| **Retention impact** | 🟡 High — fewer missed questions = more trust in the product |
| **Monetization** | Bundled with core product |
| **Local-first** | ✅ Small model runs on Ollama locally |

---

## Tier 2: Medium-Term Roadmap (Ship in 1-3 months)

---

### Feature 5: STAR Framework & Structured Answer Templates

| Dimension | Detail |
|-----------|--------|
| **User problem** | Users get a wall of text. In a live interview, they need scannable, structured talking points — not an essay to read verbatim. |
| **Why competitors fail** | Final Round AI outputs raw paragraphs. LeetCode editorials are study material, not live-delivery scaffolds. Nobody formats answers for real-time delivery. |
| **Technical approach** | For behavioral → STAR format (bold headers: **Situation**, **Task**, **Action**, **Result**). For system design → structured phases. For technical → Problem → Approach → Key Points → Edge Cases. For HR → concise bullet points. Answers render with collapsible sections so users can glance at headers and expand details. |
| **Implementation** | Prompt templates per interview type output markdown with headers. Modify `AnswerPanel.tsx` to render markdown with collapsible sections. Add a "Bullet Points" vs "Full Answer" toggle. |
| **Difficulty** | 🟡 Medium (5-7 days) |
| **Retention impact** | 🟡 High — users actually use the answers instead of ignoring walls of text |
| **Monetization** | Pro feature — free tier gets basic answers, Pro gets structured frameworks |
| **Local-first** | ✅ Just prompt engineering + rendering |

---

### Feature 6: Delivery Analytics Dashboard

| Dimension | Detail |
|-----------|--------|
| **User problem** | Users don't know *how* they sound. Filler words, rambling, silence gaps, talk-time ratio — all invisible without feedback. |
| **Why competitors fail** | Google Interview Warmup does post-session word analysis but only for their own mock questions. Pramp relies on peer feedback (inconsistent). Nobody analyzes delivery metrics from *real interviews* in real-time. |
| **Technical approach** | Analyze the user's transcript stream for: filler word count (`um`, `uh`, `like`, `you know`, `basically`, `actually`), average answer duration, talk-time ratio (user vs interviewer), vocabulary complexity (unique word ratio), silence gaps between question and first response. Display as a small metrics bar in the overlay during the session + full report post-session. |
| **Implementation** | New `src/lib/delivery-analyzer.ts` — pure text analysis, no ML needed. Hook into conversation state updates. New `DeliveryMetrics` component (mini overlay bar). Post-session report saved with session data. |
| **Difficulty** | 🟡 Medium (5-7 days) |
| **Retention impact** | 🔴 Critical — this is what turns "answer generator" into "interview coach" |
| **Monetization** | Pro feature — powerful differentiator |
| **Local-first** | ✅ Pure text processing, zero network needed |

---

### Feature 7: Practice Mode (Mock Interviews)

| Dimension | Detail |
|-----------|--------|
| **User problem** | Users can only use the product during real interviews. But the highest-value time is *preparation* — practicing beforehand. |
| **Why competitors fail** | Pramp requires scheduling with another person. Google Interview Warmup has pre-set questions only. LeetCode has no interview simulation. Nobody offers private, local, AI-driven mock interviews with the same real-time overlay UX. |
| **Technical approach** | The LLM plays the interviewer. User selects interview type + job role. LLM asks questions, listens to user's spoken response, evaluates it, gives feedback, then moves to the next question. Uses the exact same transcription + VAD pipeline — no new infrastructure needed. |
| **Implementation** | New `PracticeMode` component and state in `App.tsx`. New prompt template for "interviewer AI" that asks questions and evaluates responses. Toggle between "Live Mode" and "Practice Mode" in the header. Session saved same as live sessions but tagged as `practice`. |
| **Difficulty** | 🟡 Medium (7-10 days) |
| **Retention impact** | 🔴 Critical — this is the daily-use feature. Users prep every day, not just during interviews. |
| **Monetization** | Free: 3 practice sessions/week. Pro: unlimited + custom question banks |
| **Local-first** | ✅ All local — LLM asks questions, whisper transcribes answers |

---

### Feature 8: Code Interview Assistant

| Dimension | Detail |
|-----------|--------|
| **User problem** | In coding interviews, the question is on screen (LeetCode, CoderPad, HackerRank). User needs: problem identification, algorithm suggestion, complexity analysis, code hints — not a generic text answer. |
| **Why competitors fail** | Final Round AI's vision is slow and generic. LeetCode only helps with prep. Nobody provides real-time algorithm assistance overlaid on the coding environment. |
| **Technical approach** | Use existing screen capture → vision pipeline. Add specialized prompts for coding: "Extract the problem statement. Identify the problem category (DP, graphs, etc.). Suggest the optimal algorithm. Provide pseudocode with time/space complexity." Add a "Code Mode" toggle that changes the capture + analysis pipeline. |
| **Implementation** | New coding-specific prompt templates in `prompt-templates.ts`. Modified `handleCaptureScreen` flow that uses coding prompts when Code Mode is active. Optional: periodic auto-capture every N seconds to track problem changes. |
| **Difficulty** | 🟡 Medium (5-7 days for basic, 2-3 weeks for polished) |
| **Retention impact** | 🟡 High — coding interviews are highest-anxiety, highest-stakes |
| **Monetization** | Pro feature — high willingness to pay |
| **Local-first** | ✅ Vision model runs via Ollama (qwen3-vl) |

---

## Tier 3: Ambitious Moonshots (3-6 months)

---

### Feature 9: Predictive Follow-Up Engine

| Dimension | Detail |
|-----------|--------|
| **User problem** | After answering, the interviewer often asks follow-ups. Users are blindsided. If they could see likely follow-ups *before* they're asked, they'd be far more prepared. |
| **Why competitors fail** | Nobody does this. It requires understanding conversation flow + interview patterns. |
| **Technical approach** | After generating an answer, run a second LLM call: "Based on this question and answer, what are the 3 most likely follow-up questions the interviewer will ask?" Display below the main answer in a collapsed section. |
| **Difficulty** | 🟢 Low technically (just another prompt), 🟡 Medium for quality tuning |
| **Retention impact** | 🟡 High — "wow factor" feature that creates word-of-mouth |
| **Monetization** | Pro feature |
| **Local-first** | ✅ Just another Ollama call |

---

### Feature 10: Company-Specific Prep Database

| Dimension | Detail |
|-----------|--------|
| **User problem** | Every company has different interview styles, values, and question patterns. A Google behavioral is very different from an Amazon leadership principles interview. |
| **Why competitors fail** | Glassdoor has crowd-sourced questions but no AI integration. LeetCode has company tags but no answer coaching. |
| **Technical approach** | Bundle a local database of company interview patterns (JSON): culture values, common question themes, evaluation criteria, interview structure. When user sets "Target Company: Amazon" in profile, all prompts incorporate Amazon's 16 leadership principles. Updatable via optional sync. |
| **Difficulty** | 🟡 Medium (data curation is the hard part) |
| **Retention impact** | 🟡 High — makes prep feel personalized |
| **Monetization** | Free: top 20 companies. Pro: full database + custom entries |
| **Local-first** | ✅ Local JSON database, optional update downloads |

---

### Feature 11: Multi-Language Interview Support

| Dimension | Detail |
|-----------|--------|
| **User problem** | Non-native English speakers interview in English. They need: real-time grammar correction suggestions, simpler vocabulary alternatives, pronunciation-safe word choices. |
| **Why competitors fail** | Nobody addresses ESL interview candidates. This is a massive underserved market. |
| **Technical approach** | Analyze user's transcribed speech for grammar issues. Add "Language Assist" mode that flags complex sentences and suggests simpler alternatives. Use whisper's multilingual models for non-English interviews. |
| **Difficulty** | 🟡 Medium |
| **Retention impact** | 🟡 High for ESL market (huge TAM) |
| **Monetization** | Pro feature — high international willingness to pay |
| **Local-first** | ✅ Whisper supports multilingual, LLM handles grammar |

---

### Feature 12: Interview Simulation with Scoring

| Dimension | Detail |
|-----------|--------|
| **User problem** | Users don't know if they're "interview ready." They need an objective score and gap analysis before the real thing. |
| **Why competitors fail** | Pramp has peer reviews (subjective). Google Warmup gives basic feedback. Nobody provides a structured readiness score. |
| **Technical approach** | Extended Practice Mode. Full mock interview (5-8 questions). Post-session AI evaluation on: answer completeness, structure, specificity, relevance, communication clarity. Output: overall score (1-100), per-question breakdown, specific improvement suggestions, comparison to previous sessions. |
| **Difficulty** | 🔴 High (scoring calibration is hard) |
| **Retention impact** | 🔴 Critical — gamification + progress tracking = daily use |
| **Monetization** | Core Pro feature — this is what justifies subscription pricing |
| **Local-first** | ✅ All scoring via local LLM |

---

## Impact vs Effort Matrix

```
HIGH IMPACT
     │
     │  F1(Resume)   F3(Sessions)   F7(Practice)
     │  F6(Delivery)  F12(Scoring)
     │
     │  F2(Classifier) F5(STAR)  F9(Follow-ups)
     │  F4(SmartQ)     F8(Code)  F10(Company)
     │
     │                 F11(Language)
     │
LOW  └──────────────────────────────────────────
    LOW EFFORT                        HIGH EFFORT
```

> [!TIP]
> **Fastest path to a dramatically better product:** Ship F1 + F2 + F3 in week 1-2. These three alone transform the product from "generic answer bot" to "personalized interview copilot" with zero architectural changes needed.

---

**Next: Part 3 → Architecture upgrades, features to avoid, interview-type-specific features.**

Say "next" when ready.
