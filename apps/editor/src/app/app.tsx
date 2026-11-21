import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LandingPage } from '../pages/LandingPage';
import { NotFoundPage } from '../pages/NotFoundPage';

const EditorShell = lazy(() => import('./EditorShell'));

function EditorRouteFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-app)] text-[var(--text-muted)]">
      <p className="font-mono-ui text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">
        Opening darkroom…
      </p>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
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
