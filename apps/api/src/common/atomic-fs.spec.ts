import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeFileAtomic, writeJsonAtomic } from './atomic-fs';

describe('atomic-fs', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pslite-atomic-'));
    dirs.push(d);
    return d;
  }

  it('writeFileAtomic replaces the target and leaves no .tmp behind', () => {
    const dir = tmp();
    const file = path.join(dir, 'blob.bin');
    writeFileAtomic(file, Buffer.from('hello'));
    expect(fs.readFileSync(file, 'utf8')).toBe('hello');
    writeFileAtomic(file, Buffer.from('world'));
    expect(fs.readFileSync(file, 'utf8')).toBe('world');
    const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toHaveLength(0);
  });

  it('writeJsonAtomic round-trips objects', () => {
    const dir = tmp();
    const file = path.join(dir, 'nested', 'data.json');
    writeJsonAtomic(file, { a: 1, b: ['x'] });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ a: 1, b: ['x'] });
  });
});
