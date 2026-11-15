import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { PaletteHarmonyResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { PaletteService } from './palette.service';

@Controller('palette')
export class PaletteController {
  constructor(private readonly palette: PaletteService) {}

  @Get('harmony')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @CacheControl('public, max-age=3600')
  harmony(@Query('seed') seed?: string): Promise<PaletteHarmonyResponseDto> {
    return this.palette.harmony(seed);
  }
}
