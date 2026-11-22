import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackCta } from './trackCta';

describe('trackCta', () => {
  beforeEach(() => {
    delete window.plausible;
    delete window.gtag;
    delete window.dataLayer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls plausible when available', () => {
    const plausible = vi.fn();
    window.plausible = plausible;
    trackCta('hero_start_edit', { plan: 'free' });
    expect(plausible).toHaveBeenCalledWith('hero_start_edit', {
      props: { plan: 'free' },
    });
  });

  it('calls gtag when available', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackCta('pricing_toggle', { billing: 'yearly' });
    expect(gtag).toHaveBeenCalledWith('event', 'pricing_toggle', {
      event_category: 'cta',
      billing: 'yearly',
    });
  });

  it('pushes to dataLayer as fallback', () => {
    window.dataLayer = [];
    trackCta('faq_open', { question: 'pricing' });
    expect(window.dataLayer).toEqual([
      { event: 'faq_open', question: 'pricing' },
    ]);
  });

  it('does not throw when nothing is wired', () => {
    expect(() => trackCta('nav_try_free')).not.toThrow();
  });
});
