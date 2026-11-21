import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { StockFetchResponseDto, StockSearchResponseDto } from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { ThrottlePresets } from '../common/throttle.config';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('search')
  @Throttle(ThrottlePresets.stock)
  @CacheControl('public, max-age=300, stale-while-revalidate=600')
  search(
    @Query('q') q?: string,
    @Query('page') page?: string
  ): Promise<StockSearchResponseDto> {
    return this.stock.search(q || 'nature', Number(page) || 1);
  }

  @Get('fetch')
  @Throttle(ThrottlePresets.stockFetch)
  @CacheControl('private, max-age=3600')
  fetch(@Query('url') url?: string): Promise<StockFetchResponseDto> {
    return this.stock.fetchImage(url || '');
  }
}
