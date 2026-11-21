import { Controller, Get, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { CatalogKind, CatalogListResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { StockService } from '../stock/stock.service';
import { CatalogService } from './catalog.service';

const KINDS = new Set<CatalogKind>(['textures', 'placeholders', 'avatars']);

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly stock: StockService
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @CacheControl('public, max-age=1800, stale-while-revalidate=86400')
  list(
    @Query('kind') kindRaw?: string,
    @Query('q') q?: string,
    @Query('page') pageRaw?: string
  ): Promise<CatalogListResponseDto> {
    const kind = (KINDS.has(kindRaw as CatalogKind) ? kindRaw : 'textures') as CatalogKind;
    const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1);
    return this.catalog.list(kind, q, page);
  }

  /**
   * Stream an allowlisted catalog/stock image through the API
   * so the editor never talks to CDNs directly (thumbs + place preview).
   */
  @Get('media')
  @Throttle({ stock: { limit: 120, ttl: 60_000 } })
  @CacheControl('public, max-age=86400, stale-while-revalidate=604800')
  async media(@Query('url') url: string | undefined, @Res() res: Response): Promise<void> {
    const { buffer, contentType } = await this.stock.fetchImageBinary(url || '');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(buffer.byteLength));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }
}
