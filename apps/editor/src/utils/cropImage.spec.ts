import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  applyCropToImageLayer,
  cropImageLayerToRect,
  intersectRects,
  layerAxisAlignedBounds,
} from './cropImage';
import type { ImageLayer } from '../types/editor';
import { DEFAULT_ADJUSTMENTS } from '@photoshop-lite/editor-core';

function makeImageLayer(overrides: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: 'img-1',
    type: 'image',
    name: 'Photo',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    x: 100,
    y: 50,
    width: 400,
    height: 300,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    src: 'blob:src',
    originalSrc: 'blob:src',
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    ...overrides,
  };
}

describe('intersectRects', () => {
  it('returns overlap', () => {
    expect(
      intersectRects(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 }
      )
    ).toEqual({ x: 50, y: 50, width: 50, height: 50 });
  });

  it('returns null when disjoint', () => {
    expect(
      intersectRects(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 }
      )
    ).toBeNull();
  });
});

describe('layerAxisAlignedBounds', () => {
  it('matches unrotated scaled box', () => {
    expect(
      layerAxisAlignedBounds({
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        scaleX: 2,
        scaleY: 1,
        rotation: 0,
      })
    ).toEqual({ x: 10, y: 20, width: 200, height: 50 });
  });

  it('expands for 90° rotation', () => {
    const box = layerAxisAlignedBounds({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      scaleX: 1,
      scaleY: 1,
      rotation: 90,
    });
    expect(box.width).toBeCloseTo(40, 5);
    expect(box.height).toBeCloseTo(100, 5);
  });
});

describe('cropImageLayerToRect', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:cropped'),
      revokeObjectURL: vi.fn(),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      crossOrigin = '';
      naturalWidth = 400;
      naturalHeight = 300;
      width = 400;
      height = 300;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback
    ) {
      cb(new Blob([new Uint8Array(800)], { type: 'image/png' }));
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when layer is outside crop', async () => {
    const layer = makeImageLayer({ x: 0, y: 0, width: 50, height: 50 });
    const result = await cropImageLayerToRect(layer, {
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });
    expect(result).toBeNull();
  });

  it('crops intersection and repositions relative to crop origin', async () => {
    const layer = makeImageLayer({ x: 100, y: 50, width: 400, height: 300 });
    const result = await cropImageLayerToRect(layer, {
      x: 150,
      y: 100,
      width: 200,
      height: 150,
    });
    expect(result).not.toBeNull();
    expect(result!.src).toBe('blob:cropped');
    expect(result!.width).toBe(200);
    expect(result!.height).toBe(150);
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
  });

  it('applyCropToImageLayer bakes pixels and resets transform', async () => {
    const layer = makeImageLayer({
      x: 100,
      y: 50,
      scaleX: 1.5,
      rotation: 15,
    });
    const next = await applyCropToImageLayer(layer, {
      x: 100,
      y: 50,
      width: 200,
      height: 150,
    });
    expect(next.scaleX).toBe(1);
    expect(next.scaleY).toBe(1);
    expect(next.rotation).toBe(0);
    expect(next.src).toBe('blob:cropped');
    expect(next.hasLayerMask).toBe(false);
  });

  it('shifts layer when there is no overlap', async () => {
    const layer = makeImageLayer({ x: 0, y: 0, width: 40, height: 40 });
    const next = await applyCropToImageLayer(layer, {
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });
    expect(next.x).toBe(-200);
    expect(next.y).toBe(-200);
    expect(next.src).toBe('blob:src');
  });
});
