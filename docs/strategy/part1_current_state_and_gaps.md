# Synapse AI — Strategic Analysis Part 1/4
## Current State Audit & Critical Product Gaps

---

## What You've Actually Built (Honest Assessment)

After reading every file in your codebase, here's where you stand:

| Layer | Status | Quality |
|-------|--------|---------|
| Electron shell + transparent overlay | ✅ Solid | Production-grade window management, click-through, content protection |
| Whisper.cpp CUDA server | ✅ Solid | Server-backed, GPU-accelerated, serialized inference queue |
| Dual-stream VAD (mic + system audio) | ✅ Solid | Silero V5, speaker separation, overlap buffering |
| LLM integration (Ollama/Gemini/Groq) | ✅ Working | Streaming, fallback chain, vision support |
| Screen capture + vision analysis | ✅ Working | One-shot capture, LLM vision analysis |
| Auto question detection | ⚠️ Fragile | Regex-based heuristic with hardcoded 1.5s timeout |
| Transcript stabilization | ⚠️ Basic | Dedup-only, no semantic merging |
| Answer generation quality | ❌ Generic | No context personalization, no interview-type awareness |
| Session persistence | ❌ Missing | Everything lost on close |
| User profile/resume integration | ❌ Missing | `resumeContext` param exists but is never populated |
| Post-interview value | ❌ Zero | No export, no review, no learning loop |

**Bottom line:** You have a strong *infrastructure* — the hard plumbing problems (audio capture, VAD, whisper server, overlay) are solved. But the *intelligence layer* on top is a thin wrapper around a generic LLM prompt. That's the gap.

---

## The 7 Critical Gaps (Ranked by Impact)

### Gap 1: No Personal Context = Generic Answers
> **This is your #1 problem.**

Your `useLLM.ts` line 83-85 shows:
```typescript
const contextPrompt = resumeContext
    ? `Candidate Background:\n${resumeContext}\n\nInterview Question: ${question}`
    : `Interview Question: ${question}`;
```
`resumeContext` is **never passed in**. Every answer is generated with zero knowledge of the user. A generic "tell me about yourself" answer is useless and actively harmful if the user reads it verbatim.

**What competitors do:** Final Round AI requires resume upload. But they store it in the cloud (privacy risk = your opportunity).

**Fix complexity:** Medium — add local resume/JD parser, store in `userData`, inject into every prompt.

---

### Gap 2: No Interview Type Awareness
Your system prompt in `useLLM.ts` is:
```
"You are an expert interview coach helping a candidate answer interview questions."
```
This is the same prompt whether someone is doing a system design interview, a behavioral round, an HR screen, or a live coding session. The answer format, depth, and structure should be completely different for each.

**What competitors miss:** Even Final Round AI doesn't dynamically switch prompting strategies mid-interview based on detected question type.

**Fix complexity:** Low — classify question type from transcript, swap system prompt template.

---

### Gap 3: Fragile Question Detection
Your auto-detection in `App.tsx` lines 96-109:
```typescript
const isLikelyQuestion = currentLastBlock.text.includes('?') || 
    /^(what|where|when|why|who|how|can you|could you|tell me...)/.test(lowerText);
```
This fails on:
- "Walk me through your last project." (no question mark, no trigger word)
- "So your experience with distributed systems." (implicit question)
- Multi-part questions where only the last part has `?`
- Follow-up probes: "Interesting. And the scalability aspect?"

**What competitors do:** Otter.ai just transcribes — no detection. Final Round AI uses cloud models. Neither solves this well.

**Fix complexity:** Medium — use the LLM itself to classify whether a segment is a question, using the conversation context.

---

### Gap 4: Zero Post-Interview Value
Once the user closes the app, everything is gone. No session is saved. No review is possible. No learning happens.

This is a **retention killer**. Users get value once, then churn. Interview prep is a multi-week journey — you need users coming back daily.

**What competitors do:** LeetCode has progress tracking. Pramp has session recordings. Google Interview Warmup saves responses. None combine real-interview data with structured review.

**Fix complexity:** Low-Medium — save sessions to local JSON/SQLite, add a session history view.

---

### Gap 5: No STAR/Framework Coaching
Your answers are free-form LLM output. For behavioral interviews, the gold standard is the STAR method (Situation, Task, Action, Result). For system design, it's structured frameworks (Requirements → Estimation → Design → Deep Dive → Trade-offs).

Users don't need "an answer" — they need a **structured scaffold** they can deliver naturally.

**What competitors miss:** Final Round AI gives raw answers. LeetCode editorial solutions don't teach the delivery framework.

**Fix complexity:** Low — add framework-aware prompt templates that output structured sections.

---

### Gap 6: No Confidence/Delivery Feedback
You capture the user's mic audio and transcribe it, but you do nothing with it analytically. You could be telling users:
- "You used 47 filler words (um, uh, like) in 30 minutes"
- "Your average answer length was 3.2 minutes — try targeting 2 minutes"  
- "You spoke 70% of the time — good balance"
- "Confidence score: low — detected hesitation patterns"

This is the difference between "answer generator" and "interview coach."

**What competitors do:** Google Interview Warmup does basic talk-time analysis. Nobody does this in real-time during a live interview.

**Fix complexity:** Medium — all the audio data is already captured. Add analytics layer on top of transcription.

---

### Gap 7: No Code Interview Support
Your screen capture + vision is there but crude. For coding interviews (the highest-stakes interviews in tech), you need:
- OCR the code from the shared screen
- Understand the programming language
- Detect the problem type (DP, graphs, trees, etc.)
- Suggest the optimal algorithm + complexity
- Show working code, not just an explanation

**What competitors do:** LeetCode is offline prep only. Final Round AI has basic vision. Nobody does real-time coding interview assistance with local inference.

**Fix complexity:** High — requires better vision model or dedicated code extraction pipeline.

---

## Competitor Comparison Matrix

| Feature | Synapse AI | Final Round AI | LeetCode | Pramp | Google Warmup | Otter.ai |
|---------|-----------|---------------|----------|-------|--------------|---------|
| Real-time transcription | ✅ | ✅ (cloud) | ❌ | ❌ | ❌ | ✅ (cloud) |
| AI answer generation | ✅ | ✅ (cloud) | ❌ | ❌ | ❌ | ❌ |
| Fully local/offline | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Privacy (no data leaves) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Desktop overlay | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Screen capture + vision | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Speaker separation | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Resume-aware answers | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Interview type detection | ❌ | Partial | ❌ | ❌ | ✅ | ❌ |
| Session history/review | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delivery coaching | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Framework-based answers | ❌ | ❌ | ✅ (editorial) | ❌ | ❌ | ❌ |
| Practice mode | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Content protection | ✅ | Partial | N/A | N/A | N/A | ❌ |

> [!IMPORTANT]
> Your moat is **local + private + real-time overlay + speaker separation**. No competitor has all four. But your intelligence layer is the weakest in the market. That's what Parts 2-4 will address.

---

**Next: Part 2 → Feature Proposals with full technical specs, difficulty, and ROI scoring.**

Say "next" when ready.
