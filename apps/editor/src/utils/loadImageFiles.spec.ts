import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectImageFiles,
  computeImageScale,
  dragEventHasFiles,
  isImageFile,
  loadImageFile,
  loadImageFiles,
  MAX_IMAGE_EDGE,
} from './loadImageFiles';

function makeFile(name: string, type: string, content = 'fake'): File {
  return new File([content], name, { type });
}

describe('isImageFile', () => {
  it('accepts image MIME types', () => {
    expect(isImageFile(makeFile('x.bin', 'image/png'))).toBe(true);
    expect(isImageFile(makeFile('x.bin', 'image/jpeg'))).toBe(true);
  });

  it('accepts common extensions when MIME is empty', () => {
    expect(isImageFile(makeFile('photo.WEBP', ''))).toBe(true);
    expect(isImageFile(makeFile('shot.heic', ''))).toBe(true);
    expect(isImageFile(makeFile('scan.tiff', ''))).toBe(true);
  });

  it('rejects non-images', () => {
    expect(isImageFile(makeFile('notes.txt', 'text/plain'))).toBe(false);
    expect(isImageFile(makeFile('archive.zip', ''))).toBe(false);
  });
});

describe('collectImageFiles', () => {
  it('returns empty for nullish input', () => {
    expect(collectImageFiles(null)).toEqual([]);
    expect(collectImageFiles(undefined)).toEqual([]);
  });

  it('filters mixed file lists', () => {
    const files = [
      makeFile('a.png', 'image/png'),
      makeFile('b.txt', 'text/plain'),
      makeFile('c.jpg', 'image/jpeg'),
    ];
    expect(collectImageFiles(files).map((f) => f.name)).toEqual(['a.png', 'c.jpg']);
  });
});

describe('dragEventHasFiles', () => {
  it('detects Files type', () => {
    expect(
      dragEventHasFiles({
        dataTransfer: { types: ['Files'] } as unknown as DataTransfer,
      })
    ).toBe(true);
  });

  it('returns false without Files', () => {
    expect(dragEventHasFiles({ dataTransfer: null })).toBe(false);
    expect(
      dragEventHasFiles({
        dataTransfer: { types: ['text/plain'] } as unknown as DataTransfer,
      })
    ).toBe(false);
  });
});

describe('computeImageScale', () => {
  it('keeps normal photos at 1×', () => {
    expect(computeImageScale(4000, 3000)).toBe(1);
  });

  it('scales down oversized edges', () => {
    const scale = computeImageScale(MAX_IMAGE_EDGE * 2, MAX_IMAGE_EDGE);
    expect(scale).toBeLessThan(1);
    expect(Math.round(MAX_IMAGE_EDGE * 2 * scale)).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
  });
});

describe('loadImageFile / loadImageFiles', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-image'),
      revokeObjectURL: vi.fn(),
    });

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 120,
        height: 80,
        close: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a single file via object URL without data-URL blow-up', async () => {
    const file = makeFile('sunset.png', 'image/png');
    const loaded = await loadImageFile(file);
    expect(loaded.name).toBe('sunset');
    expect(loaded.width).toBe(120);
    expect(loaded.height).toBe(80);
    expect(loaded.src).toBe('blob:mock-image');
    expect(loaded.file).toBe(file);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('downscales huge bitmaps', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 16000,
        height: 12000,
        close: vi.fn(),
      }))
    );

    const toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(['x'], { type: 'image/jpeg' }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob as never);

    const loaded = await loadImageFile(makeFile('huge.jpg', 'image/jpeg'));
    expect(loaded.downscaled).toBe(true);
    expect(loaded.width).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
    expect(loaded.height).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
    expect(loaded.originalWidth).toBe(16000);
  });

  it('skips failed images and keeps successes', async () => {
    const bitmap = vi.fn(async (file: File) => {
      if (file.name.includes('bad')) throw new Error('bad');
      return { width: 10, height: 10, close: vi.fn() };
    });
    vi.stubGlobal('createImageBitmap', bitmap);

    // Fallback path for bad file also fails
    class FailImage {
      onload: (() => void) | null = null;
      onerror: ((err?: unknown) => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.(new Error('bad')));
      }
    }
    vi.stubGlobal('Image', FailImage);

    const loaded = await loadImageFiles([
      makeFile('bad.png', 'image/png'),
      makeFile('good.png', 'image/png'),
      makeFile('skip.txt', 'text/plain'),
    ]);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('good');
  });

  it('reports progress while loading a batch', async () => {
    const events: string[] = [];
    await loadImageFiles([makeFile('a.png', 'image/png'), makeFile('b.png', 'image/png')], (p) => {
      events.push(`${p.phase}:${p.percent}`);
    });
    expect(events.some((e) => e.startsWith('decode:'))).toBe(true);
    expect(events.at(-1)).toMatch(/^done:100$/);
  });
});
