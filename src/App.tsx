import { useState, useCallback, useRef, useEffect } from 'react';
import { FloatingWidget, Answer } from './components/FloatingWidget/FloatingWidget';
import { useWhisper } from './hooks/useWhisper';
import { useMixedAudioRecorder, SpeakerSource } from './hooks/useMixedAudioRecorder';
import { useLLM } from './hooks/useLLM';
import { TranscriptStabilizer } from './lib/transcript-stabilizer';

export interface ChatBlock {
    id: string;
    speaker: SpeakerSource;
    text: string;
    timestamp: Date;
}

function App(): JSX.Element {
    // ─── Widget state ───
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // ─── Transcription state ───
    const [conversation, setConversation] = useState<ChatBlock[]>([]);
    const transcriptionQueueRef = useRef<{source: SpeakerSource, chunk: Float32Array}[]>([]);
    const isTranscribingRef = useRef(false);
    
    const userStabilizerRef = useRef(new TranscriptStabilizer());
    const interviewerStabilizerRef = useRef(new TranscriptStabilizer());
    const conversationRef = useRef<ChatBlock[]>([]);
    const autoGenerateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── AI Answers state ───
    const [answers, setAnswers] = useState<Answer[]>([]);
    const answersRef = useRef<Answer[]>([]);
    const [currentAnswerIndex, setCurrentAnswerIndex] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);

    // Sync answersRef with answers
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    // ─── Session timer ───
    const [sessionTime, setSessionTime] = useState(0);
    const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Hooks ───
    const { isModelLoading, isModelLoaded, modelError, loadModel, transcribe } = useWhisper();
    const { isGenerating, generateInterviewAnswer } = useLLM();

    // ─── Pre-load Whisper model on startup ───
    useEffect(() => {
        loadModel();
    }, [loadModel]);

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
                        
                        setConversation(prev => {
                            const newConv = [...prev];
                            const lastBlock = newConv.length > 0 ? newConv[newConv.length - 1] : null;
                            
                            let textToSet = '';
                            if (!lastBlock || lastBlock.speaker !== nextItem.source) {
                                // Speaker changed or first block. Clear stabilizer and start fresh.
                                stabilizer.clear();
                                textToSet = stabilizer.addChunk(result);
                                newConv.push({
                                    id: Date.now().toString() + Math.random().toString(),
                                    speaker: nextItem.source,
                                    text: textToSet,
                                    timestamp: new Date()
                                });
                            } else {
                                // Same speaker continuing
                                textToSet = stabilizer.addChunk(result);
                                lastBlock.text = textToSet;
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
    }, [isModelLoaded, transcribe]);

    const handleAudioChunk = useCallback(async (source: SpeakerSource, pcmSamples: Float32Array) => {
        if (!isModelLoaded) return;
        transcriptionQueueRef.current.push({ source, chunk: pcmSamples });
        void processTranscriptionQueue();
    }, [isModelLoaded, processTranscriptionQueue]);

    const { isRecording, startRecording, stopRecording, clearChunks } = useMixedAudioRecorder(handleAudioChunk);

    // ─── Session timer ───
    useEffect(() => {
        if (isRecording) {
            sessionTimerRef.current = setInterval(() => {
                setSessionTime(prev => prev + 1);
            }, 1000);
        } else {
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }
        }

        return () => {
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
            }
        };
    }, [isRecording]);

    // ─── Action handlers ───

    const handleToggleRecording = async () => {
        if (isRecording) {
            stopRecording();
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
                setConversation([]);
                conversationRef.current = [];
                clearChunks();
                await startRecording();
            } catch (error) {
                console.error('Failed to start:', error);
            }
        }
    };

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => {
            if (prev && isSettingsOpen) {
                // If closing widget, close settings too
                setIsSettingsOpen(false);
            }
            return !prev;
        });
    }, [isSettingsOpen]);

    const handleToggleSettings = useCallback(() => {
        setIsSettingsOpen(prev => {
            const willBeOpen = !prev;
            if (willBeOpen && !isExpanded) {
                setIsExpanded(true); // Open widget if settings are opened
            }
            return willBeOpen;
        });
    }, [isExpanded]);

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

        setAnswers(prev => [...prev, newAnswer]);
        setCurrentAnswerIndex(answersRef.current.length); // will point to the new last element index
        setIsExpanded(true);

        try {
            let streamedAnswer = '';
            await generateInterviewAnswer(
                fullTranscript,
                undefined,
                (chunk) => {
                    streamedAnswer += chunk;
                    setAnswers(prev =>
                        prev.map(a =>
                            a.id === newAnswer.id
                                ? { ...a, answer: streamedAnswer, isStreaming: true }
                                : a
                        )
                    );
                }
            );

            setAnswers(prev =>
                prev.map(a =>
                    a.id === newAnswer.id
                        ? { ...a, isStreaming: false }
                        : a
                )
            );
        } catch (error) {
            console.error('Failed to generate answer:', error);
            setAnswers(prev => prev.filter(a => a.id !== newAnswer.id));
        }
    };

    const triggerAutoAnswerRef = useRef(handleGenerateAnswer);
    useEffect(() => {
        triggerAutoAnswerRef.current = handleGenerateAnswer;
    }, [handleGenerateAnswer]);

    const triggerAutoAnswer = () => {
        // Run auto-answer based on the last 5 conversation blocks to prevent massive prompts
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

        setAnswers(prev => [...prev, newAnswer]);
        setCurrentAnswerIndex(answersRef.current.length);
        setIsExpanded(true);

        // Disconnect from the main handleGenerateAnswer to allow the smaller context window and independent closure
        (async () => {
            try {
                let streamedAnswer = '';
                await generateInterviewAnswer(
                    autoTranscript,
                    undefined,
                    (chunk) => {
                        streamedAnswer += chunk;
                        setAnswers(prev =>
                            prev.map(a =>
                                a.id === newAnswer.id
                                    ? { ...a, answer: streamedAnswer, isStreaming: true }
                                    : a
                            )
                        );
                    }
                );

                setAnswers(prev =>
                    prev.map(a =>
                        a.id === newAnswer.id
                            ? { ...a, isStreaming: false }
                            : a
                    )
                );
            } catch (error) {
                console.error('Failed to auto-generate answer:', error);
                setAnswers(prev => prev.filter(a => a.id !== newAnswer.id));
            }
        })();
    };

    const handleCaptureScreen = async () => {
        setIsCapturing(true);

        try {
            const result = await window.electronAPI.captureAndAnalyze();

            if (result.success && result.answer) {
                const newAnswer: Answer = {
                    id: Date.now().toString(),
                    source: 'screen-capture',
                    question: 'Screen Analysis',
                    answer: result.answer,
                    timestamp: new Date(),
                    isStreaming: false,
                };

                setAnswers(prev => [...prev, newAnswer]);
                setCurrentAnswerIndex(answers.length);
                setIsExpanded(true);
            } else {
                console.error('Screen capture failed:', result.error);
            }
        } catch (error) {
            console.error('Failed to capture screen:', error);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleClearTranscript = () => {
        userStabilizerRef.current.clear();
        interviewerStabilizerRef.current.clear();
        setConversation([]);
        conversationRef.current = [];
        if (autoGenerateTimeoutRef.current) {
            clearTimeout(autoGenerateTimeoutRef.current);
            autoGenerateTimeoutRef.current = null;
        }
    };

    const handleClearAnswers = () => {
        setAnswers([]);
        setCurrentAnswerIndex(0);
    };

    const handleNavigateAnswer = (index: number) => {
        setCurrentAnswerIndex(Math.max(0, Math.min(index, answers.length - 1)));
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
                    handleToggleExpanded();
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
    }, [conversation, answers.length]); // Re-subscribe when these change so handlers have fresh closures

    const handleSettingsChanged = async () => {
        // Reload model with new settings if they were updated
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
            isRecording={isRecording}
            isCapturing={isCapturing}
            isGenerating={isGenerating}
            sessionTime={sessionTime}
            conversation={conversation}
            answers={answers}
            currentAnswerIndex={currentAnswerIndex}
            isModelLoading={isModelLoading}
            modelError={modelError}
            onToggleExpanded={handleToggleExpanded}
            onToggleRecording={handleToggleRecording}
            onCaptureScreen={handleCaptureScreen}
            onGenerateAnswer={handleGenerateAnswer}
            onClearTranscript={handleClearTranscript}
            onClearAnswers={handleClearAnswers}
            onNavigateAnswer={handleNavigateAnswer}
            onToggleSettings={handleToggleSettings}
            onSettingsChanged={handleSettingsChanged}
            onClose={handleClose}
        />
    );
}

export default App;
