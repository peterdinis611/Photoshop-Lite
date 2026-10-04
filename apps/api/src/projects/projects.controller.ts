import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import {
  ProjectCreateDto,
  ProjectDetailDto,
  ProjectSummaryDto,
  ProjectVersionSummaryDto,
} from '@photoshop-lite/shared-types';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(): Promise<ProjectSummaryDto[]> {
    return this.projects.list();
  }

  @Post()
  create(@Body() body: ProjectCreateDto): Promise<ProjectDetailDto> {
    return this.projects.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ProjectDetailDto> {
    return this.projects.get(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: ProjectCreateDto
  ): Promise<ProjectDetailDto> {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.projects.remove(id);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string): Promise<ProjectVersionSummaryDto[]> {
    return this.projects.listVersions(id);
  }
}
