import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeoService } from './geo.service';
import { CacheService } from '../cache/cache.service';

describe('GeoService', () => {
  let service: GeoService;

  beforeEach(() => {
    const cache = {
      wrap: (_key: string, fn: () => Promise<unknown>) => fn(),
    } as unknown as CacheService;
    service = new GeoService(cache);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects invalid coordinates', async () => {
    await expect(service.reverse(Number.NaN, 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reverse(91, 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reverse(0, 200)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns Nominatim display name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ display_name: 'Bratislava, Slovakia' }),
      })
    );

    const res = await service.reverse(48.1486, 17.1077);
    expect(res.label).toBe('Bratislava, Slovakia');
    expect(res.latitude).toBe(48.1486);
    expect(res.longitude).toBe(17.1077);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining('nominatim.openstreetmap.org/reverse'),
      }),
      expect.any(Object)
    );
  });

  it('returns null label when Nominatim fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const res = await service.reverse(1, 2);
    expect(res.label).toBeNull();
    expect(res.latitude).toBe(1);
    expect(res.longitude).toBe(2);
  });
});
