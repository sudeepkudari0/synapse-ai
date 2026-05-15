import React, { useState } from 'react';
import { usePracticeStore } from '../../state/practice-store';
import { PracticeSetup } from './PracticeSetup';
import { PracticeSession } from './PracticeSession';
import { PracticeResults } from './PracticeResults';
import { ProgressDashboard } from './ProgressDashboard';

export const PracticeMode: React.FC = () => {
    const { isPracticeMode, practiceConfig, evaluations } = usePracticeStore();
    const [showProgress, setShowProgress] = useState(false);

    // Show progress dashboard
    if (showProgress) {
        return <ProgressDashboard onClose={() => setShowProgress(false)} />;
    }

    if (!isPracticeMode) {
        return <PracticeSetup onShowProgress={() => setShowProgress(true)} />;
    }

    if (practiceConfig && evaluations.length === practiceConfig.questionCount) {
        return <PracticeResults />;
    }

    return <PracticeSession />;
};
