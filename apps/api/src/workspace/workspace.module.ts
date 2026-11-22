import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { optionalWorkspaceMiddleware, workspaceMiddleware } from '../common/workspace';
import { ProjectsController } from '../projects/projects.controller';
import { AssetsController } from '../assets/assets.controller';

/**
 * Applies X-Workspace-Id scoping to projects & assets so person A
 * never reads/writes person B's records. Soft-binds the header on
 * other routes so rate limits can key by workspace under traffic.
 */
@Module({})
export class WorkspaceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(workspaceMiddleware).forRoutes(ProjectsController, AssetsController);
    // Soft bind on all routes (including AI) when the header is present
    consumer.apply(optionalWorkspaceMiddleware).forRoutes('*');
  }
}
