import { clampByte, gaussianBlurRgba, loadImageToCanvas } from './canvasUtils';

/**
 * Classic raster filters operating on ImageData in place.
 */

export type ClassicFilterKind =
  | 'gaussian'
  | 'unsharp'
  | 'noise'
  | 'sharpen'
  | 'highPass'
  | 'motionBlur'
  | 'radialBlur'
  | 'median'
  | 'emboss';

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

/** High Pass: original − blur + 128 grey. `radius` in px. */
export function applyHighPassImageData(data: ImageData, radius: number): void {
  if (!(radius > 0)) return;
  const px = data.data;
  const blurred = gaussianBlurRgba(px, data.width, data.height, radius);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) {
      px[i + c] = clampByte(px[i + c] - blurred[i + c] + 128);
    }
  }
}

/** Directional motion blur. `distance` px, `angle` degrees. */
export function applyMotionBlurImageData(
  data: ImageData,
  distance: number,
  angleDeg: number
): void {
  const dist = Math.max(1, Math.round(distance || 0));
  if (dist < 2) return;
  const { width: w, height: h } = data;
  const px = data.data;
  const src = new Uint8ClampedArray(px);
  const rad = ((angleDeg || 0) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const samples = dist;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let s = 0; s < samples; s++) {
        const t = s / (samples - 1) - 0.5;
        const sx = Math.round(x + dx * t * dist);
        const sy = Math.round(y + dy * t * dist);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const i = (sy * w + sx) * 4;
        const aa = src[i + 3];
        if (aa === 0) continue;
        r += src[i] * aa;
        g += src[i + 1] * aa;
        b += src[i + 2] * aa;
        a += aa;
        n += 1;
      }
      if (n === 0 || a === 0) continue;
      px[o] = clampByte(r / a);
      px[o + 1] = clampByte(g / a);
      px[o + 2] = clampByte(b / a);
      px[o + 3] = clampByte(a / n);
    }
  }
}

/** Simple radial blur (spin) around image center. `amount` 0–100. */
export function applyRadialBlurImageData(data: ImageData, amount: number): void {
  const mix = Math.min(100, Math.max(0, amount || 0)) / 100;
  if (mix <= 0) return;
  const { width: w, height: h } = data;
  const px = data.data;
  const src = new Uint8ClampedArray(px);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxAngle = mix * 0.35; // radians
  const samples = Math.max(4, Math.round(6 + mix * 10));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const base = Math.atan2(dy, dx);
      for (let s = 0; s < samples; s++) {
        const t = s / (samples - 1) - 0.5;
        const ang = base + t * maxAngle;
        const sx = Math.round(cx + Math.cos(ang) * dist);
        const sy = Math.round(cy + Math.sin(ang) * dist);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const i = (sy * w + sx) * 4;
        const aa = src[i + 3];
        if (aa === 0) continue;
        r += src[i] * aa;
        g += src[i + 1] * aa;
        b += src[i + 2] * aa;
        a += aa;
        n += 1;
      }
      if (n === 0 || a === 0) continue;
      px[o] = clampByte(r / a);
      px[o + 1] = clampByte(g / a);
      px[o + 2] = clampByte(b / a);
      px[o + 3] = clampByte(a / n);
    }
  }
}

/** Median filter for noise reduction. `radius` 1–3. */
export function applyMedianImageData(data: ImageData, radius: number): void {
  const rad = Math.max(1, Math.min(3, Math.round(radius || 1)));
  const { width: w, height: h } = data;
  const px = data.data;
  const src = new Uint8ClampedArray(px);
  const size = (rad * 2 + 1) ** 2;
  const buf = new Uint8Array(size);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        let n = 0;
        for (let dy = -rad; dy <= rad; dy++) {
          const sy = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -rad; dx <= rad; dx++) {
            const sx = Math.min(w - 1, Math.max(0, x + dx));
            buf[n++] = src[(sy * w + sx) * 4 + c];
          }
        }
        buf.subarray(0, n).sort();
        px[o + c] = buf[(n / 2) | 0];
      }
    }
  }
}

/** Emboss relief. `amount` 0–100, `angle` degrees. */
export function applyEmbossImageData(
  data: ImageData,
  amount: number,
  angleDeg: number
): void {
  const mix = Math.min(100, Math.max(0, amount || 0)) / 100;
  if (mix <= 0) return;
  const { width: w, height: h } = data;
  const px = data.data;
  const src = new Uint8ClampedArray(px);
  const rad = ((angleDeg || 135) * Math.PI) / 180;
  const ox = Math.round(Math.cos(rad));
  const oy = Math.round(Math.sin(rad));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3] === 0) continue;
      const sx = Math.min(w - 1, Math.max(0, x + ox));
      const sy = Math.min(h - 1, Math.max(0, y + oy));
      const i = (sy * w + sx) * 4;
      for (let c = 0; c < 3; c++) {
        const diff = src[o + c] - src[i + c];
        const embossed = clampByte(128 + diff);
        px[o + c] = clampByte(src[o + c] * (1 - mix) + embossed * mix);
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
      case 'highPass':
        applyHighPassImageData(imageData, params.radius ?? 3);
        break;
      case 'motionBlur':
        applyMotionBlurImageData(imageData, params.distance ?? 12, params.angle ?? 0);
        break;
      case 'radialBlur':
        applyRadialBlurImageData(imageData, params.amount ?? 30);
        break;
      case 'median':
        applyMedianImageData(imageData, params.radius ?? 1);
        break;
      case 'emboss':
        applyEmbossImageData(imageData, params.amount ?? 80, params.angle ?? 135);
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
