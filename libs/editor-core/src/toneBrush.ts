import {
  brushFalloff,
  clampByte,
  gaussianBlurRgba,
  loadImageToCanvas,
  unitRange,
} from './canvasUtils';

/**
 * Tone brush: Dodge (lighten midtones), Burn (darken) and local Sharpen inside a soft
 * circular brush. Coordinates are in image-local pixels.
 */

export type ToneBrushMode = 'dodge' | 'burn' | 'sharpen';

export interface ToneBrushOptions {
  cx: number;
  cy: number;
  radius: number;
  /** 0-1 (or 0-100): fraction of the radius that is fully opaque */
  hardness: number;
  /** 0-1 (or 0-100) */
  opacity: number;
  mode: ToneBrushMode;
  /** 0-1 (or 0-100), dodge/burn strength. Default 0.5 */
  exposure?: number;
}

export async function applyToneBrushToImage(
  src: string,
  opts: ToneBrushOptions
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'tone brush');
  if (!loaded) return src;
  const { canvas, ctx, width: w, height: h } = loaded;

  try {
    const r = Math.max(2, opts.radius);
    const hardness = unitRange(opts.hardness, 0.5);
    const opacity = unitRange(opts.opacity, 1);
    const exposure = unitRange(opts.exposure, 0.5);

    const minX = Math.max(0, Math.floor(opts.cx - r));
    const maxX = Math.min(w - 1, Math.ceil(opts.cx + r));
    const minY = Math.max(0, Math.floor(opts.cy - r));
    const maxY = Math.min(h - 1, Math.ceil(opts.cy + r));
    if (maxX < minX || maxY < minY) return src;

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const region = ctx.getImageData(minX, minY, bw, bh);
    const px = region.data;

    let blurred: Uint8ClampedArray | null = null;
    if (opts.mode === 'sharpen') {
      // Blur a padded region so the brush edge has real neighbours to sample.
      const sigma = Math.max(1, Math.min(6, r / 8));
      const pad = Math.ceil(sigma * 3);
      const px0 = Math.max(0, minX - pad);
      const py0 = Math.max(0, minY - pad);
      const px1 = Math.min(w - 1, maxX + pad);
      const py1 = Math.min(h - 1, maxY + pad);
      const pw = px1 - px0 + 1;
      const ph = py1 - py0 + 1;
      const padded = ctx.getImageData(px0, py0, pw, ph);
      const padBlur = gaussianBlurRgba(padded.data, pw, ph, sigma);
      blurred = new Uint8ClampedArray(bw * bh * 4);
      for (let y = 0; y < bh; y++) {
        const from = ((y + minY - py0) * pw + (minX - px0)) * 4;
        blurred.set(padBlur.subarray(from, from + bw * 4), y * bw * 4);
      }
    }

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const dist = Math.hypot(x + minX - opts.cx, y + minY - opts.cy);
        const falloff = brushFalloff(dist, r, hardness);
        if (falloff <= 0) continue;
        const i = (y * bw + x) * 4;
        if (px[i + 3] === 0) continue;

        if (opts.mode === 'sharpen' && blurred) {
          const k = falloff * opacity * 1.5;
          for (let c = 0; c < 3; c++) {
            px[i + c] = clampByte(px[i + c] + (px[i + c] - blurred[i + c]) * k);
          }
          continue;
        }

        const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
        // Midtone weight: 1 at mid-grey, falling to a small floor at pure black/white.
        const mid = 1 - Math.pow(Math.abs(lum - 0.5) * 2, 2);
        const weight = 0.15 + 0.85 * mid;
        const s = falloff * opacity * exposure * weight;

        if (opts.mode === 'dodge') {
          for (let c = 0; c < 3; c++) px[i + c] = clampByte(px[i + c] + (255 - px[i + c]) * s);
        } else {
          for (let c = 0; c < 3; c++) px[i + c] = clampByte(px[i + c] * (1 - s));
        }
      }
    }

    ctx.putImageData(region, minX, minY);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Tone brush error:', e);
    return src;
  }
}
