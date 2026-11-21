import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaletteService } from './palette.service';
import { CacheService } from '../cache/cache.service';

describe('PaletteService', () => {
  let service: PaletteService;

  beforeEach(() => {
    const cache = {
      wrap: (_key: string, fn: () => Promise<unknown>) => fn(),
    } as unknown as CacheService;
    service = new PaletteService(cache);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Colormind palette when upstream succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: [
            [212, 146, 58],
            [94, 207, 192],
            [126, 176, 255],
            [236, 232, 225],
            [40, 44, 52],
          ],
        }),
      })
    );

    const res = await service.harmony('d4923a');
    expect(res.source).toBe('colormind');
    expect(res.colors).toHaveLength(5);
    expect(res.colors[0]).toBe('#d4923a');
    expect(fetch).toHaveBeenCalledWith(
      'http://colormind.io/api/',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to The Color API when Colormind fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          colors: [
            { hex: { value: '#D4923A' } },
            { hex: { value: '#E8A84A' } },
            { hex: { value: '#5ECFC0' } },
            { hex: { value: '#7EB0FF' } },
            { hex: { value: '#ECE8E1' } },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const res = await service.harmony('#d4923a');
    expect(res.source).toBe('thecolorapi');
    expect(res.colors).toEqual([
      '#d4923a',
      '#e8a84a',
      '#5ecfc0',
      '#7eb0ff',
      '#ece8e1',
    ]);
    expect(fetchMock.mock.calls[1][0]).toContain('thecolorapi.com/scheme');
  });

  it('uses darkroom fallback when both upstreams fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const res = await service.harmony('ffffff');
    expect(res.source).toBe('fallback');
    expect(res.colors[0]).toBe('#d4923a');
    expect(res.colors.length).toBeGreaterThanOrEqual(3);
  });
});
