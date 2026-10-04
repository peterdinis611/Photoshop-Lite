import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bakeClarityPixels, CLARITY_MODES } from './photoClarity';
import { bakeColorMatchPixels } from './photoColorMatch';
import { computeOutpaintLayout, OUTPAINT_PRESETS } from './photoOutpaint';

describe('computeOutpaintLayout', () => {
  it('expands evenly for +15%', () => {
    const layout = computeOutpaintLayout(1000, 800, 'expand', 0.15);
    expect(layout.width).toBe(1300);
    expect(layout.height).toBe(1040);
    expect(layout.offsetX).toBe(150);
    expect(layout.offsetY).toBe(120);
  });

  it('widens to 16:9', () => {
    const layout = computeOutpaintLayout(800, 800, '16:9');
    expect(layout.width / layout.height).toBeCloseTo(16 / 9, 2);
    expect(layout.offsetX).toBeGreaterThan(0);
  });

  it('lists presets', () => {
    expect(OUTPAINT_PRESETS.map((p) => p.id)).toContain('9:16');
  });
});

describe('CLARITY_MODES', () => {
  it('exposes clarity / dehaze / punch', () => {
    expect(CLARITY_MODES.map((m) => m.id)).toEqual(['clarity', 'dehaze', 'punch']);
  });
});

describe('bakeClarityPixels / bakeColorMatchPixels', () => {
  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 24;
      naturalHeight = 24;
      width = 24;
      height = 24;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const pixels = new Uint8ClampedArray(24 * 24 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 140;
      pixels[i + 1] = 150;
      pixels[i + 2] = 170;
      pixels[i + 3] = 255;
    }

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      return {
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray(pixels), width: 24, height: 24 }),
        createImageData: () => ({
          data: new Uint8ClampedArray(pixels.length),
          width: 24,
          height: 24,
        }),
        putImageData: vi.fn(),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        canvas: this,
      } as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,lab2'
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('bakes clarity modes', async () => {
    await expect(bakeClarityPixels('blob:a', 'clarity', 0.7)).resolves.toContain('data:image/png');
    await expect(bakeClarityPixels('blob:a', 'dehaze', 0.8)).resolves.toContain('data:image/png');
    await expect(bakeClarityPixels('blob:a', 'punch', 0.6)).resolves.toContain('data:image/png');
  });

  it('matches grade from reference', async () => {
    await expect(bakeColorMatchPixels('blob:src', 'blob:ref', 0.8)).resolves.toContain(
      'data:image/png'
    );
  });
});
