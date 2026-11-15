/** Env-driven Nest Throttler limits (ttl in milliseconds). */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function buildThrottlerOptions() {
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
  ] as const;
}
