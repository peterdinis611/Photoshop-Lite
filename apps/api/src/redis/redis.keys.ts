/** Shared Redis key namespace for cache + throttle. */
export const REDIS_KEY_PREFIX = 'pslite';

export function cacheRedisKey(key: string): string {
  return `${REDIS_KEY_PREFIX}:cache:${key}`;
}

export function cacheRedisPattern(prefix: string): string {
  return `${REDIS_KEY_PREFIX}:cache:${prefix}*`;
}

export function throttleHitKey(key: string, throttlerName: string): string {
  return `{${REDIS_KEY_PREFIX}:throttle:${key}:${throttlerName}}:hits`;
}

export function throttleBlockKey(key: string, throttlerName: string): string {
  return `{${REDIS_KEY_PREFIX}:throttle:${key}:${throttlerName}}:blocked`;
}
