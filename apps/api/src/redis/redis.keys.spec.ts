import { describe, expect, it } from 'vitest';
import {
  cacheRedisKey,
  cacheRedisPattern,
  throttleBlockKey,
  throttleHitKey,
} from './redis.keys';

describe('redis.keys', () => {
  it('namespaces cache keys', () => {
    expect(cacheRedisKey('ws:a:projects:list')).toBe('pslite:cache:ws:a:projects:list');
    expect(cacheRedisPattern('ws:a:')).toBe('pslite:cache:ws:a:*');
  });

  it('uses hash tags for throttle keys (cluster-safe)', () => {
    expect(throttleHitKey('ws:abc', 'ai')).toContain('{pslite:throttle:ws:abc:ai}');
    expect(throttleBlockKey('ws:abc', 'ai')).toContain(':blocked');
  });
});
