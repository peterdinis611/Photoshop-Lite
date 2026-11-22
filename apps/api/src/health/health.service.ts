import { Inject, Injectable, Optional } from '@nestjs/common';
import type { HealthCheckResponse } from '@photoshop-lite/shared-types';
import { CacheService } from '../cache/cache.service';
import { REDIS_CLIENT, type RedisClient } from '../redis/redis.client';

@Injectable()
export class HealthService {
  constructor(
    @Optional() private readonly cache?: CacheService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: RedisClient | null
  ) {}

  /** Public probe — no secret / integration recon. */
  getHealth(): HealthCheckResponse {
    const redisStatus: 'connected' | 'memory' =
      this.redis || this.cache?.backend === 'redis' ? 'connected' : 'memory';

    return {
      status: 'ok',
      service: 'Photoshop-Lite AI Engine (NestJS)',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      redis: redisStatus,
    };
  }
}
