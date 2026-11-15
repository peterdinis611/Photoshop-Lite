import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AssetsService } from './assets.service';
import type { AssetResponseDto, AssetUploadDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';

@Controller('assets')
@CacheControl('private, no-store')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(): Promise<AssetResponseDto[]> {
    return this.assets.list();
  }

  @Post('upload')
  upload(@Body() body: AssetUploadDto): Promise<AssetResponseDto> {
    return this.assets.upload(body);
  }

  @Get(':id')
  @CacheControl('private, max-age=86400')
  get(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { stream, mimeType } = this.assets.getFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return stream;
  }
}
