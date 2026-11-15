import { Controller, Get, Query } from '@nestjs/common';
import { FontsService } from './fonts.service';
import type { GoogleFontsResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';

@Controller('fonts')
@CacheControl('public, max-age=3600, stale-while-revalidate=86400')
export class FontsController {
  constructor(private readonly fontsService: FontsService) {}

  @Get()
  list(@Query('q') q?: string): Promise<GoogleFontsResponseDto> {
    return this.fontsService.list(q);
  }
}
