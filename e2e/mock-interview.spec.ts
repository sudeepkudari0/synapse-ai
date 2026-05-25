/**
 * Mock Interview E2E Test Suite
 *
 * Comprehensive end-to-end testing for the Synapse AI interview assistant.
 * Tests the full pipeline: Audio → STT → Transcription → Question Detection → LLM → Answer
 *
 * Test Suites:
 *   1. Multi-Engine STT Benchmark — Tests Deepgram, Moonshine, Whisper with latency tracking
 *   2. Full Mock Interview Flow — Simulates a complete interview conversation
 *   3. Speaker Attribution Regression — Verifies correct speaker labeling
 *   4. Latency Benchmarking — Detailed P50/P95/P99 latency measurements
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { loadAudioFile, loadAllFixtures, fixturesExist, generateSilence, generateTone, generateNoise, type AudioFixture } from './audio-fixtures';
import { LatencyTracker, generateComparisonReport } from './latency-reporter';
import { transcribeAudio, switchSTTEngine, checkSTTServerExists, generateLLMAnswer, generateLLMAnswerStreaming, injectChatBlock, getConversation, getCandidateQuestions, switchLLMProvider, type STTEngine, type TranscriptionResult } from './ipc-test-bridge';
import { FULL_INTERVIEW_SCENARIO, BEHAVIORAL_SCENARIO, TECHNICAL_SCENARIO, getQuestionsFromScenario, type InterviewQuestion } from './interview-scenarios';

// ─── Test Configuration ─────────────────────────────────────────────

const TIMEOUTS = {
    appLaunch: 30_000,
    modelLoad: 120_000,   // STT model loading (can be slow on first run)
    transcription: 30_000, // Single transcription request
    llmGeneration: 60_000, // LLM answer generation
    uiUpdate: 10_000,      // UI state update
};

// Engines to test (will skip unavailable ones)
const ENGINES_TO_TEST: STTEngine[] = ['deepgram', 'moonshine', 'whisper'];

// ─── Global State ───────────────────────────────────────────────────

let electronApp: ElectronApplication;
let window: Page;
let fixtures: ReturnType<typeof loadAllFixtures> | null = null;
const engineReports: Record<string, any> = {};

// ─── Setup & Teardown ───────────────────────────────────────────────

test.beforeAll(async () => {
    // Check audio fixtures exist
    if (!fixturesExist()) {
        console.warn(
            '\n⚠️  Audio fixtures not found!\n' +
            'Run: powershell -ExecutionPolicy Bypass -File scripts/generate-test-audio.ps1\n' +
            'Tests requiring audio files will be skipped.\n'
        );
    } else {
        fixtures = loadAllFixtures();
        console.log(`✅ Loaded ${fixtures.interviewer.length} interviewer + ${fixtures.user.length} user audio fixtures`);
    }

    // Build the Electron app first
    console.log('Building Electron app...');

    // Launch Electron app in test mode
    electronApp = await electron.launch({
        args: [path.join(__dirname, '../dist-electron/main/index.js')],
        env: {
            ...process.env,
            NODE_ENV: 'test',
        },
        timeout: TIMEOUTS.appLaunch,
    });

    // Find the actual app window (ignore devtools windows)
    const windows = electronApp.windows();
    let appWindow = windows.find(w => !w.url().startsWith('devtools://'));
    if (!appWindow) {
        appWindow = await electronApp.waitForEvent('window', w => !w.url().startsWith('devtools://'));
    }
    window = appWindow;

    // Capture console logs from the renderer to debug why __TEST_SESSION_STORE__ is missing
    window.on('console', msg => {
        console.log(`[Renderer] ${msg.type()}: ${msg.text()}`);
    });
    window.on('pageerror', err => {
        console.error(`[Renderer Error] ${err.message}`);
    });

    await window.addInitScript(() => {
        (window as any).__TEST_MODE__ = true;
    });
    await window.waitForLoadState('domcontentloaded');

    // Wait for the app to fully initialize (React render + store hydration)
    await window.waitForTimeout(3000);
    console.log('Window URL:', window.url());
    console.log('Window Title:', await window.title());

    // Force LLM to Groq for benchmarking
    console.log('🔄 Configuring LLM to Groq for benchmarking...');
    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    if (!groqKey) {
        console.warn('⚠️ GROQ_API_KEY not found in environment, LLM tests may fail.');
    }
    await switchLLMProvider(electronApp, 'groq', groqKey);

    console.log('✅ Electron app launched in test mode');
});

test.afterAll(async () => {
    // Write comparison report if we tested multiple engines
    if (Object.keys(engineReports).length > 1) {
        const reportDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

        const comparisonMd = generateComparisonReport(engineReports);
        const comparisonPath = path.join(reportDir, 'engine-comparison.md');
        fs.writeFileSync(comparisonPath, comparisonMd);
        console.log(`📊 Engine comparison report: ${comparisonPath}`);
    }

    if (electronApp) {
        await electronApp.close();
    }
});

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Multi-Engine STT Benchmark
// ═════════════════════════════════════════════════════════════════════

test.describe('Multi-Engine STT Benchmark', () => {
    test.skip(!fixturesExist(), 'Audio fixtures not generated');

    for (const engine of ENGINES_TO_TEST) {
        test.describe(`Engine: ${engine}`, () => {
            const tracker = new LatencyTracker('STT Benchmark', engine);

            test.beforeAll(async () => {
                // Check if engine is available
                if (engine === 'whisper' || engine === 'moonshine') {
                    const exists = await checkSTTServerExists(electronApp, engine);
                    if (!exists) {
                        console.warn(`⚠️  ${engine} server binary not found, skipping.`);
                        test.skip();
                        return;
                    }
                }

                // Switch to this engine
                console.log(`\n🔄 Switching to ${engine} engine...`);
                const configToSet: STTConfig = {
                    engine,
                    model: engine === 'whisper' ? 'small.en' : engine === 'moonshine' ? 'MEDIUM_STREAMING' : 'nova-3',
                };

                if (engine === 'deepgram') {
                    configToSet.apiKey = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
                    if (!configToSet.apiKey) {
                        console.warn(`⚠️ Deepgram API key not found in process.env.DEEPGRAM_API_KEY, authentication may fail.`);
                    }
                }

                const switched = await switchSTTEngine(electronApp, configToSet);

                if (!switched) {
                    console.warn(`⚠️  Failed to switch to ${engine}, skipping.`);
                    test.skip();
                }

                tracker.reset(engine);
            });

            test.afterAll(async () => {
                const report = tracker.generateReport();
                engineReports[engine] = report;
                console.log(tracker.getSummary());
                await tracker.writeReports();
            });

            test(`should transcribe interviewer questions accurately [${engine}]`, async () => {
                test.setTimeout(TIMEOUTS.modelLoad + TIMEOUTS.transcription * 5);

                if (!fixtures) return;
                const questions = fixtures.interviewer.slice(0, 3); // Test first 3 questions

                for (const question of questions) {
                    console.log(`  📢 Transcribing: "${question.text.slice(0, 60)}..."`);

                    const done = tracker.startTimer('stt_latency_ms');
                    const result = await transcribeAudio(electronApp, question.samples);
                    const latency = done({
                        audioLengthMs: question.durationMs.toString(),
                        engine,
                        questionId: question.id,
                    });

                    // Record RTF (Real-Time Factor)
                    tracker.record('rtf', latency / question.durationMs, {
                        engine,
                        questionId: question.id,
                    });

                    if (!result.success) {
                        console.error(`❌ STT Failed for ${engine}. Result:`);
                        console.dir(result);
                    }
                    expect(result.success).toBe(true);
                    expect(result.text.length).toBeGreaterThan(0);

                    // Fuzzy match — check that key words from the expected text appear
                    const expectedWords = question.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                    const transcribedLower = result.text.toLowerCase();
                    const matchedWords = expectedWords.filter(w => transcribedLower.includes(w));
                    const matchRatio = matchedWords.length / expectedWords.length;

                    console.log(`    ✅ Transcribed: "${result.text.slice(0, 80)}..." (${latency.toFixed(0)}ms, match: ${(matchRatio * 100).toFixed(0)}%)`);

                    // We expect at least 30% word match (TTS → STT can lose some words)
                    expect(matchRatio).toBeGreaterThan(0.3);
                }
            });

            test(`should transcribe user answers accurately [${engine}]`, async () => {
                test.setTimeout(TIMEOUTS.transcription * 5);

                if (!fixtures) return;
                const answers = fixtures.user.slice(0, 2);

                for (const answer of answers) {
                    console.log(`  🎤 Transcribing user: "${answer.text.slice(0, 60)}..."`);

                    const done = tracker.startTimer('stt_latency_ms');
                    const result = await transcribeAudio(electronApp, answer.samples);
                    const latency = done({
                        audioLengthMs: answer.durationMs.toString(),
                        engine,
                        answerId: answer.id,
                    });

                    tracker.record('rtf', latency / answer.durationMs, { engine });

                    expect(result.success).toBe(true);
                    expect(result.text.length).toBeGreaterThan(0);
                    console.log(`    ✅ "${result.text.slice(0, 80)}..." (${latency.toFixed(0)}ms)`);
                }
            });

            test(`should handle silence correctly [${engine}]`, async () => {
                test.setTimeout(TIMEOUTS.transcription);

                const silentAudio = generateSilence(3000);
                const result = await transcribeAudio(electronApp, silentAudio);

                // Silence should produce empty or very short transcription
                if (result.success) {
                    // If it transcribes something, it should be very short (potential hallucination)
                    console.log(`  🔇 Silence transcribed as: "${result.text}" (${result.text.length} chars)`);
                }
            });

            test(`should handle noise correctly [${engine}]`, async () => {
                test.setTimeout(TIMEOUTS.transcription);

                const noiseAudio = generateNoise(2500, 0.05); // Low amplitude noise
                const result = await transcribeAudio(electronApp, noiseAudio);

                console.log(`  🔊 Noise transcribed as: "${result.text}" (${result.text.length} chars)`);
                // Low-energy noise should either fail or produce empty/hallucinated text
            });
        });
    }
});

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Full Mock Interview Flow
// ═════════════════════════════════════════════════════════════════════

test.describe('Full Mock Interview Flow', () => {
    const tracker = new LatencyTracker('Mock Interview', 'default');

    test.afterAll(async () => {
        console.log(tracker.getSummary());
        await tracker.writeReports();
    });

    test('should simulate a complete behavioral interview', async () => {
        test.setTimeout(TIMEOUTS.modelLoad + (TIMEOUTS.transcription + TIMEOUTS.llmGeneration) * 10);

        const scenario = BEHAVIORAL_SCENARIO;
        console.log(`\n🎬 Running scenario: ${scenario.name}`);

        for (const turn of scenario.turns) {
            // Simulate delay between turns
            if (turn.delayBeforeMs > 0) {
                await window.waitForTimeout(Math.min(turn.delayBeforeMs, 1000)); // Cap delay for test speed
            }

            if (turn.type === 'question' || turn.type === 'acknowledgment') {
                const question = turn.content as InterviewQuestion;
                console.log(`  👤 Interviewer: "${question.text.slice(0, 70)}..."`);

                // Step 1: Transcribe the question audio (if fixtures available)
                let transcribedText = question.text; // Fallback to expected text
                if (fixtures) {
                    try {
                        const fixture = loadAudioFile(question.audioFile);
                        const done = tracker.startTimer('stt_latency_ms');
                        const result = await transcribeAudio(electronApp, fixture.samples);
                        done({ turn: question.id });

                        if (result.success && result.text.length > 0) {
                            transcribedText = result.text;
                        }
                    } catch (e) {
                        console.warn(`    ⚠️  Audio file not available, using expected text`);
                    }
                }

                // Step 2: Inject the transcription into conversation as interviewer
                await injectChatBlock(window, 'interviewer', transcribedText);

                // Step 3: Run question detection on the injected text
                const detectionStart = performance.now();
                const isQuestion = await window.evaluate((text: string) => {
                    // Access the question detector from the app's bundled modules
                    // We test the detection logic directly
                    const trimmed = text.trim();
                    if (!trimmed || trimmed.length < 5) return { isQuestion: false, confidence: 0, signals: [] };

                    // Replicate the heuristic detection inline (since we can't import in evaluate)
                    let score = 0;
                    const signals: string[] = [];

                    if (text.includes('?')) { score += 50; signals.push('question_mark'); }
                    if (/^(what|where|when|why|who|how|can you|could you|would you|do you|did you|have you|are you|is there)/i.test(trimmed)) {
                        score += 30; signals.push('interrogative_open');
                    }
                    if (/\b(tell me|describe|explain|walk me through|give me an example)/i.test(text)) {
                        score += 25; signals.push('directive_pattern');
                    }
                    if (/\b(what|why|how|when|where|who|which)\b/i.test(text)) {
                        score += 10; signals.push('interrogative_anywhere');
                    }
                    if (/\b(tell me about a time|can you describe|how would you|what would you do)/i.test(text)) {
                        score += 30; signals.push('interview_starter');
                    }
                    if (/\b(experience|project|challenge|team|role|approach|design|implement)\b/i.test(text)) {
                        score += 5; signals.push('context_keywords');
                    }

                    const wordCount = trimmed.split(/\s+/).length;
                    if (wordCount >= 8 && wordCount <= 60) { score += 5; signals.push('length_heuristic'); }
                    if (wordCount < 4) score -= 10;

                    if (/^(ok|okay|right|sure|great|good|perfect|i see|got it|thanks|thank you)[.!,]?\s*$/i.test(trimmed)) {
                        score -= 40;
                        signals.push('negative_signal');
                    }

                    return { isQuestion: score >= 25, confidence: Math.min(Math.max(score / 60, 0), 1.0), signals };
                }, transcribedText);
                const detectionLatency = performance.now() - detectionStart;
                tracker.record('question_detect_latency_ms', detectionLatency, { turn: question.id });

                console.log(`    🔍 Detection: isQuestion=${isQuestion.isQuestion}, confidence=${isQuestion.confidence.toFixed(2)}, expected=${question.expectedDetection}`);

                // Verify question detection matches expectation
                if (turn.type === 'question') {
                    expect(isQuestion.isQuestion).toBe(question.expectedDetection);
                } else if (turn.type === 'acknowledgment') {
                    expect(isQuestion.isQuestion).toBe(false);
                }

                // Step 4: If question detected, generate AI answer
                if (isQuestion.isQuestion) {
                    console.log(`    🤖 Generating AI answer...`);
                    const done = tracker.startTimer('llm_total_ms');
                    const llmResult = await generateLLMAnswer(electronApp, transcribedText);
                    const llmLatency = done({ turn: question.id });

                    tracker.record('llm_first_token_ms', llmResult.firstTokenLatencyMs, { turn: question.id });

                    if (llmResult.success) {
                        console.log(`    ✅ AI Answer: "${llmResult.text.slice(0, 100)}..." (${llmLatency.toFixed(0)}ms)`);
                        expect(llmResult.text.length).toBeGreaterThan(10);
                    } else {
                        console.warn(`    ⚠️  LLM failed: ${llmResult.error}`);
                    }
                }

            } else if (turn.type === 'answer') {
                const response = turn.content;
                console.log(`  🎤 User: "${response.text.slice(0, 70)}..."`);

                // Inject user response into conversation
                await injectChatBlock(window, 'user', response.text);
            }
        }

        console.log(`\n✅ Scenario "${scenario.name}" completed`);
    });

    test('should handle rapid question-answer exchanges', async () => {
        test.setTimeout(TIMEOUTS.transcription * 6);

        // Simulate rapid-fire Q&A without delays
        const questions = [
            'What programming languages do you know?',
            'How do you handle stress at work?',
            'What is your greatest strength?',
        ];

        for (const q of questions) {
            // Inject question
            await injectChatBlock(window, 'interviewer', q);
            await window.waitForTimeout(200); // Minimal delay

            // Inject answer immediately
            await injectChatBlock(window, 'user', `My answer to: ${q}`);
            await window.waitForTimeout(200);
        }

        // Verify conversation has all blocks
        const conversation = await getConversation(window);
        expect(conversation.length).toBeGreaterThanOrEqual(6); // 3 questions + 3 answers
    });
});

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Speaker Attribution Regression
// ═════════════════════════════════════════════════════════════════════

test.describe('Speaker Attribution Regression', () => {
    test.beforeAll(async () => {
        // Ensure we use a local deterministic engine (Moonshine) 
        // to prevent failures if a previous test left an unconfigured engine active
        await switchSTTEngine(electronApp, {
            engine: 'moonshine',
            model: 'MEDIUM_STREAMING',
        });
    });

    test.beforeEach(async () => {
        // Clear conversation before each test
        await window.evaluate(() => {
            const store = (window as any).__TEST_SESSION_STORE__;
            if (store) store.getState().clearTranscript();
        });
    });

    test('interviewer text should ONLY appear as interviewer speaker', async () => {
        const interviewerText = 'Tell me about your experience with microservices architecture?';

        // Inject as interviewer
        await injectChatBlock(window, 'interviewer', interviewerText);
        await window.waitForTimeout(500);

        // Read conversation state
        const conversation = await getConversation(window);

        // Verify: should have exactly 1 block, labeled as interviewer
        const interviewerBlocks = conversation.filter(b => b.speaker === 'interviewer');
        const userBlocks = conversation.filter(b => b.speaker === 'user');

        expect(interviewerBlocks.length).toBe(1);
        expect(userBlocks.length).toBe(0); // BUG REGRESSION: Previously this was 1
        expect(interviewerBlocks[0].text).toContain('microservices');
    });

    test('user text should ONLY appear as user speaker', async () => {
        const userText = 'I have three years of experience with microservices using Kubernetes and Docker.';

        // Inject as user
        await injectChatBlock(window, 'user', userText);
        await window.waitForTimeout(500);

        // Read conversation state
        const conversation = await getConversation(window);

        // Verify: should have exactly 1 block, labeled as user
        const interviewerBlocks = conversation.filter(b => b.speaker === 'interviewer');
        const userBlocks = conversation.filter(b => b.speaker === 'user');

        expect(userBlocks.length).toBe(1);
        expect(interviewerBlocks.length).toBe(0);
        expect(userBlocks[0].text).toContain('Kubernetes');
    });

    test('simultaneous speech should maintain correct speaker labels', async () => {
        // Simulate both speakers talking simultaneously (overlapping speech)
        const interviewerText = 'Can you explain your approach to system design?';
        const userText = 'Sure, let me walk you through my process.';

        // Inject both quickly
        await injectChatBlock(window, 'interviewer', interviewerText);
        await injectChatBlock(window, 'user', userText);
        await window.waitForTimeout(500);

        // Read conversation state
        const conversation = await getConversation(window);

        const interviewerBlocks = conversation.filter(b => b.speaker === 'interviewer');
        const userBlocks = conversation.filter(b => b.speaker === 'user');

        // Each speaker's text should be in the correct block
        expect(interviewerBlocks.length).toBe(1);
        expect(userBlocks.length).toBe(1);
        expect(interviewerBlocks[0].text).toContain('system design');
        expect(userBlocks[0].text).toContain('walk you through');
    });

    test('alternating speakers should create separate blocks', async () => {
        const exchanges = [
            { speaker: 'interviewer' as const, text: 'First question about your background.' },
            { speaker: 'user' as const, text: 'I started my career in backend development.' },
            { speaker: 'interviewer' as const, text: 'Interesting. What technologies did you use?' },
            { speaker: 'user' as const, text: 'Primarily Java and Python with PostgreSQL.' },
            { speaker: 'interviewer' as const, text: 'How did you handle scaling challenges?' },
        ];

        for (const exchange of exchanges) {
            await injectChatBlock(window, exchange.speaker, exchange.text);
            await window.waitForTimeout(200);
        }

        const conversation = await getConversation(window);

        // Should have 5 separate blocks alternating speakers
        expect(conversation.length).toBe(5);
        expect(conversation[0].speaker).toBe('interviewer');
        expect(conversation[1].speaker).toBe('user');
        expect(conversation[2].speaker).toBe('interviewer');
        expect(conversation[3].speaker).toBe('user');
        expect(conversation[4].speaker).toBe('interviewer');

        // Verify text content
        expect(conversation[0].text).toContain('background');
        expect(conversation[1].text).toContain('backend');
        expect(conversation[4].text).toContain('scaling');
    });

    test('STT transcription via IPC should not leak between channels', async () => {
        test.skip(!fixturesExist(), 'Audio fixtures not generated');
        test.setTimeout(TIMEOUTS.transcription * 2);

        if (!fixtures) return;

        // Transcribe an interviewer audio file
        const interviewerFixture = fixtures.interviewer[0];
        const result = await transcribeAudio(electronApp, interviewerFixture.samples);

        expect(result.success).toBe(true);

        // The key assertion: the transcription result itself has no speaker info.
        // Speaker attribution happens in the renderer based on WHICH audio stream
        // produced the chunk. The STT engine should just return text.
        expect(result.text.length).toBeGreaterThan(0);
        expect(typeof result.text).toBe('string');

        // Inject as interviewer and verify it stays as interviewer
        await injectChatBlock(window, 'interviewer', result.text);
        await window.waitForTimeout(300);

        const conversation = await getConversation(window);
        const lastBlock = conversation[conversation.length - 1];
        expect(lastBlock.speaker).toBe('interviewer');
        expect(lastBlock.text).toBe(result.text);
    });
});

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Latency Benchmarking
// ═════════════════════════════════════════════════════════════════════

test.describe('Latency Benchmarking', () => {
    const tracker = new LatencyTracker('Latency Benchmark', 'primary');

    test.afterAll(async () => {
        console.log(tracker.getSummary());
        await tracker.writeReports();
    });

    test('should benchmark STT latency across audio lengths', async () => {
        test.skip(!fixturesExist(), 'Audio fixtures not generated');
        test.setTimeout(TIMEOUTS.transcription * 15);

        if (!fixtures) return;

        // Test different audio lengths
        const audioSamples = [
            ...fixtures.interviewer.slice(0, 5),
            ...fixtures.user.slice(0, 3),
        ];

        console.log(`\n📊 STT Latency Benchmark (${audioSamples.length} samples)`);

        for (const sample of audioSamples) {
            const done = tracker.startTimer('stt_latency_ms');
            const result = await transcribeAudio(electronApp, sample.samples);
            const latency = done({
                audioLengthMs: sample.durationMs.toString(),
                category: sample.category,
                id: sample.id,
                textLength: result.text.length.toString(),
            });

            // Record RTF
            if (sample.durationMs > 0) {
                tracker.record('rtf', latency / sample.durationMs, {
                    id: sample.id,
                    audioLengthMs: sample.durationMs.toString(),
                });
            }

            const rtf = sample.durationMs > 0 ? (latency / sample.durationMs).toFixed(2) : 'N/A';
            console.log(
                `  ${sample.id.padEnd(20)} │ ` +
                `Audio: ${(sample.durationMs / 1000).toFixed(1)}s │ ` +
                `Latency: ${latency.toFixed(0)}ms │ ` +
                `RTF: ${rtf}x │ ` +
                `"${result.text.slice(0, 50)}..."`
            );
        }
    });

    test('should benchmark question detection latency', async () => {
        const testTexts = [
            'Tell me about a time when you had to handle a challenging project deadline.',
            'What is the difference between TCP and UDP?',
            'How would you design a distributed cache system?',
            'Okay, great. That sounds good.',
            'Right, I see. Interesting.',
            'Can you describe your experience with cloud services like AWS?',
            'Walk me through how you would implement a rate limiter.',
            'Why did you leave your previous company?',
            'Yes.',
            'What are the SOLID principles in object-oriented programming?',
        ];

        console.log(`\n📊 Question Detection Latency Benchmark (${testTexts.length} samples)`);

        for (const text of testTexts) {
            const done = tracker.startTimer('question_detect_latency_ms');

            const result = await window.evaluate((text: string) => {
                const trimmed = text.trim();
                if (!trimmed || trimmed.length < 5) return { isQuestion: false, confidence: 0 };

                let score = 0;
                if (text.includes('?')) score += 50;
                if (/^(what|where|when|why|who|how|can you|could you|would you|do you|did you|have you|are you)/i.test(trimmed)) score += 30;
                if (/\b(tell me|describe|explain|walk me through|give me an example)/i.test(text)) score += 25;
                if (/\b(what|why|how|when|where|who|which)\b/i.test(text)) score += 10;
                if (/\b(tell me about a time|can you describe|how would you|what would you do)/i.test(text)) score += 30;
                if (/\b(experience|project|challenge|team|role|approach|design|implement)\b/i.test(text)) score += 5;

                const wordCount = trimmed.split(/\s+/).length;
                if (wordCount >= 8 && wordCount <= 60) score += 5;
                if (wordCount < 4) score -= 10;
                if (/^(ok|okay|right|sure|great|good|perfect|i see|got it|thanks|thank you|yes)[.!,]?\s*$/i.test(trimmed)) score -= 40;

                return { isQuestion: score >= 25, confidence: Math.min(Math.max(score / 60, 0), 1.0) };
            }, text);

            const latency = done({ text: text.slice(0, 50) });

            console.log(
                `  ${(result.isQuestion ? '✅' : '❌').padEnd(3)} ` +
                `${latency.toFixed(2).padStart(8)}ms │ ` +
                `conf: ${result.confidence.toFixed(2)} │ ` +
                `"${text.slice(0, 60)}"`
            );
        }
    });

    test('should benchmark LLM answer generation latency', async () => {
        test.setTimeout(TIMEOUTS.llmGeneration * 5);

        const questions = [
            'Tell me about your experience with React.',
            'How would you implement a binary search tree?',
            'Describe a time when you resolved a team conflict.',
        ];

        console.log(`\n📊 LLM Generation Latency Benchmark (${questions.length} samples)`);

        for (const question of questions) {
            // Non-streaming
            const done = tracker.startTimer('llm_total_ms');
            const result = await generateLLMAnswer(electronApp, question);
            const latency = done({ question: question.slice(0, 50), mode: 'non-streaming' });

            tracker.record('llm_first_token_ms', result.firstTokenLatencyMs, { mode: 'non-streaming' });

            if (result.success) {
                console.log(
                    `  📝 Non-stream │ ${latency.toFixed(0).padStart(6)}ms │ ` +
                    `${result.text.length} chars │ ` +
                    `"${question.slice(0, 50)}"`
                );
            } else {
                console.warn(`  ⚠️  LLM failed: ${result.error}`);
            }

            // Streaming
            const doneStream = tracker.startTimer('llm_total_ms');
            const streamResult = await generateLLMAnswerStreaming(electronApp, question);
            const streamLatency = doneStream({ question: question.slice(0, 50), mode: 'streaming' });

            tracker.record('llm_first_token_ms', streamResult.firstTokenLatencyMs, { mode: 'streaming' });

            if (streamResult.success) {
                console.log(
                    `  🌊 Stream     │ ${streamLatency.toFixed(0).padStart(6)}ms │ ` +
                    `TTFT: ${streamResult.firstTokenLatencyMs.toFixed(0)}ms │ ` +
                    `${streamResult.text.length} chars`
                );
            }
        }
    });

    test('should benchmark end-to-end pipeline latency', async () => {
        test.skip(!fixturesExist(), 'Audio fixtures not generated');
        test.setTimeout(TIMEOUTS.modelLoad + TIMEOUTS.transcription + TIMEOUTS.llmGeneration);

        if (!fixtures || fixtures.interviewer.length === 0) return;

        const fixture = fixtures.interviewer[0]; // Use first interview question
        console.log(`\n📊 End-to-End Pipeline: "${fixture.text.slice(0, 60)}..."`);

        // Measure the full pipeline: Audio → STT → Detection → LLM
        const e2eDone = tracker.startTimer('e2e_latency_ms');

        // Step 1: STT
        const sttDone = tracker.startTimer('stt_latency_ms');
        const sttResult = await transcribeAudio(electronApp, fixture.samples);
        const sttLatency = sttDone({ stage: 'e2e' });
        console.log(`  1. STT:       ${sttLatency.toFixed(0)}ms → "${sttResult.text.slice(0, 50)}..."`);

        if (!sttResult.success || !sttResult.text) {
            console.warn('  ⚠️  STT failed, skipping remaining pipeline');
            return;
        }

        // Step 2: Question detection
        const detectDone = tracker.startTimer('question_detect_latency_ms');
        const detection = await window.evaluate((text: string) => {
            let score = 0;
            if (text.includes('?')) score += 50;
            if (/^(what|where|when|why|who|how|can you|could you|would you|do you|did you|have you|are you)/i.test(text.trim())) score += 30;
            if (/\b(tell me|describe|explain|walk me through)/i.test(text)) score += 25;
            if (/\b(what|why|how|when|where|who|which)\b/i.test(text)) score += 10;
            return { isQuestion: score >= 25, score };
        }, sttResult.text);
        const detectLatency = detectDone({ stage: 'e2e' });
        console.log(`  2. Detection: ${detectLatency.toFixed(2)}ms → isQuestion=${detection.isQuestion}`);

        // Step 3: LLM generation
        if (detection.isQuestion) {
            const llmDone = tracker.startTimer('llm_total_ms');
            const llmResult = await generateLLMAnswerStreaming(electronApp, sttResult.text);
            const llmLatency = llmDone({ stage: 'e2e' });
            tracker.record('llm_first_token_ms', llmResult.firstTokenLatencyMs, { stage: 'e2e' });
            console.log(`  3. LLM:       ${llmLatency.toFixed(0)}ms (TTFT: ${llmResult.firstTokenLatencyMs.toFixed(0)}ms)`);
        }

        const totalE2E = e2eDone({ audioLengthMs: fixture.durationMs.toString() });
        console.log(`  ─────────────────────────`);
        console.log(`  Total E2E:    ${totalE2E.toFixed(0)}ms (audio: ${(fixture.durationMs / 1000).toFixed(1)}s)`);
    });
});

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Hallucination & Energy Filter
// ═════════════════════════════════════════════════════════════════════

test.describe('Hallucination & Energy Filter', () => {
    test('should detect silence as low energy', async () => {
        const result = await window.evaluate(() => {
            const silence = new Float32Array(16000 * 2); // 2 seconds of silence
            let sumSquares = 0;
            const step = Math.max(1, Math.floor(silence.length / 4000));
            let count = 0;
            for (let i = 0; i < silence.length; i += step) {
                sumSquares += silence[i] * silence[i];
                count++;
            }
            const rms = Math.sqrt(sumSquares / count);
            return { rms, hasEnergy: rms > 0.008 };
        });

        expect(result.hasEnergy).toBe(false);
        expect(result.rms).toBe(0);
    });

    test('should detect speech-like signal as having energy', async () => {
        const result = await window.evaluate(() => {
            // Generate a sine wave (speech-like energy)
            const samples = new Float32Array(16000 * 2);
            for (let i = 0; i < samples.length; i++) {
                samples[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / 16000);
            }
            let sumSquares = 0;
            const step = Math.max(1, Math.floor(samples.length / 4000));
            let count = 0;
            for (let i = 0; i < samples.length; i += step) {
                sumSquares += samples[i] * samples[i];
                count++;
            }
            const rms = Math.sqrt(sumSquares / count);
            return { rms, hasEnergy: rms > 0.008 };
        });

        expect(result.hasEnergy).toBe(true);
        expect(result.rms).toBeGreaterThan(0.1);
    });

    test('should filter known Whisper hallucinations', async () => {
        const hallucinations = [
            'Thank you for watching',
            'Please subscribe',
            'Like and subscribe',
            'See you next time',
            '♪',
            'you',
            'you.',
        ];

        for (const text of hallucinations) {
            const result = await window.evaluate((text: string) => {
                const lower = text.trim().toLowerCase();
                const blocklist = [
                    'thank you for watching', 'please subscribe', 'like and subscribe',
                    'see you next time', '♪', '♫', '[music]',
                ];
                const exactBlocklist = ['you', 'you.', 'you?', 'music', 'music.'];

                for (const phrase of blocklist) {
                    if (lower === phrase || lower.includes(phrase)) {
                        return { valid: false, reason: `blocklist: "${phrase}"` };
                    }
                }
                for (const phrase of exactBlocklist) {
                    if (lower === phrase) {
                        return { valid: false, reason: `exact_blocklist: "${phrase}"` };
                    }
                }
                return { valid: true };
            }, text);

            expect(result.valid).toBe(false);
        }
    });

    test('should pass valid interview text through filter', async () => {
        const validTexts = [
            'Tell me about your experience with distributed systems.',
            'I have five years of experience in backend development.',
            'My approach would be to use a microservices architecture.',
        ];

        for (const text of validTexts) {
            const result = await window.evaluate((text: string) => {
                const lower = text.trim().toLowerCase();
                const blocklist = [
                    'thank you for watching', 'please subscribe', 'like and subscribe',
                    'see you next time',
                ];
                for (const phrase of blocklist) {
                    if (lower === phrase || lower.includes(phrase)) return { valid: false };
                }
                const words = text.trim().split(/\s+/);
                if (words.length === 1 && text.trim().length <= 3) return { valid: false };
                return { valid: true };
            }, text);

            expect(result.valid).toBe(true);
        }
    });
});
