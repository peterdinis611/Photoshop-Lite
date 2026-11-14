import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useKonvaImage } from './useKonvaImage';

afterEach(() => cleanup());

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

    vi.unstubAllGlobals();
  });

  it('fails when src is empty', () => {
    const { result } = renderHook(() => useKonvaImage(null));
    expect(result.current.status).toBe('failed');
    expect(result.current.image).toBeNull();
  });
});
