/**
 * Cheap deep clone for history snapshots.
 * Prefer structuredClone; fall back to JSON for older environments.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // cyclic / non-cloneable — fall through
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Large immutable string fields — share refs across history snapshots to cut memory. */
const HISTORY_SHARED_STRING_KEYS = [
  'src',
  'originalSrc',
  'layerMaskSrc',
  'smartObjectSrc',
  'thumbnailSrc',
  'lottieJson',
  'json',
] as const;

/**
 * Clone a layer stack for undo history: structural deep clone, but reuse
 * unchanged image/data-URL string references so 40 snapshots don't multiply
 * multi-MB payloads.
 */
export function cloneLayersForHistory<T>(layers: T[]): T[] {
  const cloned = deepClone(layers);
  for (let i = 0; i < layers.length; i++) {
    const src = layers[i] as Record<string, unknown>;
    const dst = cloned[i] as Record<string, unknown>;
    if (!src || !dst) continue;
    for (const key of HISTORY_SHARED_STRING_KEYS) {
      const v = src[key];
      if (typeof v === 'string') dst[key] = v;
    }
  }
  return cloned;
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Debounce a function (leading edge optional). */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}
