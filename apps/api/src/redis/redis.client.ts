import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisClient = Redis;

export function getRedisUrl(): string | undefined {
  const url = process.env.REDIS_URL?.trim();
  return url || undefined;
}

/**
 * Connect to Redis when REDIS_URL is set.
 * Returns null on missing URL or connection failure (callers fall back to memory).
 */
export async function createRedisClient(): Promise<RedisClient | null> {
  const url = getRedisUrl();
  if (!url) return null;

  const logger = new Logger('Redis');
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 5_000,
  });

  client.on('error', (err) => {
    logger.warn(`Redis error: ${err.message}`);
  });

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') {
      throw new Error(`Unexpected PING response: ${pong}`);
    }
    const safe = url.replace(/\/\/([^@/]+)@/, '//***@');
    logger.log(`Connected (${safe})`);
    return client;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Unavailable — using in-memory cache/throttle (${message})`);
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
    return null;
  }
}

export async function destroyRedisClient(client: RedisClient | null): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}
