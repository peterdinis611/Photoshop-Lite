import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  normalizeWorkspaceId,
  requireWorkspaceId,
  runWithWorkspace,
  runWithWorkspaceAsync,
  WORKSPACE_HEADER,
} from './workspace';

describe('workspace', () => {
  it('exposes the expected header name', () => {
    expect(WORKSPACE_HEADER).toBe('x-workspace-id');
  });

  it('accepts valid workspace ids', () => {
    expect(normalizeWorkspaceId('workspace_01')).toBe('workspace_01');
    expect(normalizeWorkspaceId('  abcdefgh  ')).toBe('abcdefgh');
  });

  it('rejects short or illegal ids', () => {
    expect(() => normalizeWorkspaceId('short')).toThrow(BadRequestException);
    expect(() => normalizeWorkspaceId('bad id!!')).toThrow(BadRequestException);
    expect(() => normalizeWorkspaceId('')).toThrow(BadRequestException);
    expect(() => normalizeWorkspaceId(null)).toThrow(BadRequestException);
  });

  it('requireWorkspaceId fails outside ALS context', () => {
    expect(() => requireWorkspaceId()).toThrow(BadRequestException);
  });

  it('runWithWorkspace scopes requireWorkspaceId', () => {
    const id = runWithWorkspace('person_a_workspace', () => requireWorkspaceId());
    expect(id).toBe('person_a_workspace');
  });

  it('runWithWorkspaceAsync nests independently', async () => {
    const a = await runWithWorkspaceAsync('workspace_aaa', async () => requireWorkspaceId());
    const b = await runWithWorkspaceAsync('workspace_bbb', async () => requireWorkspaceId());
    expect(a).toBe('workspace_aaa');
    expect(b).toBe('workspace_bbb');
  });
});
