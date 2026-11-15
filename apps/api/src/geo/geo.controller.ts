import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { GeocodeResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('reverse')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @CacheControl('public, max-age=86400')
  reverse(
    @Query('lat') lat?: string,
    @Query('lon') lon?: string
  ): Promise<GeocodeResponseDto> {
    return this.geo.reverse(Number(lat), Number(lon));
  }
}
