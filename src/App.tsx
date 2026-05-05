import { useState, useCallback, useRef, useEffect } from 'react';
import { FloatingWidget, Answer } from './components/FloatingWidget/FloatingWidget';
import { useWhisper } from './hooks/useWhisper';
import { useMixedAudioRecorder } from './hooks/useMixedAudioRecorder';
import { useLLM } from './hooks/useLLM';
import { TranscriptStabilizer } from './lib/transcript-stabilizer';

function App(): JSX.Element {
    // ─── Widget state ───
    const [isExpanded, setIsExpanded] = useState(false);

    // ─── Transcription state ───
    const [transcript, setTranscript] = useState<string>('');
    const transcriptionQueueRef = useRef<Float32Array[]>([]);
    const isTranscribingRef = useRef(false);
    const stabilizerRef = useRef(new TranscriptStabilizer());

    // ─── AI Answers state ───
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [currentAnswerIndex, setCurrentAnswerIndex] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);

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
                const nextChunk = transcriptionQueueRef.current.shift();
                if (!nextChunk) continue;

                try {
                    const result = await transcribe(nextChunk);
                    if (result && result.trim()) {
                        const fullText = stabilizerRef.current.addChunk(result);
                        setTranscript(fullText);
                    }
                } catch (error) {
                    console.error('Failed to transcribe chunk:', error);
                }
            }
        } finally {
            isTranscribingRef.current = false;
        }
    }, [isModelLoaded, transcribe]);

    const handleAudioChunk = useCallback(async (pcmSamples: Float32Array) => {
        if (!isModelLoaded) return;
        transcriptionQueueRef.current.push(pcmSamples);
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
        } else {
            try {
                if (!isModelLoaded && !isModelLoading) {
                    await loadModel();
                }
                transcriptionQueueRef.current = [];
                isTranscribingRef.current = false;
                stabilizerRef.current.clear();
                setTranscript('');
                clearChunks();
                await startRecording();
            } catch (error) {
                console.error('Failed to start:', error);
            }
        }
    };

    const handleToggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    const handleGenerateAnswer = async () => {
        if (!transcript.trim()) return;

        const newAnswer: Answer = {
            id: Date.now().toString(),
            source: 'transcript',
            question: transcript,
            answer: '',
            timestamp: new Date(),
            isStreaming: true,
        };

        setAnswers(prev => [...prev, newAnswer]);
        setCurrentAnswerIndex(answers.length);
        setIsExpanded(true);

        try {
            let streamedAnswer = '';
            await generateInterviewAnswer(
                transcript,
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

            // Mark streaming complete
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
        stabilizerRef.current.clear();
        setTranscript('');
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
    }, [transcript, answers.length]); // Re-subscribe when these change so handlers have fresh closures

    // ─── Render ───
    return (
        <FloatingWidget
            isExpanded={isExpanded}
            isRecording={isRecording}
            isCapturing={isCapturing}
            isGenerating={isGenerating}
            sessionTime={sessionTime}
            transcript={transcript}
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
            onClose={handleClose}
        />
    );
}

export default App;
