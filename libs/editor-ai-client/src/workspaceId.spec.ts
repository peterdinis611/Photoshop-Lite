import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_STORAGE_KEY,
  createWorkspaceId,
  getOrCreateWorkspaceId,
} from './workspaceId';

describe('workspaceId', () => {
  it('creates ids long enough for the API', () => {
    const id = createWorkspaceId();
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it('persists and reuses workspace id in storage', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };

    const a = getOrCreateWorkspaceId(storage);
    const b = getOrCreateWorkspaceId(storage);
    expect(a).toBe(b);
    expect(mem.get(WORKSPACE_STORAGE_KEY)).toBe(a);
  });

  it('replaces too-short stored ids', () => {
    const mem = new Map<string, string>([[WORKSPACE_STORAGE_KEY, 'short']]);
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    const id = getOrCreateWorkspaceId(storage);
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id).not.toBe('short');
  });
});
