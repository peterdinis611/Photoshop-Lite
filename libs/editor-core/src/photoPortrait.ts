import { clamp } from './optimize';

export type PortraitMode = 'natural' | 'glow' | 'matte';

export interface PortraitModeMeta {
  id: PortraitMode;
  label: string;
  blurb: string;
}

export const PORTRAIT_MODES: PortraitModeMeta[] = [
  {
    id: 'natural',
    label: 'Natural',
    blurb: 'Soft skin, keep pores & hair — no plastic look',
  },
  {
    id: 'glow',
    label: 'Soft glow',
    blurb: 'Slight bloom on highlights + gentle skin polish',
  },
  {
    id: 'matte',
    label: 'Matte',
    blurb: 'Even skin tone, lower shine, subtle clarity',
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for portrait polish'));
    img.src = src;
  });
}

/** Rough skin-tone probability in sRGB (works for a wide range of complexions). */
function skinProbability(r: number, g: number, b: number): number {
  // YCbCr-ish skin window + RGB ratios
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  const inY = y > 40 && y < 240 ? 1 : 0.15;
  const inCb = cb > 77 && cb < 140 ? 1 : 0.1;
  const inCr = cr > 125 && cr < 185 ? 1 : 0.1;
  const rg = r > g && g > b * 0.7 ? 1 : 0.35;

  return clamp(inY * inCb * inCr * rg, 0, 1);
}

function modeParams(mode: PortraitMode, intensity: number) {
  const t = clamp(intensity, 0.2, 1);
  switch (mode) {
    case 'natural':
      return { blurScale: 0.42 + 0.08 * t, smooth: 0.28 + 0.28 * t, texture: 0.55, glow: 0, matte: 0 };
    case 'glow':
      return { blurScale: 0.38 + 0.08 * t, smooth: 0.32 + 0.3 * t, texture: 0.45, glow: 0.2 + 0.25 * t, matte: 0 };
    case 'matte':
      return { blurScale: 0.4 + 0.1 * t, smooth: 0.35 + 0.3 * t, texture: 0.5, glow: 0, matte: 0.25 + 0.3 * t };
  }
}

/**
 * Portrait polish — frequency-separation style:
 * soft blur on skin tones + high-pass texture restored so it never looks plastic.
 */
export async function bakePortraitPixels(
  src: string,
  mode: PortraitMode = 'natural',
  intensity = 0.65
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
  const { blurScale, smooth, texture, glow, matte } = modeParams(mode, intensity);

  // Soft base (low frequency)
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext('2d');
  if (!bctx) return src;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  const tw = Math.max(2, Math.floor(w * blurScale));
  const th = Math.max(2, Math.floor(h * blurScale));
  bctx.drawImage(canvas, 0, 0, tw, th);
  bctx.drawImage(blurCanvas, 0, 0, tw, th, 0, 0, w, h);
  // Extra soft pass
  const tw2 = Math.max(2, Math.floor(w * (blurScale + 0.06)));
  const th2 = Math.max(2, Math.floor(h * (blurScale + 0.06)));
  bctx.drawImage(blurCanvas, 0, 0, tw2, th2);
  bctx.drawImage(blurCanvas, 0, 0, tw2, th2, 0, 0, w, h);
  const blurred = bctx.getImageData(0, 0, w, h);

  const out = ctx.createImageData(w, h);
  const srcData = original.data;
  const blurData = blurred.data;
  const dst = out.data;

  for (let i = 0; i < srcData.length; i += 4) {
    const r = srcData[i];
    const g = srcData[i + 1];
    const b = srcData[i + 2];
    const a = srcData[i + 3];
    if (a === 0) {
      dst[i + 3] = 0;
      continue;
    }

    const br = blurData[i];
    const bg = blurData[i + 1];
    const bb = blurData[i + 2];

    // High-pass texture (detail layer)
    const tr = r - br;
    const tg = g - bg;
    const tb = b - bb;

    const skin = skinProbability(r, g, b);
    const edge =
      Math.abs(tr) * 0.299 + Math.abs(tg) * 0.587 + Math.abs(tb) * 0.114;
    // Strong edges (hair, eyes, lips outline) → less smoothing
    const edgeProtect = clamp(1 - edge / 28, 0, 1);
    const m = smooth * skin * (0.25 + 0.75 * edgeProtect);

    // Low freq blend toward soft base
    let nr = r * (1 - m) + br * m;
    let ng = g * (1 - m) + bg * m;
    let nb = b * (1 - m) + bb * m;

    // Re-add texture (keeps pores / fabric)
    const texAmt = texture * (0.4 + 0.6 * (1 - m));
    nr += tr * texAmt;
    ng += tg * texAmt;
    nb += tb * texAmt;

    if (glow > 0.01) {
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum > 0.55) {
        const gAmt = glow * (lum - 0.55) * skin;
        nr += (255 - nr) * gAmt * 0.35;
        ng += (255 - ng) * gAmt * 0.32;
        nb += (255 - nb) * gAmt * 0.28;
      }
    }

    if (matte > 0.01) {
      const lum = (0.299 * nr + 0.587 * ng + 0.114 * nb) / 255;
      if (lum > 0.62) {
        // Pull down specular shine on skin
        const pull = matte * skin * (lum - 0.62);
        nr *= 1 - pull * 0.35;
        ng *= 1 - pull * 0.32;
        nb *= 1 - pull * 0.28;
      }
      // Slight desat of hot reds
      const avg = (nr + ng + nb) / 3;
      nr = nr * (1 - 0.08 * matte * skin) + avg * (0.08 * matte * skin);
    }

    dst[i] = clamp(Math.round(nr), 0, 255);
    dst[i + 1] = clamp(Math.round(ng), 0, 255);
    dst[i + 2] = clamp(Math.round(nb), 0, 255);
    dst[i + 3] = a;
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}
