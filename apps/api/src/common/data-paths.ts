import * as fs from 'fs';
import * as path from 'path';
import { requireWorkspaceId } from './workspace';

export function getDataRoot(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  return path.resolve(process.cwd(), 'apps/api/data');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/** Per-workspace root: data/workspaces/{workspaceId}/… */
export function workspaceRoot(workspaceId?: string): string {
  const id = workspaceId ?? requireWorkspaceId();
  const dir = path.join(getDataRoot(), 'workspaces', id);
  ensureDir(dir);
  return dir;
}

export function projectsRoot(workspaceId?: string): string {
  const dir = path.join(workspaceRoot(workspaceId), 'projects');
  ensureDir(dir);
  return dir;
}

export function assetsRoot(workspaceId?: string): string {
  const dir = path.join(workspaceRoot(workspaceId), 'assets');
  ensureDir(dir);
  return dir;
}

export function newId(prefix = ''): string {
  const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${id}` : id;
}
