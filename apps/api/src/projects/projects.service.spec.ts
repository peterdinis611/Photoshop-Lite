/**
 * ProjectsService CRUD against a temp DATA_DIR + workspace isolation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CacheService } from '../cache/cache.service';
import { runWithWorkspaceAsync } from '../common/workspace';

describe('ProjectsService', () => {
  let dataDir: string;
  let service: ProjectsService;
  let cache: CacheService;
  const prevDataDir = process.env.DATA_DIR;
  const WS_A = 'person_a_workspace_01';
  const WS_B = 'person_b_workspace_02';

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pslite-projects-'));
    process.env.DATA_DIR = dataDir;
    cache = new CacheService();
    service = new ProjectsService(cache);
  });

  afterEach(async () => {
    await cache.clear();
    await cache.onModuleDestroy();
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

  it('creates, lists, and gets a project inside a workspace', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      const created = await service.create(sample);
      expect(created.id).toBeTruthy();
      expect(created.title).toBe('Test Project');
      expect(created.versionCount).toBeGreaterThanOrEqual(1);

      const list = await service.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(created.id);

      const detail = await service.get(created.id);
      expect(detail.layers).toHaveLength(1);
      expect(detail.canvasWidth).toBe(800);
    });
  });

  it('updates and appends a version snapshot', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      const created = await service.create(sample);
      const beforeVersions = (await service.listVersions(created.id)).length;

      const updated = await service.update(created.id, {
        ...sample,
        title: 'Renamed',
        layers: [{ id: 'l2', type: 'text', name: 'Text' }],
      });

      expect(updated.title).toBe('Renamed');
      expect(updated.layers).toHaveLength(1);
      expect((await service.listVersions(created.id)).length).toBeGreaterThan(beforeVersions);
    });
  });

  it('deletes a project', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      const created = await service.create(sample);
      expect(await service.remove(created.id)).toEqual({ success: true });
      await expect(service.get(created.id)).rejects.toBeInstanceOf(NotFoundException);
      expect(await service.list()).toHaveLength(0);
    });
  });

  it('validates title and canvas size', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      await expect(
        service.create({ title: '', canvasWidth: 100, canvasHeight: 100, layers: [] })
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.create({ title: 'x', canvasWidth: 0, canvasHeight: 100, layers: [] })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('rejects duplicate ids within the same workspace', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      await service.create({ ...sample, id: 'fixed_id' });
      await expect(service.create({ ...sample, id: 'fixed_id' })).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });

  it('isolates person A from person B — same project id does not overwrite', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      await service.create({ ...sample, id: 'shared_slot', title: 'Alpha Draft' });
    });

    await runWithWorkspaceAsync(WS_B, async () => {
      // Same client-chosen id is fine — different workspace folder
      const b = await service.create({ ...sample, id: 'shared_slot', title: 'Bravo Draft' });
      expect(b.title).toBe('Bravo Draft');
      expect(await service.list()).toHaveLength(1);
      expect((await service.get('shared_slot')).title).toBe('Bravo Draft');
    });

    await runWithWorkspaceAsync(WS_A, async () => {
      const a = await service.get('shared_slot');
      expect(a.title).toBe('Alpha Draft');
      expect(await service.list()).toHaveLength(1);
    });

    // Physical isolation on disk
    expect(
      fs.existsSync(path.join(dataDir, 'workspaces', WS_A, 'projects', 'shared_slot', 'project.json'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(dataDir, 'workspaces', WS_B, 'projects', 'shared_slot', 'project.json'))
    ).toBe(true);
  });

  it('does not leak person B projects into person A list', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      await service.create({ ...sample, title: 'Only A' });
    });
    await runWithWorkspaceAsync(WS_B, async () => {
      await service.create({ ...sample, title: 'Only B' });
      await service.create({ ...sample, title: 'Also B' });
      expect(await service.list()).toHaveLength(2);
    });
    await runWithWorkspaceAsync(WS_A, async () => {
      const list = await service.list();
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Only A');
    });
  });

  it('caches list results until mutation', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      await service.create({ ...sample, title: 'Cached' });
      const first = await service.list();
      // Corrupt disk after cache fill — list should still return cache
      const root = path.join(dataDir, 'workspaces', WS_A, 'projects');
      for (const name of fs.readdirSync(root)) {
        fs.rmSync(path.join(root, name), { recursive: true, force: true });
      }
      const cached = await service.list();
      expect(cached).toEqual(first);

      // Mutation busts cache
      await service.create({ ...sample, title: 'After bust' });
      const next = await service.list();
      expect(next).toHaveLength(1);
      expect(next[0].title).toBe('After bust');
    });
  });
});
