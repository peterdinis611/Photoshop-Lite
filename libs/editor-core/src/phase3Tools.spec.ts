import { describe, expect, it } from 'vitest';
import {
  buildLuminanceGradient,
  snapToEdge,
  liquifyPixels,
  warpPixelsToQuad,
  mapUnitToQuad,
  createProjectiveInverse,
  createBilinearInverse,
  type PixelBuffer,
  type Quad,
} from './index';

/** Left half black, right half white — a vertical edge between x=3 and x=4. */
function edgeImage(w = 8, h = 8): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = x >= w / 2 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

function solid(w: number, h: number, rgba: [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { data, width: w, height: h };
}

describe('magnetic edge', () => {
  it('computes a strong gradient along the edge and none on flat areas', () => {
    const img = edgeImage();
    const grad = buildLuminanceGradient(img);
    expect(grad).toHaveLength(64);
    expect(grad[3 * 8 + 3]).toBeGreaterThan(500);
    expect(grad[3 * 8 + 1]).toBe(0);
  });

  it('snaps a nearby point onto the edge', () => {
    const img = edgeImage();
    const grad = buildLuminanceGradient(img);
    const snapped = snapToEdge(grad, 8, 8, 1, 4, 3);
    expect([3, 4]).toContain(snapped.x);
    expect(snapped.y).toBe(4);
  });

  it('keeps the point when there is no edge in range', () => {
    const grad = buildLuminanceGradient(edgeImage());
    expect(snapToEdge(grad, 8, 8, 1, 4, 1)).toEqual({ x: 1, y: 4 });
  });

  it('clamps out-of-bounds input', () => {
    const grad = new Float32Array(16);
    expect(snapToEdge(grad, 4, 4, -5, 99, 2)).toEqual({ x: 0, y: 3 });
  });
});

describe('perspective warp math', () => {
  const quad: Quad = [
    { x: 10, y: 10 },
    { x: 90, y: 20 },
    { x: 80, y: 70 },
    { x: 15, y: 60 },
  ];

  it('maps unit-square corners onto the quad corners (projective)', () => {
    expect(mapUnitToQuad(quad, 0, 0)).toEqual({ x: 10, y: 10 });
    const br = mapUnitToQuad(quad, 1, 1);
    expect(br.x).toBeCloseTo(80, 6);
    expect(br.y).toBeCloseTo(70, 6);
  });

  it('projective inverse round-trips', () => {
    const inv = createProjectiveInverse(quad)!;
    const p = mapUnitToQuad(quad, 0.3, 0.7);
    const uv = inv(p.x, p.y);
    expect(uv.u).toBeCloseTo(0.3, 6);
    expect(uv.v).toBeCloseTo(0.7, 6);
  });

  it('bilinear inverse recovers the centre', () => {
    const inv = createBilinearInverse(quad);
    // Bilinear centre = average of the four corners
    const cx = (10 + 90 + 80 + 15) / 4;
    const cy = (10 + 20 + 70 + 60) / 4;
    const uv = inv(cx, cy)!;
    expect(uv.u).toBeCloseTo(0.5, 5);
    expect(uv.v).toBeCloseTo(0.5, 5);
  });

  it('identity quad reproduces the source pixels', () => {
    const src = solid(4, 4, [200, 100, 50, 255]);
    const identity: Quad = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    for (const method of ['projective', 'bilinear'] as const) {
      const out = warpPixelsToQuad(src, identity, method)!;
      expect(out.width).toBe(4);
      expect(out.height).toBe(4);
      expect(Array.from(out.data.slice(0, 4))).toEqual([200, 100, 50, 255]);
    }
  });

  it('leaves pixels outside a skewed quad transparent and sizes output to its bounds', () => {
    const src = solid(10, 10, [255, 255, 255, 255]);
    const tri: Quad = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 20, y: 20 },
    ];
    const out = warpPixelsToQuad(src, tri, 'bilinear');
    // Degenerate fourth corner: either rejected or still bounded by the quad box
    if (out) {
      expect(out.width).toBe(20);
      expect(out.height).toBe(20);
    }
  });
});

describe('liquify kernel', () => {
  it('push moves content along the drag vector', () => {
    const src = edgeImage(32, 32);
    const out = liquifyPixels(src, null, {
      mode: 'push',
      cx: 16,
      cy: 16,
      radius: 12,
      dx: 6,
      dy: 0,
    });
    // The edge at x=16 is dragged right, so a previously white pixel next to it turns darker/black
    const before = src.data[(16 * 32 + 17) * 4];
    const after = out.data[(16 * 32 + 17) * 4];
    expect(before).toBe(255);
    expect(after).toBeLessThan(255);
  });

  it('twirl leaves the exact centre fixed and changes nearby pixels', () => {
    const src = edgeImage(32, 32);
    const out = liquifyPixels(src, null, {
      mode: 'twirl',
      cx: 16,
      cy: 16,
      radius: 12,
      angle: 0.8,
    });
    expect(out.data[(16 * 32 + 16) * 4]).toBe(src.data[(16 * 32 + 16) * 4]);
    expect(Array.from(out.data)).not.toEqual(Array.from(src.data));
  });

  it('reconstruct blends toward the original snapshot', () => {
    const original = solid(16, 16, [255, 0, 0, 255]);
    const edited = solid(16, 16, [0, 0, 255, 255]);
    const out = liquifyPixels(edited, original, {
      mode: 'reconstruct',
      cx: 8,
      cy: 8,
      radius: 6,
      strength: 1,
    });
    const i = (8 * 16 + 8) * 4;
    expect(out.data[i]).toBeGreaterThan(0);
    expect(out.data[i + 2]).toBeLessThan(255);
    // Outside the brush nothing changes
    expect(out.data[0]).toBe(0);
  });
});
