import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';
import { FontsModule } from './fonts/fonts.module';
import { StockModule } from './stock/stock.module';
import { CacheModule } from './cache/cache.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CacheControlInterceptor } from './common/cache-control';
import { buildThrottlerOptions } from './common/throttle.config';

@Module({
  imports: [
    ThrottlerModule.forRoot([...buildThrottlerOptions()]),
    CacheModule,
    WorkspaceModule,
    HealthModule,
    AiModule,
    ProjectsModule,
    AssetsModule,
    FontsModule,
    StockModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class AppModule {}
