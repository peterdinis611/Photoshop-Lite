import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProjectsService } from './projects.service';
import type {
  ProjectCreateDto,
  ProjectDetailDto,
  ProjectSummaryDto,
  ProjectVersionSummaryDto,
} from '@photoshop-lite/shared-types';
import { CacheControl } from '../common/cache-control';
import { ThrottlePresets } from '../common/throttle.config';

@Controller('projects')
@CacheControl('private, no-store')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Throttle(ThrottlePresets.read)
  list(): Promise<ProjectSummaryDto[]> {
    return this.projects.list();
  }

  @Post()
  @Throttle(ThrottlePresets.write)
  create(@Body() body: ProjectCreateDto): Promise<ProjectDetailDto> {
    return this.projects.create(body);
  }

  @Get(':id')
  @Throttle(ThrottlePresets.read)
  get(@Param('id') id: string): Promise<ProjectDetailDto> {
    return this.projects.get(id);
  }

  @Put(':id')
  @Throttle(ThrottlePresets.write)
  update(
    @Param('id') id: string,
    @Body() body: ProjectCreateDto
  ): Promise<ProjectDetailDto> {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  @Throttle(ThrottlePresets.write)
  remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.projects.remove(id);
  }

  @Get(':id/versions')
  @Throttle(ThrottlePresets.read)
  versions(@Param('id') id: string): Promise<ProjectVersionSummaryDto[]> {
    return this.projects.listVersions(id);
  }

  @Get(':id/versions/:versionId')
  @Throttle(ThrottlePresets.read)
  getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ): Promise<ProjectDetailDto> {
    return this.projects.getVersion(id, versionId);
  }

  @Post(':id/versions/:versionId/restore')
  @Throttle(ThrottlePresets.write)
  restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string
  ): Promise<ProjectDetailDto> {
    return this.projects.restoreVersion(id, versionId);
  }
}
