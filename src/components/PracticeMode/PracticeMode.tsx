import React from 'react';
import { usePracticeStore } from '../../state/practice-store';
import { PracticeSetup } from './PracticeSetup';
import { PracticeSession } from './PracticeSession';
import { PracticeResults } from './PracticeResults';

export const PracticeMode: React.FC = () => {
    const { isPracticeMode, practiceConfig, evaluations } = usePracticeStore();

    if (!isPracticeMode) {
        return <PracticeSetup />;
    }

    if (practiceConfig && evaluations.length === practiceConfig.questionCount) {
        return <PracticeResults />;
    }

    return <PracticeSession />;
};
