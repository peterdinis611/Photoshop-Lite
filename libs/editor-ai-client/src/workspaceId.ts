export const WORKSPACE_STORAGE_KEY = 'px_workspace_id';
export const WORKSPACE_HEADER = 'X-Workspace-Id';

/** Create a stable per-browser workspace id (person A ≠ person B). */
export function createWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateWorkspaceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage !== 'undefined'
    ? localStorage
    : null
): string {
  if (!storage) return createWorkspaceId();
  try {
    const existing = storage.getItem(WORKSPACE_STORAGE_KEY)?.trim();
    if (existing && existing.length >= 8) return existing;
    const next = createWorkspaceId();
    storage.setItem(WORKSPACE_STORAGE_KEY, next);
    return next;
  } catch {
    return createWorkspaceId();
  }
}
