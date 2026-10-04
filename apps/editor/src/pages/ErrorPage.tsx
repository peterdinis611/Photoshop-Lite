import React, { useEffect } from 'react';
import { StatusPageShell } from './StatusPageShell';

export interface ErrorPageProps {
  error?: Error | null;
  resetError?: () => void;
}

/** Runtime error — fogged / scratched negative. */
export const ErrorPage: React.FC<ErrorPageProps> = ({ error, resetError }) => {
  useEffect(() => {
    document.title = 'Error — Plate fogged · PhotoshopLite';
    return () => {
      document.title =
        'PhotoshopLite — Free Browser Photo Editor | Layers, AI Cutout & Revive';
    };
  }, []);

  const detail =
    error?.message && error.message.length < 180
      ? error.message
      : 'Something fogged the plate while developing. Try again or return to the editor.';

  return (
    <StatusPageShell
      code="ERR"
      title="Plate fogged"
      message="The darkroom hit an unexpected fault. Your work may still be recoverable via undo or a reload."
      detail={detail}
      primaryLabel="Back to editor"
      primaryTo="/"
      onPrimary={
        resetError
          ? () => {
              resetError();
              window.location.assign('/');
            }
          : undefined
      }
      secondaryLabel="Reload page"
      onSecondary={() => window.location.reload()}
    >
      <div className="status-page__art status-page__art--error" aria-hidden>
        <div className="status-scratch">
          <div className="status-scratch__neg" />
          <div className="status-scratch__crack status-scratch__crack--a" />
          <div className="status-scratch__crack status-scratch__crack--b" />
          <div className="status-scratch__fog" />
        </div>
      </div>
    </StatusPageShell>
  );
};

export default ErrorPage;
