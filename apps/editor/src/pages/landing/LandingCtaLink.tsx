import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { trackCta } from '../../analytics/trackCta';

export interface LandingCtaLinkProps extends LinkProps {
  /** Stable event name for Plausible / GA4 (`data-cta`). */
  cta: string;
  ctaProps?: Record<string, string | number | boolean | undefined>;
}

/** Router Link that emits a CTA analytics event on activate. */
export const LandingCtaLink: React.FC<LandingCtaLinkProps> = ({
  cta,
  ctaProps,
  onClick,
  children,
  ...rest
}) => (
  <Link
    {...rest}
    data-cta={cta}
    onClick={(e) => {
      trackCta(cta, ctaProps);
      onClick?.(e);
    }}
  >
    {children}
  </Link>
);
