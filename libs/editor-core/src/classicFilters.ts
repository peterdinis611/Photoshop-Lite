import { clampByte, gaussianBlurRgba, loadImageToCanvas } from './canvasUtils';

/**
 * Classic raster filters operating on ImageData in place:
 * Gaussian blur, Unsharp Mask, Add Noise and Sharpen.
 */

export type ClassicFilterKind = 'gaussian' | 'unsharp' | 'noise' | 'sharpen';

/** Gaussian blur; `radius` is the standard deviation in pixels. */
export function applyGaussianBlurImageData(data: ImageData, radius: number): void {
  if (!(radius > 0)) return;
  const blurred = gaussianBlurRgba(data.data, data.width, data.height, radius);
  data.data.set(blurred);
}

/**
 * Unsharp mask. `amount` is a percentage (100 = 1x, typically 0-500), `radius` in pixels,
 * `threshold` 0-255: differences smaller than this are left untouched.
 */
export function applyUnsharpMaskImageData(
  data: ImageData,
  amount: number,
  radius: number,
  threshold: number
): void {
  if (!(amount > 0) || !(radius > 0)) return;
  const k = amount / 100;
  const t = Math.max(0, threshold || 0);
  const px = data.data;
  const blurred = gaussianBlurRgba(px, data.width, data.height, radius);

  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = px[i + c] - blurred[i + c];
      if (Math.abs(diff) >= t) px[i + c] = clampByte(px[i + c] + diff * k);
    }
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Adds monochromatic Gaussian noise. `amount` 0-100. Pass `seed` for deterministic output.
 */
export function applyNoiseImageData(data: ImageData, amount: number, seed?: number): void {
  const a = Math.min(100, Math.max(0, amount || 0));
  if (a === 0) return;
  const sigma = (a / 100) * 60;
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  const px = data.data;

  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    // Box-Muller
    const u1 = Math.max(1e-9, rand());
    const u2 = rand();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
    px[i] = clampByte(px[i] + n);
    px[i + 1] = clampByte(px[i + 1] + n);
    px[i + 2] = clampByte(px[i + 2] + n);
  }
}

/** 3x3 sharpen convolution blended by `amount` 0-100. */
export function applySharpenImageData(data: ImageData, amount: number): void {
  const mix = Math.min(100, Math.max(0, amount || 0)) / 100;
  if (mix === 0) return;
  const { width: w, height: h } = data;
  const px = data.data;
  const src = new Uint8ClampedArray(px);

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const o = (y * w + x) * 4;
      const up = (y0 * w + x) * 4;
      const down = (y1 * w + x) * 4;
      const left = (y * w + x0) * 4;
      const right = (y * w + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const center = src[o + c];
        const conv = 5 * center - src[up + c] - src[down + c] - src[left + c] - src[right + c];
        px[o + c] = clampByte(center + (conv - center) * mix);
      }
    }
  }
}

/** Bakes a classic filter into the image and returns a PNG data URL. */
export async function bakeClassicFilter(
  src: string,
  kind: ClassicFilterKind,
  params: Record<string, number> = {}
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'classic filter');
  if (!loaded) return src;
  const { canvas, ctx, width, height } = loaded;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    switch (kind) {
      case 'gaussian':
        applyGaussianBlurImageData(imageData, params.radius ?? 2);
        break;
      case 'unsharp':
        applyUnsharpMaskImageData(
          imageData,
          params.amount ?? 100,
          params.radius ?? 1.5,
          params.threshold ?? 0
        );
        break;
      case 'noise':
        applyNoiseImageData(imageData, params.amount ?? 20, params.seed);
        break;
      case 'sharpen':
        applySharpenImageData(imageData, params.amount ?? 50);
        break;
      default:
        return src;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Classic filter error:', e);
    return src;
  }
}
