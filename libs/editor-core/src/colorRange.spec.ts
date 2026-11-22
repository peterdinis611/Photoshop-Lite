import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { colorDist, colorRangeSelect, fillImageRect } from './colorRange';

describe('colorDist', () => {
  it('is zero for identical colors', () => {
    expect(colorDist({ r: 10, g: 20, b: 30 }, 10, 20, 30)).toBe(0);
  });

  it('grows with channel delta', () => {
    expect(colorDist({ r: 0, g: 0, b: 0 }, 3, 4, 0)).toBe(5);
  });
});

describe('colorRangeSelect / fillImageRect', () => {
  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 4;
      naturalHeight = 4;
      width = 4;
      height = 4;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    // 2×2 red corner + rest dark gray
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      const idx = i / 4;
      const x = idx % 4;
      const y = Math.floor(idx / 4);
      if (x < 2 && y < 2) {
        pixels[i] = 255;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 255;
      } else {
        pixels[i] = 10;
        pixels[i + 1] = 10;
        pixels[i + 2] = 10;
        pixels[i + 3] = 255;
      }
    }

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      return {
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray(pixels), width: 4, height: 4 }),
        createImageData: () => ({
          data: new Uint8ClampedArray(pixels.length),
          width: 4,
          height: 4,
        }),
        putImageData: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        globalAlpha: 1,
        fillStyle: '#000',
        canvas: this,
      } as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,cr'
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selects pixels near the sample within fuzziness', async () => {
    const result = await colorRangeSelect('blob:x', {
      sample: { r: 10, g: 10, b: 10 },
      fuzziness: 20,
    });
    expect(result.selectedPixelCount).toBeGreaterThan(0);
    expect(result.bounds).not.toBeNull();
    expect(result.maskDataUrl).toContain('data:image/png');
  });

  it('returns empty when nothing matches', async () => {
    const result = await colorRangeSelect('blob:x', {
      sample: { r: 0, g: 255, b: 0 },
      fuzziness: 5,
    });
    expect(result.selectedPixelCount).toBe(0);
    expect(result.bounds).toBeNull();
  });

  it('fillImageRect returns a data URL', async () => {
    const out = await fillImageRect(
      'blob:x',
      { x: 0, y: 0, width: 2, height: 2 },
      '#ff0000',
      1
    );
    expect(out).toContain('data:image/png');
  });
});
