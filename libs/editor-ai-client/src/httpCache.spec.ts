import { describe, expect, it } from 'vitest';
import {
  ClientHttpCache,
  defaultTtlForPath,
  parseCacheControl,
} from './httpCache';

describe('parseCacheControl', () => {
  it('reads max-age and swr', () => {
    const parsed = parseCacheControl('public, max-age=1800, stale-while-revalidate=86400');
    expect(parsed.maxAgeMs).toBe(1_800_000);
    expect(parsed.swrMs).toBe(86_400_000);
    expect(parsed.noStore).toBe(false);
  });

  it('detects no-store', () => {
    expect(parseCacheControl('no-store').noStore).toBe(true);
    expect(parseCacheControl('private, no-cache').noStore).toBe(true);
  });
});

describe('defaultTtlForPath', () => {
  it('maps catalog / fonts / stock', () => {
    expect(defaultTtlForPath('/catalog?kind=textures')).toBeGreaterThan(60_000);
    expect(defaultTtlForPath('/fonts?q=a')).toBeGreaterThan(60_000);
    expect(defaultTtlForPath('/stock/search?q=x')).toBe(5 * 60_000);
  });
});

describe('ClientHttpCache', () => {
  it('returns fresh then stale then miss', () => {
    const cache = new ClientHttpCache();
    const key = cache.key('ws', 'GET', '/catalog');
    cache.set(key, { ok: 1 }, { maxAgeMs: 50, staleWhileRevalidateMs: 50 });
    expect(cache.peek(key).state).toBe('fresh');
  });

  it('singleFlight dedupes concurrent work', async () => {
    const cache = new ClientHttpCache();
    let calls = 0;
    const factory = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return 'v';
    };
    const [a, b] = await Promise.all([
      cache.singleFlight('k', factory),
      cache.singleFlight('k', factory),
    ]);
    expect(a).toBe('v');
    expect(b).toBe('v');
    expect(calls).toBe(1);
  });

  it('invalidatePath clears matching GETs', () => {
    const cache = new ClientHttpCache();
    cache.set(cache.key('ws', 'GET', '/assets'), [], { maxAgeMs: 10_000 });
    cache.set(cache.key('ws', 'GET', '/projects'), [], { maxAgeMs: 10_000 });
    expect(cache.invalidatePath('/assets')).toBe(1);
    expect(cache.peek(cache.key('ws', 'GET', '/assets')).state).toBe('miss');
    expect(cache.peek(cache.key('ws', 'GET', '/projects')).state).toBe('fresh');
  });
});
