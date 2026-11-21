import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@photoshop-lite/shared-types';

@Injectable()
export class HealthService {
  /** Public probe — no secret / integration recon. */
  getHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'Photoshop-Lite AI Engine (NestJS)',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
