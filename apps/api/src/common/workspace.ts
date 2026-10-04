import { AsyncLocalStorage } from 'node:async_hooks';
import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const WORKSPACE_HEADER = 'x-workspace-id';

/** Stable browser / device workspace id (UUID or similar). */
const WORKSPACE_RE = /^[a-zA-Z0-9_-]{8,80}$/;

type WorkspaceStore = { workspaceId: string };

export const workspaceAls = new AsyncLocalStorage<WorkspaceStore>();

export function normalizeWorkspaceId(raw: string | undefined | null): string {
  const id = (raw || '').trim();
  if (!WORKSPACE_RE.test(id)) {
    throw new BadRequestException({
      error: `Valid ${WORKSPACE_HEADER} header required (8–80 chars: letters, numbers, _-)`,
      code: 'VALIDATION',
    });
  }
  return id;
}

export function requireWorkspaceId(): string {
  const id = workspaceAls.getStore()?.workspaceId;
  if (!id) {
    throw new BadRequestException({
      error: `Missing workspace context — send ${WORKSPACE_HEADER}`,
      code: 'VALIDATION',
    });
  }
  return id;
}

export function runWithWorkspace<T>(workspaceId: string, fn: () => T): T {
  return workspaceAls.run({ workspaceId: normalizeWorkspaceId(workspaceId) }, fn);
}

export async function runWithWorkspaceAsync<T>(
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> {
  return workspaceAls.run({ workspaceId: normalizeWorkspaceId(workspaceId) }, fn);
}

/** Express/Nest middleware — scopes the request to a workspace. */
export function workspaceMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header =
      (req.header(WORKSPACE_HEADER) as string | undefined) ||
      (req.header('X-Workspace-Id') as string | undefined);
    const workspaceId = normalizeWorkspaceId(header);
    workspaceAls.run({ workspaceId }, () => next());
  } catch (err) {
    next(err);
  }
}
