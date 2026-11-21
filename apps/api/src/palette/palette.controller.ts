import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { PaletteHarmonyResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { ThrottlePresets } from '../common/throttle.config';
import { PaletteService } from './palette.service';

@Controller('palette')
export class PaletteController {
  constructor(private readonly palette: PaletteService) {}

  @Get('harmony')
  @Throttle(ThrottlePresets.read)
  @CacheControl('public, max-age=3600, stale-while-revalidate=86400')
  harmony(@Query('seed') seed?: string): Promise<PaletteHarmonyResponseDto> {
    return this.palette.harmony(seed);
  }
}
