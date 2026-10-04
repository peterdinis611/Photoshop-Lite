import { clamp } from './optimize';

export type ClarityMode = 'clarity' | 'dehaze' | 'punch';

export interface ClarityModeMeta {
  id: ClarityMode;
  label: string;
  blurb: string;
}

export const CLARITY_MODES: ClarityModeMeta[] = [
  {
    id: 'clarity',
    label: 'Clarity',
    blurb: 'Midtone snap — recovers flat phone detail',
  },
  {
    id: 'dehaze',
    label: 'Dehaze',
    blurb: 'Cuts haze / fog wash, restores local contrast',
  },
  {
    id: 'punch',
    label: 'Punch',
    blurb: 'Clarity + contrast + slight vibrance for flat shots',
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for clarity'));
    img.src = src;
  });
}

function softBlur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number
): ImageData {
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext('2d');
  if (!bctx) return ctx.getImageData(0, 0, w, h);
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  const tw = Math.max(2, Math.floor(w * scale));
  const th = Math.max(2, Math.floor(h * scale));
  bctx.drawImage(ctx.canvas, 0, 0, tw, th);
  bctx.drawImage(blurCanvas, 0, 0, tw, th, 0, 0, w, h);
  return bctx.getImageData(0, 0, w, h);
}

/**
 * Local clarity / dehaze / punch — no cloud.
 * Midtone unsharp + haze contrast recovery.
 */
export async function bakeClarityPixels(
  src: string,
  mode: ClarityMode = 'clarity',
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
  const t = clamp(intensity, 0.2, 1);

  const blurScale = mode === 'dehaze' ? 0.28 : mode === 'punch' ? 0.35 : 0.4;
  const blurred = softBlur(ctx, w, h, blurScale);
  const out = ctx.createImageData(w, h);
  const srcData = original.data;
  const blurData = blurred.data;
  const dst = out.data;

  const clarityAmt =
    mode === 'clarity' ? 0.55 * t : mode === 'punch' ? 0.45 * t : 0.35 * t;
  const dehazeAmt = mode === 'dehaze' || mode === 'punch' ? 0.55 * t : 0;
  const satAmt = mode === 'punch' ? 0.18 * t : mode === 'dehaze' ? 0.1 * t : 0;

  for (let i = 0; i < srcData.length; i += 4) {
    const a = srcData[i + 3];
    if (a === 0) {
      dst[i + 3] = 0;
      continue;
    }

    let r = srcData[i];
    let g = srcData[i + 1];
    let b = srcData[i + 2];

    // Midtone clarity (unsharp)
    const hr = r - blurData[i];
    const hg = g - blurData[i + 1];
    const hb = b - blurData[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const mid = 1 - Math.abs(lum - 0.5) * 2; // peak at midtones
    r += hr * clarityAmt * (0.4 + 0.6 * mid);
    g += hg * clarityAmt * (0.4 + 0.6 * mid);
    b += hb * clarityAmt * (0.4 + 0.6 * mid);

    if (dehazeAmt > 0.01) {
      // Approximate dehaze: lift blacks slightly, stretch contrast in washed areas
      const avg = (r + g + b) / 3;
      const haze = clamp((avg - 40) / 180, 0, 1); // brighter wash → more haze
      const stretch = 1 + dehazeAmt * 0.45 * haze;
      const black = 12 * dehazeAmt * haze;
      r = (r - black) * stretch;
      g = (g - black) * stretch;
      b = (b - black) * stretch;
      // Local contrast vs blur
      r += (r - blurData[i]) * dehazeAmt * 0.35 * haze;
      g += (g - blurData[i + 1]) * dehazeAmt * 0.35 * haze;
      b += (b - blurData[i + 2]) * dehazeAmt * 0.35 * haze;
    }

    if (satAmt > 0.01) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * (1 + satAmt);
      g = gray + (g - gray) * (1 + satAmt);
      b = gray + (b - gray) * (1 + satAmt);
    }

    dst[i] = clamp(Math.round(r), 0, 255);
    dst[i + 1] = clamp(Math.round(g), 0, 255);
    dst[i + 2] = clamp(Math.round(b), 0, 255);
    dst[i + 3] = a;
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}
