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
  list(): ProjectSummaryDto[] {
    return this.projects.list();
  }

  @Post()
  create(@Body() body: ProjectCreateDto): ProjectDetailDto {
    return this.projects.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): ProjectDetailDto {
    return this.projects.get(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: ProjectCreateDto): ProjectDetailDto {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string): { success: boolean } {
    return this.projects.remove(id);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string): ProjectVersionSummaryDto[] {
    return this.projects.listVersions(id);
  }
}
