import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { assetsRoot, projectsRoot } from './data-paths';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Soft caps so one browser/workspace cannot fill the disk under traffic. */
export function workspaceQuotaLimits() {
  return {
    maxProjects: envInt('WORKSPACE_MAX_PROJECTS', 50),
    maxAssets: envInt('WORKSPACE_MAX_ASSETS', 100),
    /** Total asset bytes on disk (default 200MB). */
    maxBytes: envInt('WORKSPACE_MAX_BYTES', 200 * 1024 * 1024),
  };
}

function quotaExceeded(message: string): never {
  throw new HttpException(
    { error: message, code: 'QUOTA_EXCEEDED' },
    HttpStatus.TOO_MANY_REQUESTS
  );
}

export function assertProjectQuota(): void {
  const { maxProjects } = workspaceQuotaLimits();
  const root = projectsRoot();
  if (!fs.existsSync(root)) return;
  const count = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  if (count >= maxProjects) {
    quotaExceeded(`Workspace project limit reached (${maxProjects})`);
  }
}

export function assertAssetQuota(incomingBytes: number): void {
  const { maxAssets, maxBytes } = workspaceQuotaLimits();
  const root = assetsRoot();
  const indexPath = path.join(root, 'index.json');
  let entries: Array<{ size?: number }> = [];
  if (fs.existsSync(indexPath)) {
    try {
      entries = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Array<{ size?: number }>;
    } catch {
      entries = [];
    }
  }
  if (entries.length >= maxAssets) {
    quotaExceeded(`Workspace asset limit reached (${maxAssets})`);
  }
  const used = entries.reduce((sum, e) => sum + (Number(e.size) || 0), 0);
  if (used + incomingBytes > maxBytes) {
    quotaExceeded(
      `Workspace storage limit reached (${Math.floor(maxBytes / (1024 * 1024))}MB)`
    );
  }
}
