import { describe, expect, it } from 'vitest';
import { CACHE_CONTROL_KEY, CacheControl } from './cache-control';

describe('CacheControl decorator', () => {
  it('stores Cache-Control metadata key', () => {
    class Sample {
      @CacheControl('public, max-age=60')
      handler() {
        return 'ok';
      }
    }
    const meta = Reflect.getMetadata(CACHE_CONTROL_KEY, Sample.prototype.handler);
    expect(meta).toBe('public, max-age=60');
  });
});
