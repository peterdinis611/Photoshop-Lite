export interface HttpCacheEntry<T = unknown> {
  value: T;
  /** Fresh until this timestamp (Date.now()). */
  freshUntil: number;
  /** Usable as stale until this timestamp (SWR window). */
  staleUntil: number;
}

export interface HttpCacheSetOptions {
  maxAgeMs: number;
  staleWhileRevalidateMs?: number;
}

/** Default TTLs when the response has no Cache-Control max-age. */
export const DEFAULT_GET_TTL_MS: Record<string, number> = {
  '/catalog': 30 * 60_000,
  '/fonts': 60 * 60_000,
  '/stock/search': 5 * 60_000,
  '/palette': 60 * 60_000,
  '/geo': 24 * 60 * 60_000,
  '/projects': 30_000,
  '/assets': 30_000,
  '/health': 10_000,
};

const DEFAULT_SWR_MS = 5 * 60_000;

export function defaultTtlForPath(path: string): number {
  const bare = path.split('?')[0] || path;
  for (const [prefix, ttl] of Object.entries(DEFAULT_GET_TTL_MS)) {
    if (bare === prefix || bare.startsWith(`${prefix}/`) || bare.startsWith(prefix)) {
      return ttl;
    }
  }
  return 15_000;
}

/** Parse Cache-Control for max-age / stale-while-revalidate (seconds → ms). */
export function parseCacheControl(header: string | null): {
  maxAgeMs: number | null;
  swrMs: number | null;
  noStore: boolean;
} {
  if (!header) return { maxAgeMs: null, swrMs: null, noStore: false };
  const lower = header.toLowerCase();
  if (/\bno-store\b/.test(lower) || /\bno-cache\b/.test(lower)) {
    return { maxAgeMs: null, swrMs: null, noStore: true };
  }
  const maxAge = lower.match(/max-age\s*=\s*(\d+)/);
  const swr = lower.match(/stale-while-revalidate\s*=\s*(\d+)/);
  return {
    maxAgeMs: maxAge ? Number(maxAge[1]) * 1000 : null,
    swrMs: swr ? Number(swr[1]) * 1000 : null,
    noStore: false,
  };
}

/**
 * In-memory GET response cache with single-flight + stale-while-revalidate.
 * Workspace-scoped keys keep tenant data isolated on the client.
 */
export class ClientHttpCache {
  private readonly store = new Map<string, HttpCacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  key(workspaceId: string | null | undefined, method: string, path: string): string {
    return `${workspaceId || '_'}|${method}|${path}`;
  }

  peek<T>(key: string): { state: 'miss' | 'fresh' | 'stale'; value?: T } {
    const entry = this.store.get(key) as HttpCacheEntry<T> | undefined;
    if (!entry) return { state: 'miss' };
    const now = Date.now();
    if (now <= entry.freshUntil) return { state: 'fresh', value: entry.value };
    if (now <= entry.staleUntil) return { state: 'stale', value: entry.value };
    this.store.delete(key);
    return { state: 'miss' };
  }

  set<T>(key: string, value: T, opts: HttpCacheSetOptions): void {
    const now = Date.now();
    const swr = opts.staleWhileRevalidateMs ?? DEFAULT_SWR_MS;
    this.store.set(key, {
      value,
      freshUntil: now + Math.max(0, opts.maxAgeMs),
      staleUntil: now + Math.max(0, opts.maxAgeMs) + Math.max(0, swr),
    });
  }

  invalidatePrefix(prefix: string): number {
    let n = 0;
    for (const k of [...this.store.keys()]) {
      if (k.includes(prefix)) {
        this.store.delete(k);
        n += 1;
      }
    }
    return n;
  }

  invalidatePath(pathPrefix: string): number {
    let n = 0;
    for (const k of [...this.store.keys()]) {
      // keys look like `ws|GET|/projects?...`
      const pathPart = k.split('|').slice(2).join('|');
      if (pathPart.startsWith(pathPrefix)) {
        this.store.delete(k);
        n += 1;
      }
    }
    return n;
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /**
   * Dedup concurrent producers for the same key.
   * Caller is responsible for writing the result via set().
   */
  async singleFlight<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const run = factory().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, run);
    return run;
  }
}

export const sharedHttpCache = new ClientHttpCache();
