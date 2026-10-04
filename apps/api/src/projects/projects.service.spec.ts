/**
 * ProjectsService CRUD against a temp DATA_DIR.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let dataDir: string;
  let service: ProjectsService;
  const prevDataDir = process.env.DATA_DIR;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pslite-projects-'));
    process.env.DATA_DIR = dataDir;
    service = new ProjectsService();
  });

  afterEach(() => {
    if (prevDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const sample = {
    title: 'Test Project',
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#111111',
    layers: [{ id: 'l1', type: 'image', name: 'Layer 1' }],
  };

  it('creates, lists, and gets a project', () => {
    const created = service.create(sample);
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Test Project');
    expect(created.versionCount).toBeGreaterThanOrEqual(1);

    const list = service.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);

    const detail = service.get(created.id);
    expect(detail.layers).toHaveLength(1);
    expect(detail.canvasWidth).toBe(800);
  });

  it('updates and appends a version snapshot', () => {
    const created = service.create(sample);
    const beforeVersions = service.listVersions(created.id).length;

    const updated = service.update(created.id, {
      ...sample,
      title: 'Renamed',
      layers: [{ id: 'l2', type: 'text', name: 'Text' }],
    });

    expect(updated.title).toBe('Renamed');
    expect(updated.layers).toHaveLength(1);
    expect(service.listVersions(created.id).length).toBeGreaterThan(beforeVersions);
  });

  it('deletes a project', () => {
    const created = service.create(sample);
    expect(service.remove(created.id)).toEqual({ success: true });
    expect(() => service.get(created.id)).toThrow(NotFoundException);
    expect(service.list()).toHaveLength(0);
  });

  it('validates title and canvas size', () => {
    expect(() =>
      service.create({ title: '', canvasWidth: 100, canvasHeight: 100, layers: [] })
    ).toThrow(BadRequestException);

    expect(() =>
      service.create({ title: 'x', canvasWidth: 0, canvasHeight: 100, layers: [] })
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate ids', () => {
    service.create({ ...sample, id: 'fixed_id' });
    expect(() => service.create({ ...sample, id: 'fixed_id' })).toThrow(BadRequestException);
  });
});
