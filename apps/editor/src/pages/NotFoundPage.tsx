import React, { useEffect } from 'react';
import { StatusPageShell } from './StatusPageShell';

/** 404 — missing frame / empty contact sheet. */
export const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = '404 — Frame not found · PhotoshopLite';
    return () => {
      document.title =
        'PhotoshopLite — Free Browser Photo Editor | Layers, AI Cutout & Revive';
    };
  }, []);

  return (
    <StatusPageShell
      code="404"
      title="Frame not found"
      message="This contact sheet doesn’t have that exposure. The path you opened isn’t on the reel."
      primaryLabel="Open the darkroom"
      primaryTo="/"
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
