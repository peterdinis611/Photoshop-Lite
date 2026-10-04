import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [HealthModule, AiModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
