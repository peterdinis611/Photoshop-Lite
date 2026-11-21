import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.unstubAllGlobals();
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
          metal_plate: {
            name: 'Metal Plate',
            categories: ['metal'],
            tags: [],
            download_count: 10,
          },
        }),
      })
    );

    const res = await service.list('textures');
    expect(res.source).toBe('polyhaven');
    expect(res.items).toHaveLength(2);
    expect(res.items[0].title).toBe('Wood Planks');
    expect(res.items[0].thumbUrl).toMatch(/^\/api\/catalog\/media\?url=/);
    expect(res.items[0].fullUrl).toMatch(/^https:\/\/cdn\.polyhaven\.com\//);
    expect(decodeURIComponent(res.items[0].thumbUrl)).toContain('cdn.polyhaven.com');
  });

  it('filters Poly Haven textures by query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          wood_planks: { name: 'Wood', categories: ['wood'], tags: [], download_count: 1 },
          blue_fabric: { name: 'Fabric', categories: ['fabric'], tags: ['cloth'], download_count: 2 },
        }),
      })
    );

    const res = await service.list('textures', 'fabric');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe('ph-blue_fabric');
  });

  it('returns empty textures list when Poly Haven fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const res = await service.list('textures');
    expect(res.source).toBe('error');
    expect(res.items).toEqual([]);
  });

  it('lists Picsum plates with proxied thumbs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: '12',
            author: 'Ada',
            width: 4000,
            height: 3000,
            url: 'https://picsum.photos/id/12/info',
            download_url: 'https://picsum.photos/id/12/4000/3000',
          },
        ],
      })
    );

    const res = await service.list('placeholders', undefined, 2);
    expect(res.source).toBe('picsum');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].author).toBe('Ada');
    expect(res.items[0].fullUrl).toContain('picsum.photos/id/12/1200/900');
    expect(res.items[0].thumbUrl.startsWith('/api/catalog/media?url=')).toBe(true);
  });

  it('builds DiceBear marks with proxied thumbs', async () => {
    const res = await service.list('avatars', 'lab');
    expect(res.source).toBe('dicebear');
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].thumbUrl.startsWith('/api/catalog/media?url=')).toBe(true);
    expect(res.items[0].fullUrl).toContain('api.dicebear.com');
    expect(res.query).toBe('lab');
  });

  it('sanitizes avatar seed to alphanumeric', async () => {
    const res = await service.list('avatars', '!!bad seed!!');
    expect(res.query).toBe('badseed');
    expect(res.items[0].fullUrl).toContain('badseed');
  });
});
