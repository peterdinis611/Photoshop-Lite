/**
 * Liquify brushes. All coordinates are image-local pixels.
 *
 * - push:        forward warp — pixels follow the drag vector with a smooth radial falloff
 * - twirl:       rotate pixels around the brush centre, strongest in the middle
 * - reconstruct: blend pixels back toward the snapshot taken when the stroke started
 *
 * `liquifyPixels` is the pure kernel (testable in node); `applyLiquifyBrush` wraps it with
 * canvas decode / encode and only touches the pixels around the brush.
 */
import { createCanvas, loadImage } from './canvasUtils';
import type { PixelBuffer } from './magneticEdge';

export type LiquifyMode = 'push' | 'twirl' | 'reconstruct';

export const LIQUIFY_MODES: readonly LiquifyMode[] = ['push', 'twirl', 'reconstruct'];

export interface LiquifyBrushOptions {
  mode: LiquifyMode;
  cx: number;
  cy: number;
  /** Brush radius in pixels */
  radius: number;
  /** Drag vector since the previous stamp (push) */
  dx?: number;
  dy?: number;
  /** Rotation per stamp in radians, clockwise positive (twirl) */
  angle?: number;
  /** 0-1 brush strength (default 1) */
  strength?: number;
  /** Snapshot taken at stroke start (reconstruct) */
  originalSrc?: string;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

function sampleChannel(
  buf: PixelBuffer,
  fx: number,
  fy: number,
  c: number
): number {
  const { data, width, height } = buf;
  const x = Math.min(width - 1, Math.max(0, fx));
  const y = Math.min(height - 1, Math.max(0, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = data[(y0 * width + x0) * 4 + c];
  const b = data[(y0 * width + x1) * 4 + c];
  const cc = data[(y1 * width + x0) * 4 + c];
  const d = data[(y1 * width + x1) * 4 + c];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
}

/**
 * Apply one brush stamp to `src` and return a new buffer of the same size.
 * `original` is only read for `reconstruct` and must match `src` in size.
 */
export function liquifyPixels(
  src: PixelBuffer,
  original: PixelBuffer | null,
  opts: LiquifyBrushOptions
): PixelBuffer {
  const { width: w, height: h } = src;
  const out = new Uint8ClampedArray(src.data as ArrayLike<number>);
  const result: PixelBuffer = { data: out, width: w, height: h };

  const r = Math.max(4, opts.radius);
  const strength = Math.min(1, Math.max(0, opts.strength ?? 1));
  const dx = opts.dx ?? 0;
  const dy = opts.dy ?? 0;
  const angle = opts.angle ?? 0;

  if (opts.mode === 'push' && Math.hypot(dx, dy) < 0.5) return result;
  if (opts.mode === 'twirl' && Math.abs(angle) < 1e-4) return result;
  if (opts.mode === 'reconstruct' && (!original || original.width !== w || original.height !== h)) {
    return result;
  }

  const minX = Math.max(0, Math.floor(opts.cx - r));
  const maxX = Math.min(w - 1, Math.ceil(opts.cx + r));
  const minY = Math.max(0, Math.floor(opts.cy - r));
  const maxY = Math.min(h - 1, Math.ceil(opts.cy + r));

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const rx = px - opts.cx;
      const ry = py - opts.cy;
      const dist = Math.hypot(rx, ry);
      if (dist >= r) continue;
      const falloff = smoothstep(1 - dist / r);
      const i = (py * w + px) * 4;

      if (opts.mode === 'push') {
        const amount = strength * falloff;
        const fx = px - dx * amount;
        const fy = py - dy * amount;
        for (let c = 0; c < 4; c++) out[i + c] = sampleChannel(src, fx, fy, c);
      } else if (opts.mode === 'twirl') {
        const theta = -angle * strength * falloff;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const fx = opts.cx + rx * cos - ry * sin;
        const fy = opts.cy + rx * sin + ry * cos;
        for (let c = 0; c < 4; c++) out[i + c] = sampleChannel(src, fx, fy, c);
      } else if (original) {
        // Gentle per-stamp blend so repeated strokes ramp back to the original
        const amount = Math.min(1, strength * falloff * 0.4);
        for (let c = 0; c < 4; c++) {
          out[i + c] = src.data[i + c] * (1 - amount) + original.data[i + c] * amount;
        }
      }
    }
  }
  return result;
}

let originalCache: { src: string; data: ImageData } | null = null;

async function readImageData(src: string): Promise<ImageData | null> {
  const img = await loadImage(src, 'liquify');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const { ctx } = createCanvas(w, h);
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/** Apply one liquify stamp to an image source; resolves to a PNG data URL (or `src` if nothing changed). */
export async function applyLiquifyBrush(src: string, opts: LiquifyBrushOptions): Promise<string> {
  const img = await loadImage(src, 'liquify');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const { canvas, ctx } = createCanvas(w, h);
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);

  const r = Math.max(4, opts.radius);
  const reach = Math.hypot(opts.dx ?? 0, opts.dy ?? 0);
  const strength = Math.min(1, Math.max(0, opts.strength ?? 1));
  // Push pulls content from behind the brush, so read a window padded by the drag length
  const pad = (opts.mode === 'push' ? Math.ceil(reach * strength) : 0) + 2;

  const wx0 = Math.max(0, Math.floor(opts.cx - r) - pad);
  const wy0 = Math.max(0, Math.floor(opts.cy - r) - pad);
  const wx1 = Math.min(w - 1, Math.ceil(opts.cx + r) + pad);
  const wy1 = Math.min(h - 1, Math.ceil(opts.cy + r) + pad);
  const ww = wx1 - wx0 + 1;
  const wh = wy1 - wy0 + 1;
  if (ww < 1 || wh < 1) return src;

  const srcWindow = ctx.getImageData(wx0, wy0, ww, wh);

  let originalWindow: PixelBuffer | null = null;
  if (opts.mode === 'reconstruct') {
    if (!opts.originalSrc) return src;
    if (originalCache?.src !== opts.originalSrc) {
      const data = await readImageData(opts.originalSrc);
      if (!data) return src;
      originalCache = { src: opts.originalSrc, data };
    }
    const full = originalCache.data;
    if (full.width !== w || full.height !== h) return src;
    const win = new Uint8ClampedArray(ww * wh * 4);
    for (let y = 0; y < wh; y++) {
      const from = ((wy0 + y) * w + wx0) * 4;
      win.set(full.data.subarray(from, from + ww * 4), y * ww * 4);
    }
    originalWindow = { data: win, width: ww, height: wh };
  }

  const warped = liquifyPixels(srcWindow, originalWindow, {
    ...opts,
    cx: opts.cx - wx0,
    cy: opts.cy - wy0,
  });
  ctx.putImageData(new ImageData(warped.data as Uint8ClampedArray<ArrayBuffer>, ww, wh), wx0, wy0);
  return canvas.toDataURL('image/png');
}

/** Drop the cached reconstruct snapshot (call when a stroke ends). */
export function clearLiquifySnapshotCache(): void {
  originalCache = null;
}
