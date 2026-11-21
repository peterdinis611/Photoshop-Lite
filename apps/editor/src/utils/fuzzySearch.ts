import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * Fast Fuse defaults for interactive typeahead:
 * - ignoreLocation: match anywhere without location penalty work
 * - moderate threshold: prune weak candidates early
 * - no extended/token search: keeps Bitap single-pass
 * - prebuilt index via Fuse.createIndex
 */
export const FAST_FUSE_OPTIONS = {
  includeScore: false,
  ignoreLocation: true,
  threshold: 0.34,
  distance: 64,
  minMatchCharLength: 1,
  findAllMatches: false,
  shouldSort: true,
  isCaseSensitive: false,
  useExtendedSearch: false,
} as const satisfies IFuseOptions<unknown>;

export function createFastFuse<T>(
  list: readonly T[],
  keys: Array<keyof T & string> | Array<{ name: keyof T & string; weight: number }>,
  overrides?: IFuseOptions<T>
): Fuse<T> {
  const options: IFuseOptions<T> = {
    ...FAST_FUSE_OPTIONS,
    keys: keys as IFuseOptions<T>['keys'],
    ...overrides,
  };
  const keyNames = (keys as Array<string | { name: string }>).map((k) =>
    typeof k === 'string' ? k : k.name
  );
  const index = Fuse.createIndex(keyNames, list as T[]);
  return new Fuse(list as T[], options, index);
}

/** Search with a hard limit — avoids sorting the entire hit set when we only show a page. */
export function fuseSearch<T>(fuse: Fuse<T>, query: string, limit = 80): T[] {
  const q = query.trim();
  if (!q) return [];
  return fuse.search(q, { limit }).map((hit) => hit.item);
}
