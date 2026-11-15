import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@photoshop-lite/shared-types';

@Injectable()
export class HealthService {
  getHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'Photoshop-Lite AI Engine (NestJS)',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      replicateConfigured: Boolean(process.env.REPLICATE_API_TOKEN?.trim()),
      removeBgConfigured: Boolean(process.env.REMOVE_BG_API_KEY?.trim()),
      unsplashConfigured: Boolean(process.env.UNSPLASH_ACCESS_KEY?.trim()),
      pexelsConfigured: Boolean(process.env.PEXELS_API_KEY?.trim()),
      pixabayConfigured: Boolean(process.env.PIXABAY_API_KEY?.trim()),
      openverseAvailable: true,
      huggingfaceConfigured: Boolean(
        process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim()
      ),
    };
  }
}
