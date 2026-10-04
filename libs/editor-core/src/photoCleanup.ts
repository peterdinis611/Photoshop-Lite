import { clamp } from './optimize';

export type CleanupMode = 'gentle' | 'standard' | 'strong' | 'dust';

export interface CleanupModeMeta {
  id: CleanupMode;
  label: string;
  blurb: string;
}

export const CLEANUP_MODES: CleanupModeMeta[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    blurb: 'Light denoise — keeps texture, softens grain',
  },
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'Balanced cleanup for phone noise and compression',
  },
  {
    id: 'strong',
    label: 'Strong',
    blurb: 'Heavy denoise for low-light / ISO noise',
  },
  {
    id: 'dust',
    label: 'Dust & Spots',
    blurb: 'Removes small speckles and dust-like artifacts',
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for cleanup'));
    img.src = src;
  });
}

function modeParams(mode: CleanupMode, intensity: number) {
  const t = clamp(intensity, 0.2, 1);
  switch (mode) {
    case 'gentle':
      return { blurScale: 0.55 + 0.15 * t, mix: 0.25 + 0.2 * t, sharpen: 0.12 * t, dustPasses: 0 };
    case 'standard':
      return { blurScale: 0.45 + 0.12 * t, mix: 0.35 + 0.25 * t, sharpen: 0.22 * t, dustPasses: 1 };
    case 'strong':
      return { blurScale: 0.35 + 0.1 * t, mix: 0.5 + 0.3 * t, sharpen: 0.18 * t, dustPasses: 1 };
    case 'dust':
      return { blurScale: 0.5 + 0.1 * t, mix: 0.2 + 0.15 * t, sharpen: 0.28 * t, dustPasses: 2 + Math.round(t) };
  }
}

/**
 * Photo cleanup / vyčistenie — denoise + optional dust/speckle removal + light re-sharpen.
 * Returns a new PNG data URL (destructive bake; caller may put on new layer).
 */
export async function bakeCleanupPixels(
  src: string,
  mode: CleanupMode = 'standard',
  intensity = 0.7
): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 2 || h < 2) return src;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);
  const original = ctx.getImageData(0, 0, w, h);
  const { blurScale, mix, sharpen, dustPasses } = modeParams(mode, intensity);

  // 1) Spatial denoise via downscale → upscale blur (edge-preserving-ish soft blur)
  const tw = Math.max(2, Math.floor(w * blurScale));
  const th = Math.max(2, Math.floor(h * blurScale));
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext('2d');
  if (!bctx) return src;

  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  // Ping-pong downscale
  bctx.drawImage(canvas, 0, 0, tw, th);
  bctx.drawImage(blurCanvas, 0, 0, tw, th, 0, 0, w, h);
  // Second soft pass for strong modes
  if (mode === 'strong' || mode === 'standard') {
    const tw2 = Math.max(2, Math.floor(w * (blurScale + 0.08)));
    const th2 = Math.max(2, Math.floor(h * (blurScale + 0.08)));
    bctx.drawImage(blurCanvas, 0, 0, tw2, th2);
    bctx.drawImage(blurCanvas, 0, 0, tw2, th2, 0, 0, w, h);
  }

  const blurred = bctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const srcData = original.data;
  const blurData = blurred.data;
  const dst = out.data;

  // 2) Luminance-weighted mix: more denoise in flat areas, keep edges
  for (let i = 0; i < srcData.length; i += 4) {
    const r = srcData[i];
    const g = srcData[i + 1];
    const b = srcData[i + 2];
    const br = blurData[i];
    const bg = blurData[i + 1];
    const bb = blurData[i + 2];

    const edge =
      Math.abs(r - br) * 0.299 + Math.abs(g - bg) * 0.587 + Math.abs(b - bb) * 0.114;
    const edgeFactor = clamp(1 - edge / 40, 0, 1); // strong edge → less mix
    const m = mix * (0.35 + 0.65 * edgeFactor);

    dst[i] = Math.round(r * (1 - m) + br * m);
    dst[i + 1] = Math.round(g * (1 - m) + bg * m);
    dst[i + 2] = Math.round(b * (1 - m) + bb * m);
    dst[i + 3] = srcData[i + 3];
  }

  // 3) Dust / spot pass — replace outlier pixels with local median-ish neighbor average
  if (dustPasses > 0) {
    for (let pass = 0; pass < dustPasses; pass++) {
      applyDustPass(dst, w, h, intensity);
    }
  }

  ctx.putImageData(out, 0, 0);

  // 4) Light unsharp to recover detail lost to denoise
  if (sharpen > 0.05) {
    applyUnsharp(ctx, w, h, sharpen, 1.1);
  }

  return canvas.toDataURL('image/png');
}

function applyDustPass(data: Uint8ClampedArray, w: number, h: number, intensity: number) {
  const threshold = 28 - 10 * clamp(intensity, 0, 1); // lower = more aggressive
  const copy = new Uint8ClampedArray(data);

  const idx = (x: number, y: number) => (y * w + x) * 4;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y);
      const lum = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];

      let sum = 0;
      let count = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const j = idx(x + dx, y + dy);
          const nl = 0.299 * copy[j] + 0.587 * copy[j + 1] + 0.114 * copy[j + 2];
          sum += nl;
          sumR += copy[j];
          sumG += copy[j + 1];
          sumB += copy[j + 2];
          count++;
        }
      }

      const avg = sum / count;
      if (Math.abs(lum - avg) > threshold) {
        // Speckle / dust outlier → replace with neighbor average
        data[i] = Math.round(sumR / count);
        data[i + 1] = Math.round(sumG / count);
        data[i + 2] = Math.round(sumB / count);
      }
    }
  }
}

function applyUnsharp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
  radius: number
) {
  const src = ctx.getImageData(0, 0, w, h);
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext('2d');
  if (!bctx) return;

  const scale = Math.max(0.25, 1 / (1 + radius));
  const tw = Math.max(1, Math.floor(w * scale));
  const th = Math.max(1, Math.floor(h * scale));
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(ctx.canvas, 0, 0, tw, th);
  bctx.drawImage(blurCanvas, 0, 0, tw, th, 0, 0, w, h);
  const blurred = bctx.getImageData(0, 0, w, h);

  const out = src.data;
  const blur = blurred.data;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = clamp(Math.round(out[i] + (out[i] - blur[i]) * amount), 0, 255);
    out[i + 1] = clamp(Math.round(out[i + 1] + (out[i + 1] - blur[i + 1]) * amount), 0, 255);
    out[i + 2] = clamp(Math.round(out[i + 2] + (out[i + 2] - blur[i + 2]) * amount), 0, 255);
  }
  ctx.putImageData(src, 0, 0);
}
