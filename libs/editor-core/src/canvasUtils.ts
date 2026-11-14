/**
 * Internal canvas / pixel helpers shared by the image algorithm modules.
 * Not re-exported from index.ts.
 */

export function loadImage(src: string, label = 'image'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image for ${label}`));
    img.src = src;
  });
}

export function createCanvas(
  w: number,
  h: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return { canvas, ctx: canvas.getContext('2d') };
}

/** Loads `src` into a fresh canvas at natural size. Returns null if no 2D context. */
export async function loadImageToCanvas(
  src: string,
  label: string
): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
} | null> {
  const img = await loadImage(src, label);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const { canvas, ctx } = createCanvas(width, height);
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

export function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Normalise 0-1 or 0-100 style inputs to 0-1. */
export function unitRange(v: number | undefined, fallback: number): number {
  if (v === undefined || !Number.isFinite(v)) return fallback;
  const n = v > 1 ? v / 100 : v;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Soft circular falloff: 1 inside `hardness * r`, smoothstep to 0 at `r`. */
export function brushFalloff(dist: number, radius: number, hardness: number): number {
  if (dist >= radius) return 0;
  const inner = radius * hardness;
  if (dist <= inner) return 1;
  const t = (dist - inner) / Math.max(1e-6, radius - inner);
  const s = 1 - t;
  return s * s * (3 - 2 * s);
}

/**
 * Separable Gaussian blur on RGBA bytes. Colour is blurred in premultiplied space so
 * transparent regions do not bleed dark halos. Returns a new array; `sigma` is in pixels.
 */
export function gaussianBlurRgba(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  sigma: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  if (!(sigma > 0) || w < 1 || h < 1) return out;

  const half = Math.min(150, Math.max(1, Math.ceil(sigma * 3)));
  const kernel = new Float32Array(half * 2 + 1);
  let sum = 0;
  for (let i = -half; i <= half; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + half] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const n = w * h;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const alpha = src[o + 3];
    const f = alpha / 255;
    a[o] = src[o] * f;
    a[o + 1] = src[o + 1] * f;
    a[o + 2] = src[o + 2] * f;
    a[o + 3] = alpha;
  }

  // Horizontal: a -> b
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bl = 0, al = 0;
      for (let k = -half; k <= half; k++) {
        let sx = x + k;
        if (sx < 0) sx = 0;
        else if (sx >= w) sx = w - 1;
        const o = (row + sx) * 4;
        const wgt = kernel[k + half];
        r += a[o] * wgt;
        g += a[o + 1] * wgt;
        bl += a[o + 2] * wgt;
        al += a[o + 3] * wgt;
      }
      const o = (row + x) * 4;
      b[o] = r;
      b[o + 1] = g;
      b[o + 2] = bl;
      b[o + 3] = al;
    }
  }

  // Vertical: b -> out (un-premultiplied)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bl = 0, al = 0;
      for (let k = -half; k <= half; k++) {
        let sy = y + k;
        if (sy < 0) sy = 0;
        else if (sy >= h) sy = h - 1;
        const o = (sy * w + x) * 4;
        const wgt = kernel[k + half];
        r += b[o] * wgt;
        g += b[o + 1] * wgt;
        bl += b[o + 2] * wgt;
        al += b[o + 3] * wgt;
      }
      const o = (y * w + x) * 4;
      if (al > 0.5) {
        const inv = 255 / al;
        out[o] = r * inv;
        out[o + 1] = g * inv;
        out[o + 2] = bl * inv;
      } else {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
      }
      out[o + 3] = al;
    }
  }

  return out;
}
