# E2E Testing with Playwright

This directory contains end-to-end tests for the Synapse AI Electron application using Playwright.

## Quick Start

```bash
# 1. Generate TTS test audio fixtures (one-time setup)
bun run test:e2e:generate-audio

# 2. Build the Electron app
bun run build:all

# 3. Run all tests
bun run test:e2e:all
```

## Test Suites

### Smoke Tests (`app.spec.ts`)
Basic app launch and UI verification.

```bash
bun run test:e2e              # Run smoke tests
bun run test:e2e:headed       # With visible window
```

### Mock Interview Tests (`mock-interview.spec.ts`)
Full interview simulation with STT, question detection, and AI answer generation.

```bash
bun run test:e2e:interview         # Full mock interview suite
bun run test:e2e:interview:headed  # With visible window
bun run test:e2e:regression        # Speaker attribution bug regression
bun run test:e2e:stt-bench         # Multi-engine STT benchmark
bun run test:e2e:latency           # Latency benchmarks only
```

## Test Coverage

### Smoke Tests ✅
- Application launches successfully
- Window properties (frameless, transparent, always-on-top)
- UI elements render correctly
- Model loading indicator
- Recording start/stop
- Transcript display

### Multi-Engine STT Benchmark ✅
- Deepgram (cloud API) transcription accuracy + latency
- Moonshine (local GPU) transcription accuracy + latency
- Whisper.cpp (local GPU) transcription accuracy + latency
- Silence handling (should not hallucinate)
- Noise handling (energy filter verification)
- Real-Time Factor (RTF) calculation

### Full Mock Interview Flow ✅
- Complete behavioral interview simulation (4 turns)
- Audio → STT → Transcription → Question Detection → LLM → Answer
- Rapid question-answer exchange handling
- Conversation state integrity

### Speaker Attribution Regression ✅
- Interviewer text ONLY appears as interviewer (bug fix verification)
- User text ONLY appears as user
- Simultaneous speech maintains correct labels
- Alternating speakers create separate blocks
- STT transcription doesn't leak between channels

### Latency Benchmarking ✅
- STT latency across different audio lengths
- Question detection latency (10 samples)
- LLM answer generation latency (streaming vs non-streaming)
- End-to-end pipeline latency (Audio → STT → Detection → LLM)
- P50/P95/P99 statistics with JSON + Markdown reports

### Hallucination & Energy Filter ✅
- Silence detection (energy threshold)
- Speech-like signal detection
- Known Whisper hallucination filtering
- Valid interview text passthrough

## Audio Fixtures

Test audio is generated using Windows TTS (System.Speech.Synthesis):

```bash
bun run test:e2e:generate-audio
```

This creates WAV files in `test-data/interview-audio/`:
- `interviewer/` — Interview questions (male voice)
- `user/` — Candidate answers (female voice)
- `acknowledgments/` — Non-question responses
- `silence/` — Silent audio for filter testing

**Format:** 16kHz, 16-bit, Mono PCM WAV

## Latency Reports

After running benchmarks, reports are generated in `e2e/reports/`:
- `latency-report-latest-{engine}.md` — Human-readable latency report
- `latency-report-latest-{engine}.json` — Machine-readable data
- `engine-comparison.md` — Side-by-side multi-engine comparison

## Architecture

```
e2e/
├── app.spec.ts              # Smoke tests (existing)
├── mock-interview.spec.ts   # Interview simulation tests
├── audio-fixtures.ts        # WAV loader + synthetic audio generators
├── ipc-test-bridge.ts       # IPC helpers for audio injection + state access
├── interview-scenarios.ts   # Pre-defined Q&A scenarios
├── latency-reporter.ts      # P50/P95/P99 tracking + report generation
├── helpers.ts               # Shared test utilities
├── reports/                 # Generated latency reports (gitignored)
└── screenshots/             # Test screenshots (gitignored)
```

## Key Design Decisions

1. **Audio injection via IPC** instead of real microphone capture — deterministic and CI-friendly
2. **Zustand store exposure** via `window.__TEST_*_STORE__` when `NODE_ENV=test` — enables direct state verification without fragile DOM scraping
3. **Multi-engine testing** with graceful skip — tests run for whichever engines are available
4. **TTS-generated audio** via Windows SAPI — reproducible test fixtures without manual recording

## Notes

- First test run may take longer due to STT model initialization
- Tests run sequentially (`workers: 1`) to avoid Electron conflicts
- LLM tests require valid API keys in settings/`.env`
- STT tests require either: Deepgram API key, Moonshine server binary, or Whisper model file
- Test artifacts (videos, traces) saved only on failure
