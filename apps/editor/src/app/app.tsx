import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnalyticsScripts } from '../analytics/AnalyticsScripts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DarkroomSpinner } from '../components/ui/DarkroomSpinner';
import { LandingPage } from '../pages/LandingPage';
import { NotFoundPage } from '../pages/NotFoundPage';

const EditorShell = lazy(() => import('./EditorShell'));

function EditorRouteFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-app)]">
      <DarkroomSpinner label="Opening editor" caption="Developing…" />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AnalyticsScripts />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/editor"
          element={
            <Suspense fallback={<EditorRouteFallback />}>
              <EditorShell />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
