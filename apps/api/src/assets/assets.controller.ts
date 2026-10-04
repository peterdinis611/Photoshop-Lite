import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AssetsService } from './assets.service';
import { AssetResponseDto, AssetUploadDto } from '@photoshop-lite/shared-types';

@Controller('assets')
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
  get(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { stream, mimeType } = this.assets.getFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return stream;
  }
}
