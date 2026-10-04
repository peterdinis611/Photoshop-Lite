import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { workspaceMiddleware } from '../common/workspace';
import { ProjectsController } from '../projects/projects.controller';
import { AssetsController } from '../assets/assets.controller';

/**
 * Applies X-Workspace-Id scoping to projects & assets so person A
 * never reads/writes person B's records.
 */
@Module({})
export class WorkspaceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(workspaceMiddleware).forRoutes(ProjectsController, AssetsController);
  }
}
