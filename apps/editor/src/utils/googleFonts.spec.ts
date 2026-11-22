import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@photoshop-lite/editor-ai-client', () => ({
  aiApiClient: {
    listFonts: vi.fn(),
  },
}));

import { aiApiClient } from '@photoshop-lite/editor-ai-client';
import { fetchGoogleFonts, loadGoogleFont } from './googleFonts';

describe('googleFonts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.head.querySelectorAll('link[id^="gfont-"]').forEach((n) => n.remove());
  });

  it('returns API catalog when listFonts succeeds', async () => {
    vi.mocked(aiApiClient.listFonts).mockResolvedValue({
      source: 'google-api',
      items: [{ family: 'Syne', category: 'sans-serif', variants: ['400'] }],
    });
    const res = await fetchGoogleFonts();
    expect(res.source).toBe('google-api');
    expect(res.items[0].family).toBe('Syne');
  });

  it('falls back when listFonts throws', async () => {
    vi.mocked(aiApiClient.listFonts).mockRejectedValue(new Error('offline'));
    const res = await fetchGoogleFonts('mono');
    expect(res.source).toBe('fallback');
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((f) => /mono/i.test(f.family) || /mono/i.test(f.category))).toBe(
      true
    );
  });

  it('falls back when API returns empty items', async () => {
    vi.mocked(aiApiClient.listFonts).mockResolvedValue({ source: 'google-api', items: [] });
    const res = await fetchGoogleFonts();
    expect(res.source).toBe('fallback');
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('injects a stylesheet for a new family', async () => {
    const load = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load, ready: Promise.resolve() },
    });

    await loadGoogleFont('Source Sans 3');
    const link = document.getElementById('gfont-source-sans-3') as HTMLLinkElement | null;
    expect(link?.rel).toBe('stylesheet');
    expect(link?.href).toContain('fonts.googleapis.com');
    expect(link?.href).toContain('Source+Sans+3');
  });
});
