import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import type { HealthCheckResponse } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @CacheControl('no-store')
  check(): HealthCheckResponse {
    return this.healthService.getHealth();
  }
}
