export type CachedImageStatus = 'loading' | 'loaded' | 'failed';

interface CachedImageEntry {
  image: HTMLImageElement | null;
  status: CachedImageStatus;
  promise: Promise<HTMLImageElement | null>;
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
    // Allow retry after a failed load
    if (existing.status !== 'failed') return existing.promise;
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
  return cache.get(cacheKey(src, crossOrigin))?.image ?? null;
}

/** @deprecated Kept for API stability — cache is process-warm; no-op. */
export function releaseKonvaImage(
  _src?: string | null,
  _crossOrigin?: string | null
): void {
  /* intentional no-op: decoded images stay warm for the session */
}

/** Test / project-switch helper. */
export function clearKonvaImageCache(): void {
  cache.clear();
}

export function konvaImageCacheSize(): number {
  return cache.size;
}
