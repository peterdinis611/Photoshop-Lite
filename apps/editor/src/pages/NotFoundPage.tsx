import React from 'react';
import { StatusPageShell } from './StatusPageShell';
import { usePageMeta } from '../seo/usePageMeta';

/** 404 — missing frame / empty contact sheet. */
export const NotFoundPage: React.FC = () => {
  usePageMeta({
    title: '404 — Frame not found · PhotoshopLite',
    description: 'This contact sheet doesn’t have that exposure. Return to the PhotoshopLite darkroom.',
    robots: 'noindex, follow',
    canonicalPath: '/',
  });

  return (
    <StatusPageShell
      code="404"
      title="Frame not found"
      message="This contact sheet doesn’t have that exposure. The path you opened isn’t on the reel."
      primaryLabel="Open the darkroom"
      primaryTo="/editor"
    >
      <div className="status-page__art status-page__art--404" aria-hidden>
        <div className="status-film">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`status-film__cell ${i === 2 ? 'is-missing' : ''}`}>
              {i === 2 ? (
                <span className="status-film__void">?</span>
              ) : (
                <span className="status-film__sprocket" />
              )}
            </div>
          ))}
        </div>
      </div>
    </StatusPageShell>
  );
};

export default NotFoundPage;
