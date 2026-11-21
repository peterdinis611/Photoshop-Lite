import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { clearKonvaImageCache } from './imageCache';
import { useKonvaImage } from './useKonvaImage';

afterEach(() => {
  cleanup();
  clearKonvaImageCache();
  vi.unstubAllGlobals();
});

describe('useKonvaImage', () => {
  it('loads an image src', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 64;
      naturalHeight = 48;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const { result } = renderHook(() => useKonvaImage('blob:test'));
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(result.current.image).toBeTruthy();
    expect(result.current.width).toBe(64);
  });

  it('reuses warm cache on remount without a second Image()', async () => {
    let loads = 0;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 32;
      naturalHeight = 32;
      set src(_v: string) {
        loads += 1;
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const first = renderHook(() => useKonvaImage('blob:warm'));
    await waitFor(() => expect(first.result.current.status).toBe('loaded'));
    first.unmount();

    const second = renderHook(() => useKonvaImage('blob:warm'));
    expect(second.result.current.status).toBe('loaded');
    expect(second.result.current.image).toBeTruthy();
    expect(loads).toBe(1);
    second.unmount();
  });

  it('fails when src is empty', () => {
    const { result } = renderHook(() => useKonvaImage(null));
    expect(result.current.status).toBe('failed');
    expect(result.current.image).toBeNull();
  });
});
