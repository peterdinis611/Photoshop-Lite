import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service';
import { CacheService } from '../cache/cache.service';

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    const cache = {
      wrap: (_key: string, fn: () => Promise<unknown>) => fn(),
    } as unknown as CacheService;
    service = new CatalogService(cache);
  });

  it('rewrites Poly Haven thumbs through /api/catalog/media', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          wood_planks: {
            name: 'Wood Planks',
            categories: ['wood'],
            tags: ['plank'],
            download_count: 99,
          },
        }),
      })
    );

    const res = await service.list('textures');
    expect(res.source).toBe('polyhaven');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].thumbUrl).toMatch(/^\/api\/catalog\/media\?url=/);
    expect(res.items[0].fullUrl).toMatch(/^https:\/\/cdn\.polyhaven\.com\//);
  });

  it('builds DiceBear marks with proxied thumbs', async () => {
    const res = await service.list('avatars', 'lab');
    expect(res.source).toBe('dicebear');
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].thumbUrl.startsWith('/api/catalog/media?url=')).toBe(true);
    expect(res.items[0].fullUrl).toContain('api.dicebear.com');
  });
});
