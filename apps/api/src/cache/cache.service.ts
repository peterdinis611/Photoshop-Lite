import { Inject, Injectable, Logger, Optional, OnModuleDestroy } from '@nestjs/common';
import { createCache } from 'cache-manager';
import type { RedisClient } from '../redis/redis.client';
import { REDIS_CLIENT } from '../redis/redis.client';
import { cacheRedisKey, cacheRedisPattern } from '../redis/redis.keys';

const DEFAULT_TTL_MS = 60_000;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = createCache({ ttl: DEFAULT_TTL_MS });
  private readonly knownKeys = new Set<string>();
  /** Single-flight: concurrent wrap() for the same key share one factory call. */
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly redis: RedisClient | null;

  constructor(@Optional() @Inject(REDIS_CLIENT) redis?: RedisClient | null) {
    this.redis = redis ?? null;
    if (this.redis) {
      this.logger.log('Using Redis cache backend');
    }
  }

  get backend(): 'redis' | 'memory' {
    return this.redis ? 'redis' : 'memory';
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.redis) {
      const raw = await this.redis.get(cacheRedisKey(key));
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        await this.redis.del(cacheRedisKey(key));
        return undefined;
      }
    }
    const value = await this.memory.get<T>(key);
    return value === null || value === undefined ? undefined : value;
  }

  async set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    if (this.redis) {
      const payload = JSON.stringify(value);
      if (ttlMs > 0) {
        await this.redis.set(cacheRedisKey(key), payload, 'PX', ttlMs);
      } else {
        await this.redis.set(cacheRedisKey(key), payload);
      }
      return;
    }
    this.knownKeys.add(key);
    await this.memory.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(cacheRedisKey(key));
      return;
    }
    this.knownKeys.delete(key);
    await this.memory.del(key);
  }

  /** Drop every key that starts with prefix (workspace-scoped invalidation). */
  async invalidatePrefix(prefix: string): Promise<number> {
    if (this.redis) {
      const pattern = cacheRedisPattern(prefix);
      let cursor = '0';
      let removed = 0;
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) {
          removed += await this.redis.del(...keys);
        }
      } while (cursor !== '0');
      if (removed) {
        this.logger.debug(`Invalidated ${removed} Redis key(s) for prefix ${prefix}`);
      }
      return removed;
    }

    const matching = [...this.knownKeys].filter((k) => k.startsWith(prefix));
    await Promise.all(matching.map((k) => this.del(k)));
    if (matching.length) {
      this.logger.debug(`Invalidated ${matching.length} cache key(s) for prefix ${prefix}`);
    }
    return matching.length;
  }

  async wrap<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttlMs: number = DEFAULT_TTL_MS
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const run = (async () => {
      try {
        const again = await this.get<T>(key);
        if (again !== undefined) return again;
        const value = await factory();
        await this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, run);
    return run;
  }

  async clear(): Promise<void> {
    this.inflight.clear();
    if (this.redis) {
      const pattern = cacheRedisPattern('');
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
      return;
    }
    this.knownKeys.clear();
    await this.memory.clear();
  }

  async onModuleDestroy(): Promise<void> {
    // Redis client is owned by RedisModule
    if (!this.redis) {
      await this.memory.disconnect();
    }
  }
}

/** Cache key helpers — always include workspace for tenant isolation. */
export const CacheKeys = {
  projectList: (workspaceId: string) => `ws:${workspaceId}:projects:list`,
  project: (workspaceId: string, id: string) => `ws:${workspaceId}:projects:${id}`,
  projectVersions: (workspaceId: string, id: string) =>
    `ws:${workspaceId}:projects:${id}:versions`,
  assetList: (workspaceId: string) => `ws:${workspaceId}:assets:list`,
  fontsCatalog: () => 'fonts:catalog',
  fontsQuery: (q: string) => `fonts:q:${q}`,
  stockQuery: (provider: string, q: string, page: number) =>
    `stock:${provider}:q:${q}:p:${page}`,
  stockFetch: (url: string) => `stock:fetch:${url}`,
  catalog: (kind: string, q: string, page: number) =>
    `catalog:${kind}:v2:${q || '_'}:${page}`,
  paletteHarmony: (seed: string) => `palette:harmony:v2:${seed}`,
  geoReverse: (lat: number, lon: number) =>
    `geo:rev:${lat.toFixed(5)},${lon.toFixed(5)}`,
  workspacePrefix: (workspaceId: string) => `ws:${workspaceId}:`,
};
