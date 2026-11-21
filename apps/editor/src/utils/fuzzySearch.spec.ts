import { describe, expect, it } from 'vitest';
import { createFastFuse, FAST_FUSE_OPTIONS, fuseSearch } from './fuzzySearch';

type Item = { title: string; author: string; tags: string };

describe('fuzzySearch', () => {
  const list: Item[] = [
    { title: 'Portrait studio light', author: 'Ada', tags: 'people face' },
    { title: 'Mountain landscape', author: 'Bo', tags: 'nature outdoor' },
    { title: 'City night neon', author: 'Cy', tags: 'urban abstract' },
    { title: 'Product packshot', author: 'Di', tags: 'commerce' },
  ];

  it('uses fast defaults (no extended / location-heavy search)', () => {
    expect(FAST_FUSE_OPTIONS.ignoreLocation).toBe(true);
    expect(FAST_FUSE_OPTIONS.useExtendedSearch).toBe(false);
    expect(FAST_FUSE_OPTIONS.threshold).toBeLessThan(0.5);
  });

  it('indexes once and matches with typos', () => {
    const fuse = createFastFuse(list, ['title', 'author', 'tags']);
    const hits = fuseSearch(fuse, 'portrat', 10);
    expect(hits[0]?.title).toMatch(/Portrait/i);
  });

  it('weights keys so title beats weak author matches', () => {
    const fuse = createFastFuse(list, [
      { name: 'title', weight: 0.9 },
      { name: 'author', weight: 0.1 },
    ]);
    const hits = fuseSearch(fuse, 'city', 5);
    expect(hits[0]?.title).toMatch(/City/i);
  });

  it('respects limit for speed', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      title: `Nature plate ${i}`,
      author: 'x',
      tags: 'nature',
    }));
    const fuse = createFastFuse(many, ['title', 'tags']);
    expect(fuseSearch(fuse, 'nature', 12)).toHaveLength(12);
  });

  it('returns empty for blank query', () => {
    const fuse = createFastFuse(list, ['title']);
    expect(fuseSearch(fuse, '   ')).toEqual([]);
  });

  it('matches mid-string tags with ignoreLocation', () => {
    const fuse = createFastFuse(list, ['tags']);
    const hits = fuseSearch(fuse, 'outdoor', 5);
    expect(hits.some((h) => h.title.includes('Mountain'))).toBe(true);
  });
});
