export type CachedImageStatus = 'loading' | 'loaded' | 'failed';

export interface CachedImageEntry {
  image: HTMLImageElement | null;
  status: CachedImageStatus;
  promise: Promise<HTMLImageElement | null>;
  refs: number;
}

const cache = new Map<string, CachedImageEntry>();

function cacheKey(src: string, crossOrigin: string | null): string {
  return `${crossOrigin ?? 'null'}::${src}`;
}

/**
 * Shared HTMLImageElement loader. Dedupes concurrent loads and keeps decoded
 * images warm across layer remounts / Before-After / export helpers.
 */
export function loadKonvaImage(
  src: string,
  crossOrigin: string | null = 'anonymous'
): Promise<HTMLImageElement | null> {
  const key = cacheKey(src, crossOrigin);
  const existing = cache.get(key);
  if (existing) {
    existing.refs += 1;
    return existing.promise;
  }

  let resolve!: (img: HTMLImageElement | null) => void;
  const promise = new Promise<HTMLImageElement | null>((r) => {
    resolve = r;
  });

  const entry: CachedImageEntry = {
    image: null,
    status: 'loading',
    promise,
    refs: 1,
  };
  cache.set(key, entry);

  const img = new window.Image();
  if (crossOrigin) img.crossOrigin = crossOrigin;

  img.onload = () => {
    entry.image = img;
    entry.status = 'loaded';
    resolve(img);
  };
  img.onerror = () => {
    entry.image = null;
    entry.status = 'failed';
    resolve(null);
    // Don't keep failed entries forever — allow retry on next request
    if (entry.refs <= 0) cache.delete(key);
  };
  img.src = src;

  return promise;
}

/** Peek a warm decoded image without bumping refs (sync). */
export function peekKonvaImage(
  src: string | null | undefined,
  crossOrigin: string | null = 'anonymous'
): HTMLImageElement | null {
  if (!src) return null;
  return cache.get(cacheKey(src, crossOrigin))?.image ?? null;
}

/** Release one consumer; entry stays warm until purged or failed. */
export function releaseKonvaImage(
  src: string | null | undefined,
  crossOrigin: string | null = 'anonymous'
): void {
  if (!src) return;
  const key = cacheKey(src, crossOrigin);
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
}

/** Test / memory pressure helper. */
export function clearKonvaImageCache(): void {
  cache.clear();
}

export function konvaImageCacheSize(): number {
  return cache.size;
}
