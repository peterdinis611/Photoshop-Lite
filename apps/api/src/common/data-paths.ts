import * as fs from 'fs';
import * as path from 'path';

export function getDataRoot(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  return path.resolve(process.cwd(), 'apps/api/data');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function projectsRoot(): string {
  const dir = path.join(getDataRoot(), 'projects');
  ensureDir(dir);
  return dir;
}

export function assetsRoot(): string {
  const dir = path.join(getDataRoot(), 'assets');
  ensureDir(dir);
  return dir;
}

export function newId(prefix = ''): string {
  const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${id}` : id;
}
