import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './AppRouter';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import './index.css';
import './career-hub.css';
import { useSessionStore, useAnswerStore, useUIStore } from './state';

// Expose Zustand stores on window for E2E test access and debugging
(window as any).__TEST_SESSION_STORE__ = useSessionStore;
(window as any).__TEST_ANSWER_STORE__ = useAnswerStore;
(window as any).__TEST_UI_STORE__ = useUIStore;

// Expose filter for E2E testing
import { filterHallucinations } from './lib/hallucination-filter';
(window as any).__TEST_FILTER_HALLUCINATIONS__ = filterHallucinations;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  </React.StrictMode>
);
