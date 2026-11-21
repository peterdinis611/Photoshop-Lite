import { afterEach, describe, expect, it } from 'vitest';
import { buildThrottlerOptions, ThrottlePresets } from './throttle.config';

describe('buildThrottlerOptions', () => {
  const keys = [
    'THROTTLE_TTL_MS',
    'THROTTLE_LIMIT',
    'THROTTLE_AI_LIMIT',
    'THROTTLE_STOCK_LIMIT',
    'THROTTLE_CATALOG_LIMIT',
    'THROTTLE_READ_LIMIT',
  ];
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('returns default / ai / stock / catalog / read buckets', () => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    const opts = buildThrottlerOptions();
    expect(opts.map((o) => o.name)).toEqual(['default', 'ai', 'stock', 'catalog', 'read']);
    expect(opts[0].limit).toBe(120);
    expect(opts[1].limit).toBe(20);
    expect(opts[2].limit).toBe(60);
    expect(opts[3].limit).toBe(90);
    expect(opts[4].limit).toBe(180);
    expect(opts[0].ttl).toBe(60_000);
  });

  it('reads env overrides', () => {
    for (const k of keys) prev[k] = process.env[k];
    process.env.THROTTLE_TTL_MS = '30000';
    process.env.THROTTLE_LIMIT = '50';
    process.env.THROTTLE_AI_LIMIT = '5';
    process.env.THROTTLE_STOCK_LIMIT = '15';
    process.env.THROTTLE_CATALOG_LIMIT = '25';
    process.env.THROTTLE_READ_LIMIT = '40';
    const opts = buildThrottlerOptions();
    expect(opts[0]).toMatchObject({ ttl: 30_000, limit: 50 });
    expect(opts[1].limit).toBe(5);
    expect(opts[2].limit).toBe(15);
    expect(opts[3].limit).toBe(25);
    expect(opts[4].limit).toBe(40);
  });

  it('ThrottlePresets mirror env buckets', () => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    expect(ThrottlePresets.ai.ai.limit).toBe(20);
    expect(ThrottlePresets.stock.stock.limit).toBe(60);
    expect(ThrottlePresets.catalog.catalog.limit).toBe(90);
    expect(ThrottlePresets.read.read.limit).toBe(180);
    expect(ThrottlePresets.stockFetch.stock.limit).toBe(30);
    expect(ThrottlePresets.catalogMedia.stock.limit).toBeGreaterThanOrEqual(120);
  });
});
