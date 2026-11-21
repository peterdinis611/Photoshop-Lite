import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearKonvaImageCache,
  konvaImageCacheSize,
  loadKonvaImage,
  peekKonvaImage,
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
});
