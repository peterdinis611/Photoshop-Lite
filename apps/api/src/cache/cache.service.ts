import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createCache } from 'cache-manager';

const DEFAULT_TTL_MS = 60_000;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = createCache({ ttl: DEFAULT_TTL_MS });
  private readonly knownKeys = new Set<string>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cache.get<T>(key);
    return value === null || value === undefined ? undefined : value;
  }

  async set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    this.knownKeys.add(key);
    await this.cache.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    this.knownKeys.delete(key);
    await this.cache.del(key);
  }

  /** Drop every key that starts with prefix (workspace-scoped invalidation). */
  async invalidatePrefix(prefix: string): Promise<number> {
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
    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  async clear(): Promise<void> {
    this.knownKeys.clear();
    await this.cache.clear();
  }

  async onModuleDestroy(): Promise<void> {
    await this.cache.disconnect();
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
  workspacePrefix: (workspaceId: string) => `ws:${workspaceId}:`,
};
