import React from 'react';

interface DarkroomSpinnerProps {
  /** Accessible label announced to screen readers */
  label?: string;
  /** Optional caption under the spinner */
  caption?: string;
  className?: string;
}

/**
 * Industrial safelight loader — aperture iris + copper glow.
 * Used for route Suspense and other full-screen waits.
 */
export const DarkroomSpinner: React.FC<DarkroomSpinnerProps> = ({
  label = 'Loading editor',
  caption = 'Developing…',
  className = '',
}) => (
  <div
    className={`darkroom-spinner ${className}`.trim()}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={label}
  >
    <div className="darkroom-spinner__stage" aria-hidden>
      <span className="darkroom-spinner__glow" />
      <svg
        className="darkroom-spinner__ring"
        viewBox="0 0 72 72"
        width="72"
        height="72"
        fill="none"
      >
        <circle
          className="darkroom-spinner__track"
          cx="36"
          cy="36"
          r="28"
          strokeWidth="1.5"
        />
        <circle
          className="darkroom-spinner__arc"
          cx="36"
          cy="36"
          r="28"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="44 132"
        />
        <circle
          className="darkroom-spinner__arc darkroom-spinner__arc--inner"
          cx="36"
          cy="36"
          r="18"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="28 90"
        />
      </svg>
      <span className="darkroom-spinner__aperture">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="darkroom-spinner__core" />
    </div>
    {caption ? (
      <p className="darkroom-spinner__caption font-mono-ui">{caption}</p>
    ) : null}
  </div>
);
