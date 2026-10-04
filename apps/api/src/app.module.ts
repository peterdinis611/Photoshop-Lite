import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';

@Module({
  imports: [HealthModule, AiModule, ProjectsModule, AssetsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
