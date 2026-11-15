import { Module } from '@nestjs/common';
import { PaletteController } from './palette.controller';
import { PaletteService } from './palette.service';

@Module({
  controllers: [PaletteController],
  providers: [PaletteService],
})
export class PaletteModule {}
