import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearKonvaImageCache,
  KONVA_IMAGE_CACHE_MAX,
  konvaImageCacheSize,
  loadKonvaImage,
  peekKonvaImage,
  releaseKonvaImage,
} from './imageCache';

afterEach(() => {
  clearKonvaImageCache();
  vi.unstubAllGlobals();
});

describe('imageCache', () => {
  it('dedupes concurrent loads for the same src', async () => {
    let loads = 0;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      set src(_v: string) {
        loads += 1;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const a = loadKonvaImage('blob:same');
    const b = loadKonvaImage('blob:same');
    const [imgA, imgB] = await Promise.all([a, b]);

    expect(loads).toBe(1);
    expect(imgA).toBe(imgB);
    expect(peekKonvaImage('blob:same')).toBe(imgA);
    expect(konvaImageCacheSize()).toBe(1);
  });

  it('returns null and drops failed entries', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const img = await loadKonvaImage('blob:bad');
    expect(img).toBeNull();
    expect(peekKonvaImage('blob:bad')).toBeNull();
    expect(konvaImageCacheSize()).toBe(0);
  });

  it('LRU-evicts when over the soft cap', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    for (let i = 0; i < KONVA_IMAGE_CACHE_MAX + 5; i++) {
      await loadKonvaImage(`blob:n${i}`);
    }
    expect(konvaImageCacheSize()).toBeLessThanOrEqual(KONVA_IMAGE_CACHE_MAX);
    // Oldest should be gone; newest still warm
    expect(peekKonvaImage('blob:n0')).toBeNull();
    expect(peekKonvaImage(`blob:n${KONVA_IMAGE_CACHE_MAX + 4}`)).not.toBeNull();
  });

  it('releaseKonvaImage drops a single entry', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    await loadKonvaImage('blob:one');
    expect(konvaImageCacheSize()).toBe(1);
    releaseKonvaImage('blob:one');
    expect(konvaImageCacheSize()).toBe(0);
  });
});
