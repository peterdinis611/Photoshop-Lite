export type CtaProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: CtaProps }) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Fire a named CTA / interaction event to Plausible and/or GA4 when present.
 * No-ops safely when neither is loaded (local / privacy-first default).
 */
export function trackCta(name: string, props: CtaProps = {}): void {
  const clean = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined)
  ) as CtaProps;

  try {
    window.plausible?.(name, { props: clean });
  } catch {
    /* ignore analytics failures */
  }

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, {
        event_category: 'cta',
        ...clean,
      });
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...clean });
    }
  } catch {
    /* ignore */
  }

  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[cta]', name, clean);
  }
}
