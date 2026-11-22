import { loadImageToCanvas } from './canvasUtils';

export type ColorRangeSample = { r: number; g: number; b: number };

export interface ColorRangeOptions {
  /** Sampled target color (RGB 0–255). */
  sample: ColorRangeSample;
  /** Fuzzy match radius 0–200 (Photoshop Fuzziness). */
  fuzziness: number;
  /** When true, invert the resulting selection. */
  invert?: boolean;
}

export interface ColorRangeResult {
  /** Layer-local bounding box of selected pixels. */
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** White = selected on black (same size as source). */
  maskDataUrl: string;
  selectedPixelCount: number;
}

export function colorDist(a: ColorRangeSample, r: number, g: number, b: number): number {
  const dr = a.r - r;
  const dg = a.g - g;
  const db = a.b - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Photoshop-like Color Range: select pixels near a sample color within fuzziness.
 * Operates in layer-local pixel space; caller maps bounds into document space.
 */
export async function colorRangeSelect(
  src: string,
  options: ColorRangeOptions
): Promise<ColorRangeResult> {
  const loaded = await loadImageToCanvas(src, 'color range');
  if (!loaded) {
    return { bounds: null, maskDataUrl: src, selectedPixelCount: 0 };
  }
  const { canvas, ctx, width, height } = loaded;
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const mask = ctx.createImageData(width, height);
  const out = mask.data;
  const fuzz = Math.max(0, options.fuzziness);
  const invert = Boolean(options.invert);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3];
      let selected = false;
      if (a > 8) {
        const d = colorDist(options.sample, px[i], px[i + 1], px[i + 2]);
        selected = d <= fuzz;
      }
      if (invert) selected = !selected && a > 8;
      const v = selected ? 255 : 0;
      out[i] = v;
      out[i + 1] = v;
      out[i + 2] = v;
      out[i + 3] = 255;
      if (selected) {
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  ctx.putImageData(mask, 0, 0);
  const maskDataUrl = canvas.toDataURL('image/png');

  if (count === 0 || maxX < minX) {
    return { bounds: null, maskDataUrl, selectedPixelCount: 0 };
  }

  return {
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    maskDataUrl,
    selectedPixelCount: count,
  };
}

/** Fill selection with a solid color inside a layer-local rect. */
export async function fillImageRect(
  src: string,
  rect: { x: number; y: number; width: number; height: number },
  color: string,
  opacity = 1
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'fill rect');
  if (!loaded) return src;
  const { canvas, ctx } = loaded;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(rect.x),
    Math.round(rect.y),
    Math.round(rect.width),
    Math.round(rect.height)
  );
  ctx.restore();
  return canvas.toDataURL('image/png');
}
