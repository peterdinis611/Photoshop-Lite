import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { RedisClient } from './redis.client';
import { throttleBlockKey, throttleHitKey } from './redis.keys';

/**
 * Redis-backed Nest Throttler storage (shared across API instances).
 * Lua script adapted from @nest-lab/throttler-storage-redis / rate-limit-redis.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly scriptSrc: string;

  constructor(private readonly redis: RedisClient) {
    this.scriptSrc = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local blockDuration = tonumber(ARGV[4])

local totalHits = redis.call('INCR', hitKey)
local timeToExpire = redis.call('PTTL', hitKey)

if timeToExpire <= 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  timeToExpire = ttl
end

local isBlocked = redis.call('GET', blockKey)
local timeToBlockExpire = 0

if isBlocked then
  timeToBlockExpire = redis.call('PTTL', blockKey)
elseif totalHits > limit then
  redis.call('SET', blockKey, 1, 'PX', blockDuration)
  isBlocked = '1'
  timeToBlockExpire = blockDuration
end

if isBlocked and timeToBlockExpire <= 0 then
  redis.call('DEL', blockKey)
  redis.call('SET', hitKey, 1, 'PX', ttl)
  totalHits = 1
  timeToExpire = ttl
  isBlocked = false
end

return { totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire }
`.replace(/^\s+/gm, '').trim();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = throttleHitKey(key, throttlerName);
    const blockKey = throttleBlockKey(key, throttlerName);
    const results = (await this.redis.eval(
      this.scriptSrc,
      2,
      hitKey,
      blockKey,
      throttlerName,
      ttl,
      limit,
      blockDuration || ttl
    )) as number[];

    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = results;
    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpire / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
    };
  }
}
