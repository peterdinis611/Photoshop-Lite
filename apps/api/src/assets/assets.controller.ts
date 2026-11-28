import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AssetsService } from './assets.service';
import type { AssetResponseDto, AssetUploadDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { ThrottlePresets } from '../common/throttle.config';

@Controller('assets')
@CacheControl('private, no-store')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @Throttle(ThrottlePresets.read)
  list(): Promise<AssetResponseDto[]> {
    return this.assets.list();
  }

  @Post('upload')
  @Throttle(ThrottlePresets.write)
  upload(@Body() body: AssetUploadDto): Promise<AssetResponseDto> {
    return this.assets.upload(body);
  }

  @Delete(':id')
  @Throttle(ThrottlePresets.write)
  remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.assets.remove(id);
  }

  @Get(':id')
  @Throttle(ThrottlePresets.read)
  @CacheControl('private, max-age=86400')
  get(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { stream, mimeType } = this.assets.getFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return stream;
  }
}
