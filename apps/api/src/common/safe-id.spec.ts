import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertSafeId, resolveUnderRoot } from './safe-id';
import * as path from 'path';
import * as os from 'os';

describe('assertSafeId', () => {
  it('accepts alphanumeric ids with dots/dashes/underscores', () => {
    expect(assertSafeId('proj_01')).toBe('proj_01');
    expect(assertSafeId('a.b-c_1')).toBe('a.b-c_1');
  });

  it('rejects path traversal and separators', () => {
    expect(() => assertSafeId('../etc')).toThrow(BadRequestException);
    expect(() => assertSafeId('a/b')).toThrow(BadRequestException);
    expect(() => assertSafeId('..')).toThrow(BadRequestException);
    expect(() => assertSafeId('')).toThrow(BadRequestException);
  });
});

describe('resolveUnderRoot', () => {
  it('resolves children under root', () => {
    const root = path.join(os.tmpdir(), 'psl-safe-root');
    const resolved = resolveUnderRoot(root, 'assets', 'x.png');
    expect(resolved.startsWith(path.resolve(root) + path.sep)).toBe(true);
  });

  it('blocks escaping the storage root', () => {
    const root = path.join(os.tmpdir(), 'psl-safe-root');
    expect(() => resolveUnderRoot(root, '..', 'outside')).toThrow(BadRequestException);
  });
});
