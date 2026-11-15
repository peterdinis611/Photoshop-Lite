import React from 'react';

type LiveRegionProps = {
  message: string;
  /** assertive for errors; polite for status (default). */
  politeness?: 'polite' | 'assertive' | 'off';
  id?: string;
  className?: string;
};

/** Screen-reader announcement region (visually hidden). */
export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = 'polite',
  id,
  className = 'sr-only',
}) => (
  <div
    id={id}
    className={className}
    role="status"
    aria-live={politeness}
    aria-atomic="true"
  >
    {message}
  </div>
);
