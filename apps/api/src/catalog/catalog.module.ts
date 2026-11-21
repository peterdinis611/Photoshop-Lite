import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [StockModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
