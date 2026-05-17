import { useCallback, useRef, useEffect, useState } from 'react';
import { FloatingWidget } from './components/FloatingWidget/FloatingWidget';
import { RegionSelector } from './components/RegionSelector/RegionSelector';
import { useWhisper } from './hooks/useWhisper';
import { useMixedAudioRecorder, SpeakerSource } from './hooks/useMixedAudioRecorder';
import { useLLM } from './hooks/useLLM';
import { useProfile } from './hooks/useProfile';
import { classifyQuestion } from './lib/interview-classifier';
import { isQuestionSync } from './lib/question-detector';
import { predictFollowUps } from './lib/follow-up-predictor';
import { analyzeDelivery } from './lib/delivery-analyzer';
import { getCodeAnalysisPrompt } from './lib/prompts/templates/code-analysis';
import { TimestampDeduplicator } from './lib/timestamp-deduplicator';
import { filterHallucinations } from './lib/hallucination-filter';
import { useSessionStore, useAnswerStore, useUIStore } from './state';
import type { ChatBlock, Answer } from './state';

function App(): JSX.Element {
    // ─── Zustand stores ───
    const {
        conversation, isRecording, sessionTime,
        setConversation, setIsRecording, setSessionTime, clearTranscript, resetSession,
    } = useSessionStore();

    const {
        answers, currentAnswerIndex, isGenerating,
        addAnswer, updateAnswer, removeAnswer, navigateAnswer, clearAnswers, setIsGenerating,
    } = useAnswerStore();

    const {
        isExpanded, isSettingsOpen, isChatOpen, isHistoryOpen, isPracticeOpen, isCapturing, isCodeMode, useBulletPoints,
        toggleExpanded, setExpanded, toggleSettings, toggleChat, toggleHistory, togglePractice, setCapturing,
    } = useUIStore();

    // ─── Refs (not state — no re-render needed) ───
    const transcriptionQueueRef = useRef<{source: SpeakerSource, chunk: Float32Array}[]>([]);
    const isTranscribingRef = useRef(false);
    const userStabilizerRef = useRef(new TimestampDeduplicator());
    const interviewerStabilizerRef = useRef(new TimestampDeduplicator());
    const conversationRef = useRef<ChatBlock[]>([]);
    const autoGenerateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoCaptureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastAnswerTimeRef = useRef<number>(0);

    // Sync conversationRef with store
    useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    // ─── Hooks ───
    const { isModelLoading, isModelLoaded, modelError, loadModel, transcribe } = useWhisper();
    const { generateAnswerWithTemplate, generateResponse } = useLLM();
    const { profile } = useProfile();

    // ─── Pre-load Whisper model on startup ───
    useEffect(() => {
        loadModel();
    }, [loadModel]);

    // ─── Session timer ───
    useEffect(() => {
        if (isRecording) {
            sessionTimerRef.current = setInterval(() => {
                setSessionTime((prev: number) => prev + 1);
            }, 1000);
        } else {
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }
        }
        return () => {
            if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
        };
    }, [isRecording, setSessionTime]);

    // ─── Auto-capture in Code Mode ───
    useEffect(() => {
        if (isRecording && isCodeMode) {
            // Check settings for auto-capture preference
            window.electronAPI.getSettings().then((res: any) => {
                if (res.success && res.settings?.autoCaptureCodingMode) {
                    autoCaptureTimerRef.current = setInterval(() => {
                        handleCaptureScreen();
                    }, 30000); // Every 30 seconds
                }
            });
        } else {
            if (autoCaptureTimerRef.current) {
                clearInterval(autoCaptureTimerRef.current);
                autoCaptureTimerRef.current = null;
            }
        }
        return () => {
            if (autoCaptureTimerRef.current) {
                clearInterval(autoCaptureTimerRef.current);
                autoCaptureTimerRef.current = null;
            }
        };
    }, [isRecording, isCodeMode]);

    // ─── Transcription queue processing ───
    const processTranscriptionQueue = useCallback(async () => {
        if (isTranscribingRef.current) return;
        if (!isModelLoaded) return;

        isTranscribingRef.current = true;
        try {
            while (transcriptionQueueRef.current.length > 0) {
                const nextItem = transcriptionQueueRef.current.shift();
                if (!nextItem) continue;

                try {
                    // Prefix conditioning: last 32 words from the SAME speaker
                    const lastSpeakerBlocks = conversationRef.current
                        .filter(b => b.speaker === nextItem.source)
                        .slice(-3);
                    const promptText = lastSpeakerBlocks.map(b => b.text).join(' ').split(/\s+/).slice(-32).join(' ');

                    const result = await transcribe(nextItem.chunk, promptText);

                    if (result && result.text.trim()) {
                        const filterRes = filterHallucinations(result.text);
                        if (!filterRes.valid) {
                            console.log(`[HallucinationFilter] Discarded: "${result.text}" (Reason: ${filterRes.reason})`);
                            continue;
                        }

                        const text = filterRes.filteredText || result.text;
                        const stabilizer = nextItem.source === 'user' ? userStabilizerRef.current : interviewerStabilizerRef.current;

                        setConversation((prev: ChatBlock[]) => {
                            const newConv = [...prev];
                            const lastBlock = newConv.length > 0 ? newConv[newConv.length - 1] : null;

                            let textToSet = '';
                            if (!lastBlock || lastBlock.speaker !== nextItem.source) {
                                stabilizer.clear();
                                if (result.words && result.words.length > 0) {
                                    textToSet = stabilizer.addUtteranceWithTimestamps(result.words);
                                } else {
                                    textToSet = stabilizer.addChunkFallback(text);
                                }
                                newConv.push({
                                    id: Date.now().toString() + Math.random().toString(),
                                    speaker: nextItem.source,
                                    text: textToSet,
                                    timestamp: new Date()
                                });
                            } else {
                                if (result.words && result.words.length > 0) {
                                    textToSet = stabilizer.addUtteranceWithTimestamps(result.words);
                                } else {
                                    textToSet = stabilizer.addChunkFallback(text);
                                }
                                newConv[newConv.length - 1] = { ...lastBlock, text: textToSet };
                            }

                            conversationRef.current = newConv;

                            // If user starts speaking, cancel any pending auto-answer
                            if (nextItem.source === 'user' && autoGenerateTimeoutRef.current) {
                                clearTimeout(autoGenerateTimeoutRef.current);
                                autoGenerateTimeoutRef.current = null;
                            }

                            // Phase 2: If new interviewer text arrives during confirmation
                            // window, reset the timer (Whisper is still catching up)
                            if (nextItem.source === 'interviewer' && autoGenerateTimeoutRef.current) {
                                console.log('[Detection] New interviewer text arrived — resetting confirmation window');
                                clearTimeout(autoGenerateTimeoutRef.current);
                                autoGenerateTimeoutRef.current = null;
                                startConfirmationWindow(); // Will use the latest conversation text via ref
                            }

                            return newConv;
                        });
                    }
                } catch (error) {
                    console.error('Failed to transcribe chunk:', error);
                }
            }
        } finally {
            isTranscribingRef.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModelLoaded, transcribe, setConversation]);

    // ─── Two-phase confirmation window for question detection ───
    //
    // The problem: VAD fires onSpeechEnd on brief pauses (breaths), but the
    // interviewer may still be mid-sentence. If we detect immediately, we get
    // partial questions like "Can you explain?" instead of the full
    // "Can you explain closures in Java with code example?"
    //
    // Solution: Confirmation window
    // Phase 1: onSpeechEnd fires → start a 3.5s timer
    // Phase 2: If interviewer speaks again OR new transcript text arrives → reset timer
    //          If 3.5s passes with no activity → run detection on full text

    const CONFIRMATION_WINDOW_MS = 3500;

    const startConfirmationWindow = useCallback(() => {
        // 10s cooldown between auto-answers
        if (Date.now() - lastAnswerTimeRef.current < 10000) return;

        autoGenerateTimeoutRef.current = setTimeout(async () => {
            autoGenerateTimeoutRef.current = null;

            // Check settings — skip in manual mode
            const settingsRes = await window.electronAPI.getSettings();
            const mode = settingsRes.success && settingsRes.settings
                ? settingsRes.settings.questionDetectionMode
                : 'heuristic';
            if (mode === 'manual') return;

            // Get the last interviewer block from conversation
            const conv = conversationRef.current;
            const lastInterviewerBlock = [...conv].reverse().find(b => b.speaker === 'interviewer');
            if (!lastInterviewerBlock || !lastInterviewerBlock.text.trim()) return;

            // Run multi-signal detection on the complete utterance
            const detection = isQuestionSync(lastInterviewerBlock.text);

            console.log(
                `[Detection] "${lastInterviewerBlock.text.slice(0, 80)}..." => ` +
                `isQuestion=${detection.isQuestion}, confidence=${detection.confidence.toFixed(2)}, ` +
                `signals=[${detection.signals.join(', ')}]`
            );

            if (detection.isQuestion) {
                lastAnswerTimeRef.current = Date.now();
                triggerAutoAnswer();
            }
        }, CONFIRMATION_WINDOW_MS);
    }, []);

    // Called when interviewer's VAD detects speech-end (silence after speaking)
    const handleInterviewerSpeechEnd = useCallback(() => {
        console.log('[Detection] Interviewer speech ended — starting confirmation window');

        // Cancel any previous pending window
        if (autoGenerateTimeoutRef.current) {
            clearTimeout(autoGenerateTimeoutRef.current);
            autoGenerateTimeoutRef.current = null;
        }

        startConfirmationWindow();
    }, [startConfirmationWindow]);

    // Called when interviewer's VAD detects speech-start (they resumed speaking)
    const handleInterviewerSpeechStart = useCallback(() => {
        if (autoGenerateTimeoutRef.current) {
            console.log('[Detection] Interviewer resumed speaking — cancelling confirmation window');
            clearTimeout(autoGenerateTimeoutRef.current);
            autoGenerateTimeoutRef.current = null;
        }
    }, []);

    const handleAudioChunk = useCallback(async (source: SpeakerSource, pcmSamples: Float32Array) => {
        if (!isModelLoaded) return;
        transcriptionQueueRef.current.push({ source, chunk: pcmSamples });
        void processTranscriptionQueue();
    }, [isModelLoaded, processTranscriptionQueue]);

    const { startRecording, stopRecording, clearChunks } = useMixedAudioRecorder(
        handleAudioChunk,
        handleInterviewerSpeechEnd,
        handleInterviewerSpeechStart
    );

    // ─── Action handlers ───

    const handleToggleRecording = async () => {
        if (isRecording) {
            stopRecording();
            setIsRecording(false);
            if (autoGenerateTimeoutRef.current) {
                clearTimeout(autoGenerateTimeoutRef.current);
                autoGenerateTimeoutRef.current = null;
            }

            // Phase 2.4/3.2: Auto-save session with metrics on stop
            if (conversationRef.current.length > 0 || answers.length > 0) {
                try {
                    const metrics = analyzeDelivery(conversationRef.current, sessionTime);
                    const now = new Date().toISOString();
                    const sessionData = {
                        id: Date.now().toString(),
                        startTime: now,
                        endTime: now,
                        timestamp: now,
                        duration: sessionTime,
                        interviewType: 'general',
                        type: 'general',
                        questionCount: answers.length,
                        conversation: conversationRef.current,
                        transcript: conversationRef.current,
                        answers: answers,
                        metrics: metrics,
                        deliveryMetrics: metrics,
                    };
                    const res = await window.electronAPI.session.save(sessionData);
                    if (!res.success) {
                        console.error('Failed to save session:', res.error);
                    }
                } catch (error) {
                    console.error('Error saving session:', error);
                }
            }

        } else {
            try {
                if (!isModelLoaded && !isModelLoading) {
                    await loadModel();
                }
                transcriptionQueueRef.current = [];
                isTranscribingRef.current = false;
                userStabilizerRef.current.clear();
                interviewerStabilizerRef.current.clear();
                clearTranscript();
                conversationRef.current = [];
                clearChunks();
                await startRecording();
                setIsRecording(true);
            } catch (error) {
                console.error('Failed to start:', error);
            }
        }
    };

    const handleGenerateAnswer = async () => {
        const fullTranscript = conversationRef.current.map(b => `${b.speaker === 'user' ? 'ME' : 'Interviewer'}: ${b.text}`).join('\n\n');
        if (!fullTranscript.trim()) return;

        lastAnswerTimeRef.current = Date.now();

        // Fetch current settings to get interviewType and detection mode
        const settingsRes = await window.electronAPI.getSettings();
        let interviewType = settingsRes.success && settingsRes.settings ? settingsRes.settings.interviewType : 'general';
        const isAutoDetect = settingsRes.success && settingsRes.settings ? settingsRes.settings.questionDetectionMode !== 'manual' : true;

        if (isAutoDetect) {
            const detected = classifyQuestion(fullTranscript);
            if (detected !== 'general') {
                interviewType = detected;
            }
        }

        const newAnswer: Answer = {
            id: Date.now().toString(),
            source: 'transcript',
            question: fullTranscript,
            answer: '',
            timestamp: new Date(),
            isStreaming: true,
            detectedType: interviewType,
        };

        addAnswer(newAnswer);
        setExpanded(true);

        try {
            let streamedAnswer = '';
            
            await generateAnswerWithTemplate(
                {
                    interviewType: interviewType as any,
                    currentQuestion: fullTranscript,
                    conversationHistory: '', // Only fullTranscript needed for now since it contains the whole history
                    resume: profile.resume,
                    jobDescription: profile.jobDescription,
                    company: profile.targetCompany,
                    useBulletPoints,
                },
                (chunk) => {
                    streamedAnswer += chunk;
                    updateAnswer(newAnswer.id, { answer: streamedAnswer, isStreaming: true });
                }
            );
            updateAnswer(newAnswer.id, { isStreaming: false });

            // Phase 2.5: Predict Follow-ups asynchronously
            predictFollowUps(fullTranscript, streamedAnswer, interviewType as any).then(followUps => {
                if (followUps.length > 0) {
                    updateAnswer(newAnswer.id, { followUps });
                }
            }).catch(err => console.error("Failed to predict follow-ups:", err));

        } catch (error) {
            console.error('Failed to generate answer:', error);
            removeAnswer(newAnswer.id);
        }
    };

    const triggerAutoAnswer = () => {
        const recentBlocks = conversationRef.current.slice(-5);
        const autoTranscript = recentBlocks.map(b => `${b.speaker === 'user' ? 'ME' : 'Interviewer'}: ${b.text}`).join('\n\n');
        if (!autoTranscript.trim()) return;

        (async () => {
            const settingsRes = await window.electronAPI.getSettings();
            let interviewType = settingsRes.success && settingsRes.settings ? settingsRes.settings.interviewType : 'general';
            const isAutoDetect = settingsRes.success && settingsRes.settings ? settingsRes.settings.questionDetectionMode !== 'manual' : true;

            if (isAutoDetect) {
                const detected = classifyQuestion(autoTranscript);
                if (detected !== 'general') {
                    interviewType = detected;
                }
            }

            const newAnswer: Answer = {
                id: Date.now().toString(),
                source: 'transcript',
                question: autoTranscript,
                answer: '',
                timestamp: new Date(),
                isStreaming: true,
                detectedType: interviewType,
            };

            addAnswer(newAnswer);
            setExpanded(true);

            try {
                let streamedAnswer = '';

                await generateAnswerWithTemplate(
                    {
                        interviewType: interviewType as any,
                        currentQuestion: autoTranscript,
                        conversationHistory: '', // Included in autoTranscript
                        resume: profile.resume,
                        jobDescription: profile.jobDescription,
                        company: profile.targetCompany,
                        useBulletPoints,
                    },
                    (chunk) => {
                        streamedAnswer += chunk;
                        updateAnswer(newAnswer.id, { answer: streamedAnswer, isStreaming: true });
                    }
                );
                updateAnswer(newAnswer.id, { isStreaming: false });

                // Phase 2.5: Predict Follow-ups asynchronously
                predictFollowUps(autoTranscript, streamedAnswer, interviewType as any).then(followUps => {
                    if (followUps.length > 0) {
                        updateAnswer(newAnswer.id, { followUps });
                    }
                }).catch(err => console.error("Failed to predict follow-ups:", err));

            } catch (error) {
                console.error('Failed to auto-generate answer:', error);
                removeAnswer(newAnswer.id);
            }
        })();
    };

    const handleCaptureScreen = async () => {
        setCapturing(true);
        try {
            if (isCodeMode) {
                // Code Mode: capture screen then stream analysis with code-specific prompt
                const captureResult = await window.electronAPI.captureScreen();
                if (!captureResult.success || !captureResult.imageData) {
                    console.error('Screen capture failed:', captureResult.error);
                    return;
                }

                const codePrompt = getCodeAnalysisPrompt({
                    resume: profile.resume,
                    jobDescription: profile.jobDescription,
                });

                const newAnswer: Answer = {
                    id: Date.now().toString(),
                    source: 'screen-capture',
                    question: '💻 Code Analysis',
                    answer: '',
                    timestamp: new Date(),
                    isStreaming: true,
                    detectedType: 'coding',
                };

                addAnswer(newAnswer);
                setExpanded(true);

                let streamedAnswer = '';
                await generateResponse(
                    codePrompt.user,
                    undefined,
                    (chunk) => {
                        streamedAnswer += chunk;
                        updateAnswer(newAnswer.id, { answer: streamedAnswer, isStreaming: true });
                    },
                    captureResult.imageData
                );
                updateAnswer(newAnswer.id, { isStreaming: false });

            } else {
                // Standard mode: one-shot capture + analyze
                const result = await window.electronAPI.captureAndAnalyze();
                if (result.success && result.answer) {
                    addAnswer({
                        id: Date.now().toString(),
                        source: 'screen-capture',
                        question: 'Screen Analysis',
                        answer: result.answer,
                        timestamp: new Date(),
                        isStreaming: false,
                    });
                    setExpanded(true);
                } else {
                    console.error('Screen capture failed:', result.error);
                }
            }
        } catch (error) {
            console.error('Failed to capture screen:', error);
        } finally {
            setCapturing(false);
        }
    };

    const handleClearTranscript = () => {
        userStabilizerRef.current.clear();
        interviewerStabilizerRef.current.clear();
        clearTranscript();
        conversationRef.current = [];
        if (autoGenerateTimeoutRef.current) {
            clearTimeout(autoGenerateTimeoutRef.current);
            autoGenerateTimeoutRef.current = null;
        }
    };

    const handleClose = () => {
        window.electronAPI?.quitApp();
    };

    // ─── Global keyboard shortcuts ───
    useEffect(() => {
        const unsubscribers: (() => void)[] = [];

        if (window.electronAPI?.onShortcut) {
            unsubscribers.push(
                window.electronAPI.onShortcut('shortcut:capture-screen', () => {
                    handleCaptureScreen();
                })
            );
            unsubscribers.push(
                window.electronAPI.onShortcut('shortcut:generate-answer', () => {
                    handleGenerateAnswer();
                })
            );
            unsubscribers.push(
                window.electronAPI.onShortcut('shortcut:toggle-widget', () => {
                    toggleExpanded();
                })
            );
            unsubscribers.push(
                window.electronAPI.onShortcut('shortcut:toggle-recording', () => {
                    handleToggleRecording();
                })
            );
            // Region capture shortcut
            unsubscribers.push(
                window.electronAPI.onShortcut('shortcut:region-capture', () => {
                    handleRegionCapture();
                })
            );
        }

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [conversation, answers.length]);

    const handleSettingsChanged = async () => {
        try {
            await loadModel(true);
        } catch (error) {
            console.error('Failed to reload model after settings change:', error);
        }
    };

    // ─── Region Capture State ───
    const [regionSelectState, setRegionSelectState] = useState<{ screenshotData: string } | null>(null);

    const handleRegionCapture = async () => {
        try {
            const captureResult = await window.electronAPI.captureScreen();
            if (captureResult.success && captureResult.imageData) {
                setRegionSelectState({ screenshotData: captureResult.imageData });
            }
        } catch (error) {
            console.error('Region capture failed:', error);
        }
    };

    const handleRegionResult = async (croppedImageData: string) => {
        setRegionSelectState(null);
        setCapturing(true);
        try {
            const prompt = isCodeMode
                ? getCodeAnalysisPrompt({ resume: profile.resume, jobDescription: profile.jobDescription })
                : undefined;

            const newAnswer: Answer = {
                id: Date.now().toString(),
                source: 'screen-capture',
                question: isCodeMode ? '💻 Code Analysis (Region)' : '🔍 Region Analysis',
                answer: '',
                timestamp: new Date(),
                isStreaming: true,
                detectedType: isCodeMode ? 'coding' : undefined,
            };
            addAnswer(newAnswer);
            setExpanded(true);

            let streamedAnswer = '';
            const systemPrompt = prompt?.system || 'You are an expert interview assistant. Analyze the selected region from a screenshot and provide clear, structured insight.';
            const userPrompt = prompt?.user || 'Analyze this screenshot region. Extract questions, code, or information and provide a helpful response.';

            await generateResponse(
                userPrompt,
                undefined,
                (chunk) => {
                    streamedAnswer += chunk;
                    updateAnswer(newAnswer.id, { answer: streamedAnswer, isStreaming: true });
                },
                croppedImageData
            );
            updateAnswer(newAnswer.id, { isStreaming: false });
        } catch (error) {
            console.error('Region analysis failed:', error);
        } finally {
            setCapturing(false);
        }
    };

    // ─── Render ───
    return (
        <>
            <FloatingWidget
                isExpanded={isExpanded}
                isSettingsOpen={isSettingsOpen}
                isChatOpen={isChatOpen}
                isHistoryOpen={isHistoryOpen}
                isPracticeOpen={isPracticeOpen}
                isRecording={isRecording}
                isCapturing={isCapturing}
                isGenerating={isGenerating}
                sessionTime={sessionTime}
                conversation={conversation}
                answers={answers}
                currentAnswerIndex={currentAnswerIndex}
                isModelLoading={isModelLoading}
                modelError={modelError}
                onToggleExpanded={toggleExpanded}
                onToggleRecording={handleToggleRecording}
                onCaptureScreen={handleCaptureScreen}
                onRegionCapture={handleRegionCapture}
                onGenerateAnswer={handleGenerateAnswer}
                onClearTranscript={handleClearTranscript}
                onClearAnswers={clearAnswers}
                onNavigateAnswer={navigateAnswer}
                onToggleSettings={toggleSettings}
                onToggleChat={toggleChat}
                onToggleHistory={toggleHistory}
                onTogglePractice={togglePractice}
                onSettingsChanged={handleSettingsChanged}
                onClose={handleClose}
            />
            {regionSelectState && (
                <RegionSelector
                    screenshotData={regionSelectState.screenshotData}
                    onCapture={handleRegionResult}
                    onCancel={() => setRegionSelectState(null)}
                />
            )}
        </>
    );
}

export default App;
