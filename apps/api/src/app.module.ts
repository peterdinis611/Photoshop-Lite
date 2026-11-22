import './env';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';
import { FontsModule } from './fonts/fonts.module';
import { StockModule } from './stock/stock.module';
import { CacheModule } from './cache/cache.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { GeoModule } from './geo/geo.module';
import { PaletteModule } from './palette/palette.module';
import { CatalogModule } from './catalog/catalog.module';
import { CacheControlInterceptor } from './common/cache-control';
import { buildThrottlerModuleOptions } from './common/throttle.config';
import { WorkspaceThrottlerGuard } from './common/workspace-throttler.guard';
import { RedisModule } from './redis/redis.module';
import { REDIS_CLIENT, type RedisClient } from './redis/redis.client';

@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: RedisClient | null) => buildThrottlerModuleOptions(redis),
    }),
    CacheModule,
    WorkspaceModule,
    HealthModule,
    AiModule,
    ProjectsModule,
    AssetsModule,
    FontsModule,
    StockModule,
    GeoModule,
    PaletteModule,
    CatalogModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: WorkspaceThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class AppModule {}
