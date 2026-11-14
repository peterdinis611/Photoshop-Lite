import { Controller, Get, Query } from '@nestjs/common';
import type { StockFetchResponseDto, StockSearchResponseDto } from '@photoshop-lite/shared-types';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('page') page?: string
  ): Promise<StockSearchResponseDto> {
    return this.stock.search(q || 'nature', Number(page) || 1);
  }

  @Get('fetch')
  fetch(@Query('url') url?: string): Promise<StockFetchResponseDto> {
    return this.stock.fetchImage(url || '');
  }
}
