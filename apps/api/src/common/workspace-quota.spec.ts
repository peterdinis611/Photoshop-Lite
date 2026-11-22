import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HttpException } from '@nestjs/common';
import { assertAssetQuota, assertProjectQuota } from './workspace-quota';
import { runWithWorkspace } from './workspace';

describe('workspace-quota', () => {
  let dataDir: string;
  const prev = {
    DATA_DIR: process.env.DATA_DIR,
    WORKSPACE_MAX_PROJECTS: process.env.WORKSPACE_MAX_PROJECTS,
    WORKSPACE_MAX_ASSETS: process.env.WORKSPACE_MAX_ASSETS,
    WORKSPACE_MAX_BYTES: process.env.WORKSPACE_MAX_BYTES,
  };

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pslite-quota-'));
    process.env.DATA_DIR = dataDir;
    process.env.WORKSPACE_MAX_PROJECTS = '2';
    process.env.WORKSPACE_MAX_ASSETS = '2';
    process.env.WORKSPACE_MAX_BYTES = '1000';
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('blocks project create past WORKSPACE_MAX_PROJECTS', () => {
    runWithWorkspace('quota_ws_projects', () => {
      const root = path.join(dataDir, 'workspaces', 'quota_ws_projects', 'projects');
      fs.mkdirSync(path.join(root, 'p1'), { recursive: true });
      fs.mkdirSync(path.join(root, 'p2'), { recursive: true });
      expect(() => assertProjectQuota()).toThrow(HttpException);
    });
  });

  it('blocks asset upload past byte quota', () => {
    runWithWorkspace('quota_ws_assets', () => {
      const root = path.join(dataDir, 'workspaces', 'quota_ws_assets', 'assets');
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(
        path.join(root, 'index.json'),
        JSON.stringify([{ id: 'a1', size: 900 }]),
        'utf8'
      );
      expect(() => assertAssetQuota(200)).toThrow(HttpException);
    });
  });
});
