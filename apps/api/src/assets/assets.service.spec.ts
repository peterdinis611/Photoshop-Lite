/**
 * AssetsService upload / list / remove with workspace isolation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CacheService } from '../cache/cache.service';
import { runWithWorkspaceAsync } from '../common/workspace';

/** 1×1 PNG */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('AssetsService', () => {
  let dataDir: string;
  let service: AssetsService;
  let cache: CacheService;
  const prevDataDir = process.env.DATA_DIR;
  const WS_A = 'assets_ws_alpha01';
  const WS_B = 'assets_ws_bravo02';

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pslite-assets-'));
    process.env.DATA_DIR = dataDir;
    cache = new CacheService();
    service = new AssetsService(cache);
  });

  afterEach(async () => {
    await cache.clear();
    await cache.onModuleDestroy();
    if (prevDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('uploads and lists assets inside a workspace', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      const created = await service.upload({
        dataBase64: TINY_PNG,
        fileName: 'dot.png',
        mimeType: 'image/png',
      });
      expect(created.id).toMatch(/^asset_/);
      expect(created.fileName).toBe('dot.png');
      expect(created.size).toBeGreaterThan(0);
      expect(created.url).toBe(`/api/assets/${created.id}`);

      const list = await service.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(created.id);
    });
  });

  it('rejects empty / svg payloads', async () => {
    await runWithWorkspaceAsync(WS_A, async () => {
      await expect(
        service.upload({ dataBase64: '', fileName: 'x.png', mimeType: 'image/png' })
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.upload({
          dataBase64: 'data:image/svg+xml;base64,PHN2Zy4uLj4=',
          fileName: 'x.svg',
          mimeType: 'image/svg+xml',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('isolates list/get/remove across workspaces', async () => {
    let assetId = '';
    await runWithWorkspaceAsync(WS_A, async () => {
      const created = await service.upload({
        dataBase64: TINY_PNG,
        fileName: 'secret.png',
        mimeType: 'image/png',
      });
      assetId = created.id;
      expect(await service.list()).toHaveLength(1);
    });

    await runWithWorkspaceAsync(WS_B, async () => {
      expect(await service.list()).toHaveLength(0);
      expect(() => service.getFile(assetId)).toThrow(NotFoundException);
      await expect(service.remove(assetId)).rejects.toBeInstanceOf(NotFoundException);
    });

    await runWithWorkspaceAsync(WS_A, async () => {
      // Prefer remove over getFile — StreamableFile keeps an async FD open past afterEach cleanup
      expect((await service.list())[0]?.fileName).toBe('secret.png');
      expect(await service.remove(assetId)).toEqual({ success: true });
      expect(await service.list()).toHaveLength(0);
    });
  });
});
