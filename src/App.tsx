import { useCallback, useRef, useEffect } from 'react';
import { FloatingWidget } from './components/FloatingWidget/FloatingWidget';
import { useWhisper } from './hooks/useWhisper';
import { useMixedAudioRecorder, SpeakerSource } from './hooks/useMixedAudioRecorder';
import { useLLM } from './hooks/useLLM';
import { TranscriptStabilizer } from './lib/transcript-stabilizer';
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
        isExpanded, isSettingsOpen, isChatOpen, isCapturing,
        toggleExpanded, setExpanded, toggleSettings, toggleChat, setCapturing,
    } = useUIStore();

    // ─── Refs (not state — no re-render needed) ───
    const transcriptionQueueRef = useRef<{source: SpeakerSource, chunk: Float32Array}[]>([]);
    const isTranscribingRef = useRef(false);
    const userStabilizerRef = useRef(new TranscriptStabilizer());
    const interviewerStabilizerRef = useRef(new TranscriptStabilizer());
    const conversationRef = useRef<ChatBlock[]>([]);
    const autoGenerateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync conversationRef with store
    useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    // ─── Hooks ───
    const { isModelLoading, isModelLoaded, modelError, loadModel, transcribe } = useWhisper();
    const { generateInterviewAnswer } = useLLM();

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
                    const result = await transcribe(nextItem.chunk);
                    if (result && result.trim()) {
                        const stabilizer = nextItem.source === 'user' ? userStabilizerRef.current : interviewerStabilizerRef.current;

                        setConversation((prev: ChatBlock[]) => {
                            const newConv = [...prev];
                            const lastBlock = newConv.length > 0 ? newConv[newConv.length - 1] : null;

                            let textToSet = '';
                            if (!lastBlock || lastBlock.speaker !== nextItem.source) {
                                stabilizer.clear();
                                textToSet = stabilizer.addChunk(result);
                                newConv.push({
                                    id: Date.now().toString() + Math.random().toString(),
                                    speaker: nextItem.source,
                                    text: textToSet,
                                    timestamp: new Date()
                                });
                            } else {
                                textToSet = stabilizer.addChunk(result);
                                newConv[newConv.length - 1] = { ...lastBlock, text: textToSet };
                            }

                            conversationRef.current = newConv;

                            // -- AUTO ANSWER LOGIC --
                            const currentLastBlock = newConv[newConv.length - 1];
                            if (currentLastBlock.speaker === 'interviewer') {
                                const lowerText = currentLastBlock.text.toLowerCase().trim();
                                const isLikelyQuestion = currentLastBlock.text.includes('?') ||
                                    /^(what|where|when|why|who|how|can you|could you|tell me|would you|do you|please explain|is there|are there)/.test(lowerText);

                                if (autoGenerateTimeoutRef.current) {
                                    clearTimeout(autoGenerateTimeoutRef.current);
                                }

                                if (isLikelyQuestion) {
                                    autoGenerateTimeoutRef.current = setTimeout(() => {
                                        triggerAutoAnswer();
                                    }, 1500);
                                }
                            } else if (currentLastBlock.speaker === 'user') {
                                if (autoGenerateTimeoutRef.current) {
                                    clearTimeout(autoGenerateTimeoutRef.current);
                                    autoGenerateTimeoutRef.current = null;
                                }
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
    }, [isModelLoaded, transcribe, setConversation]);

    const handleAudioChunk = useCallback(async (source: SpeakerSource, pcmSamples: Float32Array) => {
        if (!isModelLoaded) return;
        transcriptionQueueRef.current.push({ source, chunk: pcmSamples });
        void processTranscriptionQueue();
    }, [isModelLoaded, processTranscriptionQueue]);

    const { startRecording, stopRecording, clearChunks } = useMixedAudioRecorder(handleAudioChunk);

    // ─── Action handlers ───

    const handleToggleRecording = async () => {
        if (isRecording) {
            stopRecording();
            setIsRecording(false);
            if (autoGenerateTimeoutRef.current) {
                clearTimeout(autoGenerateTimeoutRef.current);
                autoGenerateTimeoutRef.current = null;
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

        const newAnswer: Answer = {
            id: Date.now().toString(),
            source: 'transcript',
            question: fullTranscript,
            answer: '',
            timestamp: new Date(),
            isStreaming: true,
        };

        addAnswer(newAnswer);
        setExpanded(true);

        try {
            let streamedAnswer = '';
            await generateInterviewAnswer(
                fullTranscript,
                undefined,
                (chunk) => {
                    streamedAnswer += chunk;
                    updateAnswer(newAnswer.id, { answer: streamedAnswer, isStreaming: true });
                }
            );
            updateAnswer(newAnswer.id, { isStreaming: false });
        } catch (error) {
            console.error('Failed to generate answer:', error);
            removeAnswer(newAnswer.id);
        }
    };

    const triggerAutoAnswer = () => {
        const recentBlocks = conversationRef.current.slice(-5);
        const autoTranscript = recentBlocks.map(b => `${b.speaker === 'user' ? 'ME' : 'Interviewer'}: ${b.text}`).join('\n\n');
        if (!autoTranscript.trim()) return;

        const newAnswer: Answer = {
            id: Date.now().toString(),
            source: 'transcript',
            question: autoTranscript,
            answer: '',
            timestamp: new Date(),
            isStreaming: true,
        };

        addAnswer(newAnswer);
        setExpanded(true);

        (async () => {
            try {
                let streamedAnswer = '';
                await generateInterviewAnswer(
                    autoTranscript,
                    undefined,
                    (chunk) => {
                        streamedAnswer += chunk;
                        updateAnswer(newAnswer.id, { answer: streamedAnswer, isStreaming: true });
                    }
                );
                updateAnswer(newAnswer.id, { isStreaming: false });
            } catch (error) {
                console.error('Failed to auto-generate answer:', error);
                removeAnswer(newAnswer.id);
            }
        })();
    };

    const handleCaptureScreen = async () => {
        setCapturing(true);
        try {
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

    // ─── Render ───
    return (
        <FloatingWidget
            isExpanded={isExpanded}
            isSettingsOpen={isSettingsOpen}
            isChatOpen={isChatOpen}
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
            onGenerateAnswer={handleGenerateAnswer}
            onClearTranscript={handleClearTranscript}
            onClearAnswers={clearAnswers}
            onNavigateAnswer={navigateAnswer}
            onToggleSettings={toggleSettings}
            onToggleChat={toggleChat}
            onSettingsChanged={handleSettingsChanged}
            onClose={handleClose}
        />
    );
}

export default App;
