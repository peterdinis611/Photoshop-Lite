import { Controller, Get, Query } from '@nestjs/common';
import { FontsService } from './fonts.service';
import { GoogleFontsResponseDto } from '@photoshop-lite/shared-types';

@Controller('fonts')
export class FontsController {
  constructor(private readonly fontsService: FontsService) {}

  @Get()
  list(@Query('q') q?: string): Promise<GoogleFontsResponseDto> {
    return this.fontsService.list(q);
  }
}
