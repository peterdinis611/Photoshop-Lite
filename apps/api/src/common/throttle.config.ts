import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { RedisThrottlerStorage } from '../redis/redis-throttler.storage';
import type { RedisClient } from '../redis/redis.client';

/** Env-driven Nest Throttler limits (ttl in milliseconds). */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export type ThrottleBucket = {
  name: string;
  ttl: number;
  limit: number;
};

export function buildThrottlerOptions(): readonly ThrottleBucket[] {
  const ttl = envInt('THROTTLE_TTL_MS', 60_000);
  return [
    {
      name: 'default',
      ttl,
      limit: envInt('THROTTLE_LIMIT', 120),
    },
    {
      name: 'ai',
      ttl,
      limit: envInt('THROTTLE_AI_LIMIT', 20),
    },
    {
      name: 'stock',
      ttl,
      limit: envInt('THROTTLE_STOCK_LIMIT', 60),
    },
    {
      name: 'catalog',
      ttl,
      limit: envInt('THROTTLE_CATALOG_LIMIT', 90),
    },
    {
      name: 'read',
      ttl,
      limit: envInt('THROTTLE_READ_LIMIT', 180),
    },
    {
      name: 'write',
      ttl,
      limit: envInt('THROTTLE_WRITE_LIMIT', 40),
    },
  ] as const;
}

/** Nest Throttler root options — Redis storage when a client is available. */
export function buildThrottlerModuleOptions(
  redis: RedisClient | null | undefined
): ThrottlerModuleOptions {
  const throttlers = [...buildThrottlerOptions()];
  if (redis) {
    return {
      throttlers,
      storage: new RedisThrottlerStorage(redis),
    };
  }
  return { throttlers };
}

type NamedLimit = { limit: number; ttl: number };

function bucketMap(): Record<string, NamedLimit> {
  const map: Record<string, NamedLimit> = {};
  for (const b of buildThrottlerOptions()) {
    map[b.name] = { limit: b.limit, ttl: b.ttl };
  }
  return map;
}

/**
 * Route-level `@Throttle(...)` presets that stay in sync with env / forRoot.
 * Import and spread: `@Throttle(ThrottlePresets.stock)`.
 */
export const ThrottlePresets = {
  /** Heavy AI inference. */
  get ai(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { ai: b.ai };
  },
  /** Stock search + remote image fetch. */
  get stock(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { stock: b.stock };
  },
  /** Catalog list (Poly Haven / Picsum / DiceBear). */
  get catalog(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { catalog: b.catalog };
  },
  /** Binary media proxy — higher ceiling, still capped. */
  get catalogMedia(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { stock: { limit: Math.max(b.stock.limit * 2, 120), ttl: b.stock.ttl } };
  },
  /** Cheap public reads (fonts, palette, geo). */
  get read(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { read: b.read };
  },
  /** Project / asset mutations (large JSON PUTs, uploads). */
  get write(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { write: b.write };
  },
  /** Stock fetch is more expensive than search. */
  get stockFetch(): Record<string, NamedLimit> {
    const b = bucketMap();
    return { stock: { limit: Math.max(Math.floor(b.stock.limit / 2), 15), ttl: b.stock.ttl } };
  },
};
