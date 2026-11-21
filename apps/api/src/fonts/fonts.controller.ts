import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { GoogleFontsResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { ThrottlePresets } from '../common/throttle.config';
import { FontsService } from './fonts.service';

@Controller('fonts')
@Throttle(ThrottlePresets.read)
@CacheControl('public, max-age=3600, stale-while-revalidate=86400')
export class FontsController {
  constructor(private readonly fontsService: FontsService) {}

  @Get()
  list(@Query('q') q?: string): Promise<GoogleFontsResponseDto> {
    return this.fontsService.list(q);
  }
}
