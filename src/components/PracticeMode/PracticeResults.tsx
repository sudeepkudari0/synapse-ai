import React, { useEffect, useRef } from 'react';
import { usePracticeStore } from '../../state/practice-store';
import { useSessionStore } from '../../state/session-store';
import { analyzeDelivery } from '../../lib/delivery-analyzer';
import { jsPDF } from 'jspdf';

export const PracticeResults: React.FC = () => {
    const { evaluations, practiceConfig, practiceQuestions, resetPractice } = usePracticeStore();
    const { conversation, sessionTime } = useSessionStore();
    const hasSavedRef = useRef(false);

    useEffect(() => {
        if (!practiceConfig || evaluations.length === 0 || hasSavedRef.current) return;

        const saveSession = async () => {
            hasSavedRef.current = true;
            
            const answersData = practiceQuestions.map(q => {
                const evalData = evaluations.find(e => e.questionId === q.id);
                const scoreText = evalData 
                    ? `\n\n**Evaluation Score:** ${evalData.score}/10\n**Strengths:**\n- ${evalData.strengths.join('\n- ')}\n\n**Areas for Improvement:**\n- ${evalData.improvements.join('\n- ')}\n\n**Model Answer:**\n${evalData.modelAnswer}` 
                    : '';
                
                return {
                    id: q.id,
                    source: 'transcript' as const,
                    question: q.question,
                    answer: (q.answer || 'No answer recorded.') + scoreText,
                    timestamp: new Date().toISOString()
                };
            });

            const sessionData = {
                id: Date.now().toString(),
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: sessionTime,
                interviewType: practiceConfig.interviewType,
                conversation: [], // Keep empty for practice mode, relying on answers
                answers: answersData,
                tags: ['practice', practiceConfig.role]
            };

            try {
                await window.electronAPI.session.save(sessionData);
            } catch (err) {
                console.error("Failed to save practice session:", err);
            }
        };

        saveSession();
    }, [practiceConfig, practiceQuestions, evaluations, sessionTime]);

    if (!practiceConfig) return null;

    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const avgScore = evaluations.length > 0 ? (totalScore / evaluations.length).toFixed(1) : 0;

    const handleExportPDF = () => {
        try {
            const deliveryMetrics = analyzeDelivery(conversation, sessionTime);
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);
            let y = margin;

            // Header helper
            const addHeader = (pageNum: number) => {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(79, 70, 229); // Indigo
                doc.text("SYNAPSE AI  |  INTERVIEW PRACTICE", margin, 12);
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(148, 163, 184); // Slate-400
                doc.text(`Page ${pageNum}`, pageWidth - margin - 10, 12);
                
                doc.setDrawColor(226, 232, 240); // Slate-200
                doc.setLineWidth(0.2);
                doc.line(margin, 14, pageWidth - margin, 14);
            };

            let currentPage = 1;
            addHeader(currentPage);
            y = 22;

            // Title
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42); // Slate-900
            doc.text("Practice Session Report", margin, y);
            y += 8;

            // Date
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139); // Slate-500
            const dateStr = new Date().toLocaleDateString(undefined, { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            doc.text(`Generated on ${dateStr}`, margin, y);
            y += 12;

            // Summary Card
            const cardHeight = 35;
            doc.setFillColor(248, 250, 252); // Slate-50
            doc.setDrawColor(226, 232, 240); // Slate-200
            doc.setLineWidth(0.5);
            doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'FD');

            // Card details
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text("Session Metadata", margin + 6, y + 8);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            
            // Format duration
            const minutes = Math.floor(sessionTime / 60);
            const seconds = sessionTime % 60;
            const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            doc.text(`Target Role: ${practiceConfig.role}`, margin + 6, y + 16);
            doc.text(`Interview Type: ${practiceConfig.interviewType.toUpperCase()}`, margin + 6, y + 22);
            doc.text(`Duration: ${durationStr}`, margin + 6, y + 28);

            if (practiceConfig.company) {
                doc.text(`Target Company: ${practiceConfig.company}`, margin + 80, y + 16);
            }

            // Big Score in Card
            doc.setFillColor(79, 70, 229); // Indigo
            doc.roundedRect(pageWidth - margin - 35, y + 4, 30, 27, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(`${avgScore}`, pageWidth - margin - 23, y + 15);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text("Average Score", pageWidth - margin - 27, y + 24);

            y += cardHeight + 10;

            // Delivery Coaching Metrics Section
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("Delivery Coaching Metrics", margin, y);
            y += 6;

            // Metrics table/grid
            const metricsHeight = 32;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin, y, contentWidth, metricsHeight, 2, 2, 'FD');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);

            // WPM Pacing
            let pacingStatus = "Optimal";
            if (deliveryMetrics.wpm < 110) pacingStatus = "Slow";
            else if (deliveryMetrics.wpm > 150) pacingStatus = "Fast";
            if (deliveryMetrics.wpm === 0) pacingStatus = "N/A";

            doc.text(`Speaking Pace: ${deliveryMetrics.wpm} WPM (${pacingStatus})`, margin + 6, y + 8);
            doc.text(`Filler Word Count: ${deliveryMetrics.fillerWordCount} detected`, margin + 6, y + 15);
            doc.text(`Talk vs. Listen Ratio: ${(deliveryMetrics.talkTimeRatio * 100).toFixed(0)}% talk time`, margin + 6, y + 22);

            // Print top filler words if any
            const topFillers = Object.entries(deliveryMetrics.fillerWords)
                .filter(([_, count]) => count > 0)
                .map(([word, count]) => `${word} (${count})`)
                .join(', ');
            if (topFillers) {
                doc.text(`Top Filler Words: ${topFillers}`, margin + 6, y + 28);
            } else {
                doc.text(`Top Filler Words: None detected! Excellent structure.`, margin + 6, y + 28);
            }

            y += metricsHeight + 10;

            // Section 3: Question Breakdown
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("Detailed Question & AI Evaluation", margin, y);
            y += 8;

            const checkPageBreak = (neededHeight: number) => {
                if (y + neededHeight > pageHeight - margin) {
                    doc.addPage();
                    currentPage++;
                    addHeader(currentPage);
                    y = 22;
                }
            };

            practiceQuestions.forEach((q, index) => {
                const evalData = evaluations.find(e => e.questionId === q.id);
                if (!evalData) return;

                // Title header for question
                checkPageBreak(15);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42);
                doc.text(`Q${index + 1}: ${q.question}`, margin, y);
                y += 6;

                // Score bar
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(79, 70, 229);
                doc.text(`AI Score: ${evalData.score}/10`, margin, y);
                y += 5;

                // User Answer
                checkPageBreak(15);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text("Your Answer:", margin, y);
                y += 4.5;

                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                doc.setTextColor(51, 65, 85);
                const answerText = q.answer || "No answer recorded.";
                const answerLines = doc.splitTextToSize(answerText, contentWidth);
                checkPageBreak(answerLines.length * 4.5 + 5);
                doc.text(answerLines, margin, y);
                y += (answerLines.length * 4.5) + 6;

                // Strengths & Areas for Improvement (Side by side or sequential)
                checkPageBreak(20);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(16, 185, 129); // Emerald-500
                doc.text("Strengths:", margin, y);
                y += 4.5;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(51, 65, 85);
                evalData.strengths.forEach(strength => {
                    const strLines = doc.splitTextToSize(`• ${strength}`, contentWidth);
                    checkPageBreak(strLines.length * 4.5 + 2);
                    doc.text(strLines, margin, y);
                    y += (strLines.length * 4.5) + 1;
                });
                y += 2;

                checkPageBreak(20);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(245, 158, 11); // Amber-500
                doc.text("Areas for Improvement:", margin, y);
                y += 4.5;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(51, 65, 85);
                evalData.improvements.forEach(improvement => {
                    const impLines = doc.splitTextToSize(`• ${improvement}`, contentWidth);
                    checkPageBreak(impLines.length * 4.5 + 2);
                    doc.text(impLines, margin, y);
                    y += (impLines.length * 4.5) + 1;
                });
                y += 2;

                // Model Answer
                checkPageBreak(20);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(59, 130, 246); // Blue-500
                doc.text("Model Answer suggestion:", margin, y);
                y += 4.5;

                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                doc.setTextColor(51, 65, 85);
                const modelLines = doc.splitTextToSize(evalData.modelAnswer, contentWidth);
                checkPageBreak(modelLines.length * 4.5 + 10);
                doc.text(modelLines, margin, y);
                y += (modelLines.length * 4.5) + 12; // Extra gap between questions
            });

            // Save PDF
            const filename = `synapse-practice-report-${new Date().toISOString().slice(0,10)}.pdf`;
            doc.save(filename);

        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("An error occurred while exporting the report to PDF.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto p-4">
            <h2 className="text-2xl font-bold mb-6 text-center">Practice Complete!</h2>

            <div className="bg-slate-800 rounded-lg p-6 text-center border border-slate-700 mb-6">
                <div className="text-5xl font-bold text-blue-400 mb-2">{avgScore}/10</div>
                <div className="text-slate-400 text-sm">Average Score</div>
                <div className="mt-4 text-sm text-slate-300">
                    Role: <span className="font-medium text-white">{practiceConfig.role}</span> | Type: <span className="font-medium text-white">{practiceConfig.interviewType}</span>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-xl font-semibold border-b border-slate-700 pb-2">Question Breakdown</h3>
                
                {practiceQuestions.map((q, index) => {
                    const evalData = evaluations.find(e => e.questionId === q.id);
                    if (!evalData) return null;

                    return (
                        <div key={q.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="bg-slate-700 px-4 py-3 border-b border-slate-600 flex justify-between items-start">
                                <div className="flex-1 pr-4">
                                    <span className="text-xs font-bold text-slate-400 mb-1 block">Q{index + 1}</span>
                                    <h4 className="font-medium text-white text-sm">{q.question}</h4>
                                </div>
                                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shrink-0 mt-1">
                                    {evalData.score}/10
                                </span>
                            </div>
                            
                            <div className="p-4 space-y-3 text-sm">
                                <div>
                                    <h5 className="text-slate-400 text-xs font-semibold uppercase mb-1">Your Answer</h5>
                                    <p className="text-slate-300 italic">{q.answer || "No answer recorded."}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-700/50">
                                    <div>
                                        <h5 className="text-emerald-400 font-medium mb-1 flex items-center">
                                            <span className="mr-1">✓</span> Strengths
                                        </h5>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                                            {evalData.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h5 className="text-orange-400 font-medium mb-1 flex items-center">
                                            <span className="mr-1">△</span> Improvements
                                        </h5>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                                            {evalData.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-4 pb-4 flex flex-col sm:flex-row gap-4">
                <button
                    onClick={handleExportPDF}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-indigo-500 shadow-md flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Session Report
                </button>
                <button
                    onClick={resetPractice}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-slate-600"
                >
                    Start New Practice
                </button>
            </div>
        </div>
    );
};
