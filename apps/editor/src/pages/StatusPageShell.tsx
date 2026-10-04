import React from 'react';
import { Link } from 'react-router-dom';
import { Aperture } from 'lucide-react';

interface StatusPageShellProps {
  code: string;
  title: string;
  message: string;
  detail?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryTo?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: React.ReactNode;
}

/** Shared darkroom status frame for 404 / runtime error pages. */
export const StatusPageShell: React.FC<StatusPageShellProps> = ({
  code,
  title,
  message,
  detail,
  primaryLabel = 'Back to editor',
  onPrimary,
  primaryTo = '/',
  secondaryLabel,
  onSecondary,
  children,
}) => {
  return (
    <div className="status-page">
      <div className="status-page__grain" aria-hidden />
      <div className="status-page__glow" aria-hidden />

      <header className="status-page__brand">
        <Aperture size={18} strokeWidth={2.2} />
        <span>PhotoshopLite</span>
      </header>

      <main className="status-page__main">
        <p className="status-page__code" aria-hidden>
          {code}
        </p>
        <div className="status-page__frame">
          <div className="status-page__frame-edge status-page__frame-edge--tl" />
          <div className="status-page__frame-edge status-page__frame-edge--tr" />
          <div className="status-page__frame-edge status-page__frame-edge--bl" />
          <div className="status-page__frame-edge status-page__frame-edge--br" />
          {children}
        </div>

        <h1 className="status-page__title">{title}</h1>
        <p className="status-page__message">{message}</p>
        {detail && <p className="status-page__detail">{detail}</p>}

        <div className="status-page__actions">
          {onPrimary ? (
            <button type="button" className="status-page__cta" onClick={onPrimary}>
              {primaryLabel}
            </button>
          ) : (
            <Link to={primaryTo} className="status-page__cta">
              {primaryLabel}
            </Link>
          )}
          {secondaryLabel && onSecondary && (
            <button type="button" className="status-page__ghost" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
      </main>

      <footer className="status-page__foot">
        <span className="font-mono-ui">DARKROOM · STATUS</span>
      </footer>
    </div>
  );
};
