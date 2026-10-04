import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CacheKeys, CacheService } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.onModuleDestroy();
  });

  it('sets and gets values', async () => {
    await cache.set('k1', { ok: true }, 5_000);
    expect(await cache.get('k1')).toEqual({ ok: true });
  });

  it('wrap caches factory results', async () => {
    let calls = 0;
    const a = await cache.wrap('wrap1', () => {
      calls += 1;
      return 'v';
    });
    const b = await cache.wrap('wrap1', () => {
      calls += 1;
      return 'v2';
    });
    expect(a).toBe('v');
    expect(b).toBe('v');
    expect(calls).toBe(1);
  });

  it('invalidatePrefix only clears matching workspace keys', async () => {
    await cache.set(CacheKeys.projectList('ws_a'), [1], 5_000);
    await cache.set(CacheKeys.projectList('ws_b'), [2], 5_000);
    await cache.set(CacheKeys.fontsCatalog(), { items: [] }, 5_000);

    await cache.invalidatePrefix(CacheKeys.workspacePrefix('ws_a'));

    expect(await cache.get(CacheKeys.projectList('ws_a'))).toBeUndefined();
    expect(await cache.get(CacheKeys.projectList('ws_b'))).toEqual([2]);
    expect(await cache.get(CacheKeys.fontsCatalog())).toEqual({ items: [] });
  });
});
