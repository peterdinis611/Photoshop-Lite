import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { formatBytes, resizeImageSource } from './resizeImage';

describe('formatBytes', () => {
  it('formats B / KB / MB', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });
});

describe('resizeImageSource', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:resized'),
      revokeObjectURL: vi.fn(),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 2000;
      naturalHeight = 1000;
      width = 2000;
      height = 1000;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback
    ) {
      cb(new Blob([new Uint8Array(1200)], { type: 'image/jpeg' }));
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resizes to requested dimensions', async () => {
    const result = await resizeImageSource('blob:src', {
      width: 800,
      height: 400,
      format: 'image/jpeg',
      quality: 0.8,
    });
    expect(result.width).toBe(800);
    expect(result.height).toBe(400);
    expect(result.src).toBe('blob:resized');
    expect(result.bytesEstimate).toBeGreaterThan(0);
  });
});
