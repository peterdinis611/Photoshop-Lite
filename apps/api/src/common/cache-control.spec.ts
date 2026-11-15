import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { CACHE_CONTROL_KEY, CacheControl } from './cache-control';

describe('CacheControl decorator', () => {
  it('stores Cache-Control metadata key', () => {
    class Sample {
      handler() {
        return 'ok';
      }
    }

    // Apply decorator without `@` — Vitest/esbuild does not parse TS experimentalDecorators.
    const desc = Object.getOwnPropertyDescriptor(Sample.prototype, 'handler')!;
    CacheControl('public, max-age=60')(Sample.prototype, 'handler', desc);

    const meta = Reflect.getMetadata(CACHE_CONTROL_KEY, Sample.prototype.handler);
    expect(meta).toBe('public, max-age=60');
  });
});
