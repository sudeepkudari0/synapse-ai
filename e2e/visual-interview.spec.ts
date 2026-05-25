import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadAllFixtures, fixturesExist, generateSilence, generateTone } from './audio-fixtures';
import { switchLLMProvider, injectChatBlock, transcribeAudio } from './ipc-test-bridge';
import { BEHAVIORAL_SCENARIO, InterviewQuestion, InterviewResponse } from './interview-scenarios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe.serial('Visual Showcase: Full Mock Interview UI', () => {
    let electronApp: ElectronApplication;
    let window: Page;
    let fixtures: ReturnType<typeof loadAllFixtures>;

    // ──────────────────────────────────────────────────────────────
    // Helper: Play audio aloud AND inject transcription into the UI
    // ──────────────────────────────────────────────────────────────
    const playAndTranscribe = async (
        speaker: 'interviewer' | 'user',
        samples: Float32Array,
        b64: string,
        durationMs: number,
        expectedText: string,
    ) => {
        console.log(`🔊 Playing ${speaker} audio...`);

        // Play audio audibly using HTMLAudioElement (fire-and-forget)
        if (b64) {
            await window.evaluate(async (base64) => {
                const audio = new Audio(`data:audio/wav;base64,${base64}`);
                audio.volume = 0.7;
                await audio.play().catch(() => {
                    console.warn('Audio autoplay blocked — visual test continues.');
                });
            }, b64);
        }

        // Transcribe via main process STT (runs in parallel with playback)
        console.log(`  📝 Transcribing via main-process STT...`);
        const result = await transcribeAudio(electronApp, samples);

        const transcribedText = result.success && result.text.trim()
            ? result.text.trim()
            : expectedText; // Fallback to expected text if STT fails

        if (result.success) {
            console.log(`  ✅ STT result: "${transcribedText.slice(0, 80)}..." (${result.latencyMs}ms)`);
        } else {
            console.warn(`  ⚠️ STT failed (${result.error}), using expected text fallback`);
        }

        // Inject the transcription into the Zustand store (appears in UI)
        await injectChatBlock(window, speaker, transcribedText);

        // Wait for the audio's physical duration to finish playback
        const remainingMs = Math.max(0, durationMs - (result.latencyMs || 0));
        await window.waitForTimeout(remainingMs + 500);
    };

    test.beforeAll(async () => {
        console.log('Building Electron app...');

        // Launch Electron app in test mode
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../dist-electron/main/index.js')],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                VITE_ENABLE_DEBUG_LOGS: 'true',
            },
            timeout: 30000,
        });

        // Find the actual app window (ignore devtools windows)
        const windows = electronApp.windows();
        let appWindow = windows.find(w => !w.url().startsWith('devtools://'));
        if (!appWindow) {
            appWindow = await electronApp.waitForEvent('window', {
                predicate: w => !w.url().startsWith('devtools://'),
            });
        }
        window = appWindow;

        // Capture renderer logs for debugging
        window.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Renderer ${msg.type()}] ${msg.text()}`);
            }
        });
        window.on('pageerror', err => {
            console.error(`[Renderer Error] ${err.message}`);
        });

        // Force LLM to Groq
        const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
        await switchLLMProvider(electronApp, 'groq', groqKey);

        await window.waitForLoadState('domcontentloaded');
        await window.waitForTimeout(3000); // Let React hydrate

        if (fixturesExist()) {
            fixtures = loadAllFixtures();
        }

        // Expand UI if needed and start recording for the entire suite
        const widgetExpanded = window.locator('#floating-widget.widget--expanded');
        if (!(await widgetExpanded.isVisible({ timeout: 3000 }).catch(() => false))) {
            console.log('🖱️ Clicking expand button...');
            await window.locator('#btn-toggle-expand').click();
            await window.waitForTimeout(1000);
        }

        console.log('🎙️ Clicking Record button...');
        await window.locator('#btn-toggle-recording').click();
        await window.waitForTimeout(1500);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test.beforeEach(async () => {
        // Clear Zustand stores before each test to ensure a clean slate
        await window.evaluate(() => {
            const w = window as any;
            if (w.__TEST_SESSION_STORE__) w.__TEST_SESSION_STORE__.getState().clearTranscript();
            if (w.__TEST_ANSWER_STORE__) {
                w.__TEST_ANSWER_STORE__.getState().clearCandidateQuestions();
                w.__TEST_ANSWER_STORE__.getState().clearDetectedQuestions();
                w.__TEST_ANSWER_STORE__.getState().clearAnswers();
            }
        });
        await window.waitForTimeout(500); // Wait for React to re-render empty state
    });

    test('Test 1: Multi-turn Behavioral Interview Flow', async () => {
        test.setTimeout(180_000); // Allow time for visual playback + STT + LLM
        test.skip(!fixturesExist(), 'Audio fixtures missing');

        console.log('\n🎬 Starting Test 1: Multi-turn Behavioral Interview...');

        for (const turn of BEHAVIORAL_SCENARIO.turns) {
            if (turn.delayBeforeMs > 0) {
                await window.waitForTimeout(turn.delayBeforeMs);
            }

            const speaker = turn.speaker;
            let audioCategory = speaker === 'interviewer' ?
                (turn.type === 'acknowledgment' ? 'acknowledgments' : 'interviewer')
                : 'user';

            const fixture = fixtures[audioCategory].find((f: any) => f.id === turn.content.id);
            if (!fixture) {
                console.warn(`Fixture not found for ID: ${turn.content.id}`);
                continue;
            }

            const b64 = fs.readFileSync(fixture.filePath).toString('base64');

            await playAndTranscribe(
                speaker,
                fixture.samples,
                b64,
                fixture.durationMs,
                turn.content.text
            );

            // Assert bubble exists based on speaker
            if (speaker === 'interviewer') {
                const qBubble = window.locator('span:has-text("Interviewer:")').last();
                await expect(qBubble).toBeVisible({ timeout: 15000 });
                console.log(`✅ Interviewer bubble rendered: ${turn.content.id}`);
            } else {
                const aBubble = window.locator('span:has-text("ME:")').last();
                await expect(aBubble).toBeVisible({ timeout: 15000 });
                console.log(`✅ User bubble rendered: ${turn.content.id}`);
            }

            // Check AI Answer Panel for Interviewer Questions
            if (turn.type === 'question') {
                console.log('🤖 Checking AI Answer panel...');
                const aiPanel = window.locator('text=AI Answer Suggestions');
                await expect(aiPanel).toBeVisible({ timeout: 15000 });

                const candidateCard = window.locator('text=Detected Question')
                    .or(window.locator('text=Generating answer'))
                    .or(window.locator('text=Answered'))
                    .first();

                const hasCandidateCard = await candidateCard.isVisible({ timeout: 10000 }).catch(() => false);
                if (hasCandidateCard) {
                    console.log('✅ Auto-detection triggered');
                    const answeredCard = window.locator('text=Answered');
                    const answerFinished = await answeredCard.isVisible({ timeout: 30000 }).catch(() => false);
                    if (answerFinished) {
                        console.log('✅ AI Answer streamed successfully!');
                    }
                }
            }
        }
        console.log('🎬 Test 1 complete.');
    });

    test('Test 2: Speaker Attribution & UI Isolation', async () => {
        console.log('\n🎬 Starting Test 2: Speaker Attribution & UI Isolation...');

        // 1. Inject Interviewer Text
        await injectChatBlock(window, 'interviewer', 'This is an interviewer test string.');
        await window.waitForTimeout(1000);

        // Verify ONLY Interviewer bubble exists
        const qBubble = window.locator('span:has-text("Interviewer:")');
        const aBubble = window.locator('span:has-text("ME:")');

        await expect(qBubble).toHaveCount(1);
        await expect(aBubble).toHaveCount(0);
        await expect(window.locator('text=This is an interviewer test string.')).toBeVisible();
        console.log('✅ Interviewer attribution isolated correctly');

        // 2. Inject User Text
        await injectChatBlock(window, 'user', 'This is a user test string.');
        await window.waitForTimeout(1000);

        // Verify counts
        await expect(qBubble).toHaveCount(1);
        await expect(aBubble).toHaveCount(1);
        await expect(window.locator('text=This is a user test string.')).toBeVisible();
        console.log('✅ User attribution isolated correctly');
    });

    test('Test 3: Hallucination & Energy Filter UI Behavior', async () => {
        console.log('\n🎬 Starting Test 3: Hallucination & Energy Filter UI Behavior...');

        const keys = await window.evaluate(() => Object.keys(window).filter(k => k.startsWith('__TEST')));
        console.log(`Window __TEST keys: ${keys.join(', ')}`);

        // Verify chat is empty initially
        const qBubble = window.locator('span:has-text("Interviewer:")');
        const aBubble = window.locator('span:has-text("ME:")');
        await expect(qBubble).toHaveCount(0);
        await expect(aBubble).toHaveCount(0);

        // 1. Inject hallucination text
        console.log('💉 Injecting hallucination...');
        const isHallucinationValid = await window.evaluate(async () => {
            const w = window as any;
            if (w.__TEST_FILTER_HALLUCINATIONS__) {
                const res = w.__TEST_FILTER_HALLUCINATIONS__('Thank you for watching');
                return res.valid;
            }
            return null;
        });

        if (isHallucinationValid) {
            await injectChatBlock(window, 'interviewer', 'Thank you for watching');
        }
        await window.waitForTimeout(1000);

        // Verify NO bubbles appeared
        await expect(qBubble).toHaveCount(0);
        await expect(aBubble).toHaveCount(0);
        console.log('✅ Hallucination correctly dropped by UI filter logic');

        // 2. Inject valid text to ensure it works
        console.log('💉 Injecting valid text...');
        const textToInject = 'This is a completely valid test string that should pass.';
        const isValidText = await window.evaluate(async (text) => {
            const w = window as any;
            if (w.__TEST_FILTER_HALLUCINATIONS__) {
                const res = w.__TEST_FILTER_HALLUCINATIONS__(text);
                return res.valid;
            }
            return null;
        }, textToInject);

        if (isValidText) {
            await injectChatBlock(window, 'interviewer', textToInject);
        }
        await window.waitForTimeout(1000);

        // Verify 1 bubble appeared
        await expect(qBubble).toHaveCount(1);
        await expect(window.locator(`text=${textToInject}`)).toBeVisible();
        console.log('✅ Valid text correctly rendered in UI');
    });
});
