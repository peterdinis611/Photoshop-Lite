import { useEffect } from 'react';

type AnalyticsBoot = {
  plausibleDomain?: string;
  ga4Id?: string;
};

/**
 * Optional Plausible / GA4 loaders.
 * Enable via `window.__PL_ANALYTICS__` or deploy-time meta tags:
 *   <meta name="pl-plausible-domain" content="…" />
 *   <meta name="pl-ga4-id" content="G-…" />
 */
export function AnalyticsScripts(): null {
  useEffect(() => {
    const cfg =
      (window as unknown as { __PL_ANALYTICS__?: AnalyticsBoot }).__PL_ANALYTICS__ ?? {};
    const plausibleDomain =
      cfg.plausibleDomain?.trim() ||
      document.querySelector('meta[name="pl-plausible-domain"]')?.getAttribute('content')?.trim() ||
      '';
    const ga4Id =
      cfg.ga4Id?.trim() ||
      document.querySelector('meta[name="pl-ga4-id"]')?.getAttribute('content')?.trim() ||
      '';

    if (plausibleDomain && !document.querySelector('script[data-plausible]')) {
      const s = document.createElement('script');
      s.defer = true;
      s.dataset.plausible = '1';
      s.dataset.domain = plausibleDomain;
      s.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(s);
    }

    if (ga4Id && !document.querySelector('script[data-ga4]')) {
      const gtagSrc = document.createElement('script');
      gtagSrc.async = true;
      gtagSrc.dataset.ga4 = '1';
      gtagSrc.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
      document.head.appendChild(gtagSrc);

      window.dataLayer = window.dataLayer || [];
      // GA snippet relies on the Arguments object, not a rest array.
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', ga4Id, { anonymize_ip: true });
    }
  }, []);

  return null;
}
