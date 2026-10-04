import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectCreateDto,
  ProjectDetailDto,
  ProjectSummaryDto,
  ProjectVersionSummaryDto,
} from '@photoshop-lite/shared-types';
import { ensureDir, newId, projectsRoot } from '../common/data-paths';

interface StoredProject {
  id: string;
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  layers: unknown[];
  createdAt: string;
  updatedAt: string;
  savedAt: string;
}

@Injectable()
export class ProjectsService {
  private projectDir(id: string): string {
    return path.join(projectsRoot(), id);
  }

  private projectFile(id: string): string {
    return path.join(this.projectDir(id), 'project.json');
  }

  private versionsDir(id: string): string {
    return path.join(this.projectDir(id), 'versions');
  }

  private readProject(id: string): StoredProject {
    const file = this.projectFile(id);
    if (!fs.existsSync(file)) {
      throw new NotFoundException({ error: `Project ${id} not found`, code: 'NOT_FOUND' });
    }
    return JSON.parse(fs.readFileSync(file, 'utf8')) as StoredProject;
  }

  private writeProject(project: StoredProject): void {
    const dir = this.projectDir(project.id);
    ensureDir(dir);
    ensureDir(this.versionsDir(project.id));
    fs.writeFileSync(this.projectFile(project.id), JSON.stringify(project, null, 2), 'utf8');
  }

  private toSummary(p: StoredProject): ProjectSummaryDto {
    const versionsPath = this.versionsDir(p.id);
    let versionCount = 0;
    if (fs.existsSync(versionsPath)) {
      versionCount = fs.readdirSync(versionsPath).filter((f) => f.endsWith('.json')).length;
    }
    return {
      id: p.id,
      title: p.title,
      canvasWidth: p.canvasWidth,
      canvasHeight: p.canvasHeight,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      versionCount,
    };
  }

  private toDetail(p: StoredProject): ProjectDetailDto {
    return {
      ...this.toSummary(p),
      backgroundColor: p.backgroundColor,
      layers: p.layers,
      savedAt: p.savedAt,
    };
  }

  list(): ProjectSummaryDto[] {
    const root = projectsRoot();
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        try {
          return this.toSummary(this.readProject(d.name));
        } catch {
          return null;
        }
      })
      .filter((p): p is ProjectSummaryDto => Boolean(p))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): ProjectDetailDto {
    return this.toDetail(this.readProject(id));
  }

  create(dto: ProjectCreateDto): ProjectDetailDto {
    if (!dto.title?.trim()) {
      throw new BadRequestException({ error: 'title is required', code: 'VALIDATION' });
    }
    if (!dto.canvasWidth || !dto.canvasHeight) {
      throw new BadRequestException({
        error: 'canvasWidth and canvasHeight are required',
        code: 'VALIDATION',
      });
    }

    const now = new Date().toISOString();
    const id = dto.id?.trim() || newId('proj');
    if (fs.existsSync(this.projectFile(id))) {
      throw new BadRequestException({
        error: `Project id ${id} already exists`,
        code: 'VALIDATION',
      });
    }

    const project: StoredProject = {
      id,
      title: dto.title.trim(),
      canvasWidth: dto.canvasWidth,
      canvasHeight: dto.canvasHeight,
      backgroundColor: dto.backgroundColor || '#1a1b20',
      layers: Array.isArray(dto.layers) ? dto.layers : [],
      createdAt: now,
      updatedAt: now,
      savedAt: now,
    };

    this.writeProject(project);
    this.snapshot(project, 'create');
    return this.toDetail(project);
  }

  update(id: string, dto: ProjectCreateDto): ProjectDetailDto {
    const existing = this.readProject(id);
    const now = new Date().toISOString();

    const project: StoredProject = {
      ...existing,
      title: dto.title?.trim() || existing.title,
      canvasWidth: dto.canvasWidth || existing.canvasWidth,
      canvasHeight: dto.canvasHeight || existing.canvasHeight,
      backgroundColor: dto.backgroundColor || existing.backgroundColor,
      layers: Array.isArray(dto.layers) ? dto.layers : existing.layers,
      updatedAt: now,
      savedAt: now,
    };

    this.snapshot(existing, 'before-update');
    this.writeProject(project);
    return this.toDetail(project);
  }

  remove(id: string): { success: boolean } {
    const dir = this.projectDir(id);
    if (!fs.existsSync(dir)) {
      throw new NotFoundException({ error: `Project ${id} not found`, code: 'NOT_FOUND' });
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return { success: true };
  }

  listVersions(id: string): ProjectVersionSummaryDto[] {
    this.readProject(id);
    const dir = this.versionsDir(id);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as StoredProject & {
          versionId?: string;
        };
        return {
          id: f.replace(/\.json$/, ''),
          savedAt: raw.savedAt || raw.updatedAt,
          title: raw.title,
        };
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  private snapshot(project: StoredProject, reason: string): void {
    const dir = this.versionsDir(project.id);
    ensureDir(dir);
    const versionId = `${Date.now()}_${reason}`;
    fs.writeFileSync(
      path.join(dir, `${versionId}.json`),
      JSON.stringify({ ...project, versionId, reason }, null, 2),
      'utf8'
    );

    // Keep last 40 versions
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    for (const old of files.slice(40)) {
      fs.unlinkSync(path.join(dir, old));
    }
  }
}
