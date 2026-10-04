import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';
import { FontsModule } from './fonts/fonts.module';
import { CacheModule } from './cache/cache.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    CacheModule,
    WorkspaceModule,
    HealthModule,
    AiModule,
    ProjectsModule,
    AssetsModule,
    FontsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
