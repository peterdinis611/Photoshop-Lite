import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontsService } from './fonts.service';
import { FALLBACK_GOOGLE_FONTS } from './fallback-fonts';
import { CacheService } from '../cache/cache.service';

describe('FontsService', () => {
  const prevKey = process.env.GOOGLE_FONTS_API_KEY;
  let cache: CacheService;
  let service: FontsService;

  beforeEach(async () => {
    delete process.env.GOOGLE_FONTS_API_KEY;
    vi.unstubAllGlobals();
    cache = new CacheService();
    service = new FontsService(cache);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await cache.clear();
    await cache.onModuleDestroy();
    if (prevKey === undefined) delete process.env.GOOGLE_FONTS_API_KEY;
    else process.env.GOOGLE_FONTS_API_KEY = prevKey;
  });

  it('returns curated fallback catalog without API key', async () => {
    const catalog = await service.list();
    expect(catalog.source).toBe('fallback');
    expect(catalog.items.length).toBe(FALLBACK_GOOGLE_FONTS.length);
    expect(catalog.items.some((f) => f.family === 'Bricolage Grotesque')).toBe(true);
    expect(catalog.items.some((f) => f.family === 'Source Sans 3')).toBe(true);
  });

  it('filters by family query', async () => {
    const result = await service.list('mono');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((f) => /mono/i.test(f.family) || /mono/i.test(f.category))).toBe(
      true
    );
  });

  it('uses Google API when key is set', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { family: 'Custom Font', category: 'sans-serif', variants: ['regular', '700'] },
          ],
        }),
      })
    );

    // Fresh service + cache so catalog isn't polluted by previous fallback
    await cache.clear();
    service = new FontsService(cache);

    const catalog = await service.list();
    expect(catalog.source).toBe('google-api');
    expect(catalog.items).toEqual([
      { family: 'Custom Font', category: 'sans-serif', variants: ['regular', '700'] },
    ]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('webfonts/v1/webfonts'));
  });

  it('falls back when Google API fails', async () => {
    process.env.GOOGLE_FONTS_API_KEY = 'bad-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      })
    );

    await cache.clear();
    service = new FontsService(cache);

    const catalog = await service.list();
    expect(catalog.source).toBe('fallback');
    expect(catalog.items.length).toBe(FALLBACK_GOOGLE_FONTS.length);
  });

  it('serves catalog from CacheService on second call', async () => {
    const first = await service.list();
    const spy = vi.spyOn(globalThis, 'fetch');
    const second = await service.list();
    expect(second).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
