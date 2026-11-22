import { HttpException, HttpStatus } from '@nestjs/common';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Simple in-process semaphore — protects a single API instance from
 * unbounded concurrent AI upstream calls under traffic spikes.
 */
export class ConcurrencyGate {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  get running(): number {
    return this.active;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      // Fail fast under overload so clients can retry / back off
      throw new HttpException(
        {
          error: `Server busy (${this.max} concurrent AI jobs). Retry shortly.`,
          code: 'OVERLOADED',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }
}

let aiGate: ConcurrencyGate | null = null;

export function getAiConcurrencyGate(): ConcurrencyGate {
  if (!aiGate) {
    aiGate = new ConcurrencyGate(envInt('AI_MAX_CONCURRENT', 8));
  }
  return aiGate;
}

/** Test helper — reset singleton between specs. */
export function resetAiConcurrencyGate(): void {
  aiGate = null;
}
