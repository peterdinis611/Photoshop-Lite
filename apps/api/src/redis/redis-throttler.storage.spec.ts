import { describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('maps Lua eval results into ThrottlerStorageRecord', async () => {
    const evalFn = vi.fn().mockResolvedValue([3, 1500, 0, 0]);
    const redis = { eval: evalFn } as never;
    const storage = new RedisThrottlerStorage(redis);

    const record = await storage.increment('ws:abc', 60_000, 10, 60_000, 'ai');

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 2,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(evalFn).toHaveBeenCalledOnce();
    const args = evalFn.mock.calls[0];
    expect(args[1]).toBe(2); // num keys
    expect(String(args[2])).toContain('throttle');
    expect(args[5]).toBe(60_000); // ttl
    expect(args[6]).toBe(10); // limit
  });

  it('marks blocked when Lua returns isBlocked=1', async () => {
    const redis = {
      eval: vi.fn().mockResolvedValue([11, 800, 1, 5000]),
    } as never;
    const storage = new RedisThrottlerStorage(redis);
    const record = await storage.increment('ip:1', 60_000, 10, 5_000, 'default');
    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(5);
  });
});
