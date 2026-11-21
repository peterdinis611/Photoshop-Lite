import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/** Project / asset / version ids — no path separators or traversal. */
const SAFE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export function assertSafeId(id: string, label = 'id'): string {
  const trimmed = (id || '').trim();
  if (!SAFE_ID_RE.test(trimmed) || trimmed.includes('..')) {
    throw new BadRequestException({
      error: `Invalid ${label}`,
      code: 'VALIDATION',
    });
  }
  return trimmed;
}

/** Resolve a path under root; throw if it escapes. */
export function resolveUnderRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new BadRequestException({
      error: 'Path escapes storage root',
      code: 'VALIDATION',
    });
  }
  return resolved;
}

export function assertPathExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new BadRequestException({ error: 'Path not found', code: 'NOT_FOUND' });
  }
}
