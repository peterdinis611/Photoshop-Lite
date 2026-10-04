import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bakeRelightPixels, RELIGHT_MODES, relightCloudPrompt } from './photoRelight';
import { bakePortraitPixels, PORTRAIT_MODES } from './photoPortrait';

describe('RELIGHT_MODES / PORTRAIT_MODES', () => {
  it('exposes studio and portrait presets', () => {
    expect(RELIGHT_MODES.map((m) => m.id)).toEqual(['softbox', 'rim', 'golden']);
    expect(PORTRAIT_MODES.map((m) => m.id)).toEqual(['natural', 'glow', 'matte']);
  });

  it('builds cloud prompts', () => {
    expect(relightCloudPrompt('golden')).toMatch(/golden hour/i);
  });
});

describe('bakeRelightPixels / bakePortraitPixels', () => {
  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 32;
      naturalHeight = 32;
      width = 32;
      height = 32;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      // skin-ish peach
      pixels[i] = 210;
      pixels[i + 1] = 160;
      pixels[i + 2] = 130;
      pixels[i + 3] = 255;
    }

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      return {
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        createRadialGradient: () => ({
          addColorStop: vi.fn(),
        }),
        createLinearGradient: () => ({
          addColorStop: vi.fn(),
        }),
        getImageData: () => ({ data: new Uint8ClampedArray(pixels), width: 32, height: 32 }),
        createImageData: () => ({ data: new Uint8ClampedArray(pixels.length), width: 32, height: 32 }),
        putImageData: vi.fn(),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        fillStyle: '',
        canvas: this,
      } as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,lab');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('relights to a data URL', async () => {
    await expect(bakeRelightPixels('blob:x', 'softbox', 0.7)).resolves.toContain('data:image/png');
    await expect(bakeRelightPixels('blob:x', 'rim', 0.8)).resolves.toContain('data:image/png');
    await expect(bakeRelightPixels('blob:x', 'golden', 0.5)).resolves.toContain('data:image/png');
  });

  it('polishes portrait to a data URL', async () => {
    await expect(bakePortraitPixels('blob:x', 'natural', 0.65)).resolves.toContain(
      'data:image/png'
    );
    await expect(bakePortraitPixels('blob:x', 'glow', 0.7)).resolves.toContain('data:image/png');
    await expect(bakePortraitPixels('blob:x', 'matte', 0.6)).resolves.toContain('data:image/png');
  });
});
