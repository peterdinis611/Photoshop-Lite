export type CachedImageStatus = 'loading' | 'loaded' | 'failed';

interface CachedImageEntry {
  image: HTMLImageElement | null;
  status: CachedImageStatus;
  promise: Promise<HTMLImageElement | null>;
  /** LRU touch — higher = more recent */
  lastUsed: number;
}

/** Soft cap on warm decoded images (not bytes — HTMLImageElement size is opaque). */
export const KONVA_IMAGE_CACHE_MAX = 48;

const cache = new Map<string, CachedImageEntry>();
let touchClock = 0;

function cacheKey(src: string, crossOrigin: string | null): string {
  return `${crossOrigin ?? 'null'}::${src}`;
}

function touch(entry: CachedImageEntry): void {
  entry.lastUsed = ++touchClock;
}

function evictIfNeeded(): void {
  while (cache.size > KONVA_IMAGE_CACHE_MAX) {
    let oldestKey: string | null = null;
    let oldestUsed = Infinity;
    for (const [key, entry] of cache) {
      // Never evict in-flight loads — wait until they settle
      if (entry.status === 'loading') continue;
      if (entry.lastUsed < oldestUsed) {
        oldestUsed = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

/**
 * Shared HTMLImageElement loader. Dedupes concurrent loads and keeps decoded
 * images warm across layer remounts / Before-After / export helpers.
 * LRU-evicts when the cache exceeds {@link KONVA_IMAGE_CACHE_MAX}.
 */
export function loadKonvaImage(
  src: string,
  crossOrigin: string | null = 'anonymous'
): Promise<HTMLImageElement | null> {
  const key = cacheKey(src, crossOrigin);
  const existing = cache.get(key);
  if (existing) {
    if (existing.status !== 'failed') {
      touch(existing);
      return existing.promise;
    }
    cache.delete(key);
  }

  let resolve!: (img: HTMLImageElement | null) => void;
  const promise = new Promise<HTMLImageElement | null>((r) => {
    resolve = r;
  });

  const entry: CachedImageEntry = {
    image: null,
    status: 'loading',
    promise,
    lastUsed: ++touchClock,
  };
  cache.set(key, entry);
  evictIfNeeded();

  const img = new window.Image();
  if (crossOrigin) img.crossOrigin = crossOrigin;

  img.onload = () => {
    entry.image = img;
    entry.status = 'loaded';
    touch(entry);
    resolve(img);
    evictIfNeeded();
  };
  img.onerror = () => {
    entry.image = null;
    entry.status = 'failed';
    resolve(null);
    cache.delete(key);
  };
  img.src = src;

  return promise;
}

/** Peek a warm decoded image without loading (sync). */
export function peekKonvaImage(
  src: string | null | undefined,
  crossOrigin: string | null = 'anonymous'
): HTMLImageElement | null {
  if (!src) return null;
  const entry = cache.get(cacheKey(src, crossOrigin));
  if (!entry?.image) return null;
  touch(entry);
  return entry.image;
}

/** Drop one src (or no-op if missing). */
export function releaseKonvaImage(
  src?: string | null,
  crossOrigin: string | null = 'anonymous'
): void {
  if (!src) return;
  cache.delete(cacheKey(src, crossOrigin));
}

/** Test / project-switch helper. */
export function clearKonvaImageCache(): void {
  cache.clear();
  touchClock = 0;
}

export function konvaImageCacheSize(): number {
  return cache.size;
}
