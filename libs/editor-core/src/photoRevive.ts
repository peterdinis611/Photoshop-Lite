import { ImageAdjustments } from '@photoshop-lite/shared-types';
import { DEFAULT_ADJUSTMENTS } from './filterHelpers';

export type ReviveMode = 'natural' | 'vivid' | 'shadows' | 'clarity' | 'film';

export interface ReviveModeMeta {
  id: ReviveMode;
  label: string;
  blurb: string;
}

export const REVIVE_MODES: ReviveModeMeta[] = [
  {
    id: 'natural',
    label: 'Natural',
    blurb: 'Balanced exposure, color cast fix, soft vibrance',
  },
  {
    id: 'vivid',
    label: 'Vivid',
    blurb: 'Punchy contrast and color for flat phone shots',
  },
  {
    id: 'shadows',
    label: 'Shadow Lift',
    blurb: 'Opens crushed darks without blowing highlights',
  },
  {
    id: 'clarity',
    label: 'Clarity',
    blurb: 'Midtone snap and micro-detail recovery',
  },
  {
    id: 'film',
    label: 'Film Glow',
    blurb: 'Warm cinematic grade with gentle highlight roll-off',
  },
];

interface HistogramStats {
  avgLum: number;
  avgR: number;
  avgG: number;
  avgB: number;
  avgSat: number;
  p1: number;
  p5: number;
  p50: number;
  p95: number;
  p99: number;
}

function loadStats(img: HTMLImageElement): HistogramStats | null {
  const canvas = document.createElement('canvas');
  const maxDimension = 480;
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDimension / Math.max(nw, nh));
  const w = Math.max(12, Math.floor(nw * scale));
  const h = Math.max(12, Math.floor(nh * scale));

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let totalLum = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalSat = 0;
  const hist = new Int32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[lum]++;
    totalLum += lum;
    totalR += r;
    totalG += g;
    totalB += b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    totalSat += maxC === 0 ? 0 : (maxC - minC) / maxC;
  }

  const n = w * h;
  const percentile = (t: number) => {
    let c = 0;
    const target = n * t;
    for (let l = 0; l < 256; l++) {
      c += hist[l];
      if (c >= target) return l;
    }
    return 255;
  };

  return {
    avgLum: totalLum / n,
    avgR: totalR / n,
    avgG: totalG / n,
    avgB: totalB / n,
    avgSat: totalSat / n,
    p1: percentile(0.01),
    p5: percentile(0.05),
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Compute non-destructive revive adjustments from image histogram + mode + intensity (0–1).
 */
export function computeReviveAdjustments(
  img: HTMLImageElement,
  mode: ReviveMode,
  intensity = 0.75
): ImageAdjustments {
  const stats = loadStats(img);
  if (!stats) return { ...DEFAULT_ADJUSTMENTS };

  const t = clamp(intensity, 0.15, 1);

  // Color cast → temperature / tint corrections
  const castWarm = stats.avgR - stats.avgB;
  const castMagenta = stats.avgR + stats.avgB - 2 * stats.avgG;
  let temperature = clamp(Math.round((-castWarm / 40) * 28 * t), -40, 40);
  let tint = clamp(Math.round((-castMagenta / 30) * 18 * t), -25, 25);

  // Exposure / brightness from midtones
  const midPull = (128 - stats.p50) / 128;
  let brightness = clamp(Math.round(midPull * 32 * t), -28, 32);
  let exposure = clamp(Math.round(((128 - stats.avgLum) / 128) * 18 * t), -15, 22);

  // Contrast from dynamic range
  const range = Math.max(24, stats.p99 - stats.p1);
  let contrast = clamp(Math.round(((255 - range) / 255) * 48 * t + 8 * t), 0, 50);

  // Saturation / vibrance from washout
  let saturation = stats.avgSat < 0.22 ? 28 : stats.avgSat < 0.38 ? 16 : 6;
  let vibrance = stats.avgSat < 0.35 ? 26 : 14;
  saturation = Math.round(saturation * t);
  vibrance = Math.round(vibrance * t);

  let sharpness = Math.round(18 * t);
  let blur = 0;

  switch (mode) {
    case 'natural':
      contrast = Math.round(contrast * 0.85);
      sharpness = Math.round(14 * t);
      break;
    case 'vivid':
      contrast = clamp(contrast + Math.round(12 * t), 0, 55);
      saturation = clamp(saturation + Math.round(18 * t), -40, 55);
      vibrance = clamp(vibrance + Math.round(16 * t), 0, 55);
      sharpness = Math.round(28 * t);
      break;
    case 'shadows':
      brightness = clamp(brightness + Math.round(14 * t), -20, 40);
      exposure = clamp(exposure + Math.round(10 * t), -10, 28);
      contrast = clamp(Math.round(contrast * 0.55), 0, 30);
      // Soften crush: slight negative contrast if already contrasty
      if (stats.p5 < 18) brightness = clamp(brightness + Math.round(8 * t), -10, 45);
      sharpness = Math.round(10 * t);
      break;
    case 'clarity':
      contrast = clamp(contrast + Math.round(16 * t), 5, 55);
      sharpness = Math.round(42 * t);
      saturation = Math.round(saturation * 0.7);
      vibrance = Math.round(vibrance * 0.85);
      brightness = Math.round(brightness * 0.6);
      break;
    case 'film':
      temperature = clamp(temperature + Math.round(22 * t), -30, 50);
      tint = clamp(tint - Math.round(6 * t), -25, 20);
      contrast = clamp(contrast + Math.round(10 * t), 5, 45);
      saturation = clamp(Math.round(saturation * 0.75) - Math.round(4 * t), -30, 30);
      vibrance = clamp(vibrance + Math.round(8 * t), 0, 40);
      exposure = clamp(exposure - Math.round(3 * t), -18, 18);
      sharpness = Math.round(12 * t);
      blur = t > 0.85 ? 0.4 : 0;
      break;
  }

  // Underexposed night bias
  if (stats.avgLum < 70 && mode !== 'film') {
    brightness = clamp(brightness + Math.round(8 * t), -20, 45);
    exposure = clamp(exposure + Math.round(6 * t), -10, 28);
  }

  // Overexposed bias
  if (stats.avgLum > 175) {
    brightness = clamp(brightness - Math.round(10 * t), -35, 20);
    exposure = clamp(exposure - Math.round(8 * t), -22, 10);
  }

  return {
    ...DEFAULT_ADJUSTMENTS,
    brightness,
    contrast,
    saturation,
    vibrance,
    sharpness,
    exposure,
    temperature,
    tint,
    blur,
  };
}

/**
 * Pixel bake: auto-levels stretch + soft midtone lift + optional unsharp.
 * Returns a new PNG data URL for a "Revived" layer.
 */
export async function bakeRevivePixels(
  src: string,
  mode: ReviveMode,
  intensity = 0.75
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const t = clamp(intensity, 0.15, 1);

  // Sample percentiles on a downscale for speed
  const stats = loadStats(img);
  const lo = stats ? Math.max(0, stats.p1 - 2) : 5;
  const hi = stats ? Math.min(255, stats.p99 + 2) : 250;
  const span = Math.max(32, hi - lo);

  // Color cast offsets
  const castR = stats ? (stats.avgG + stats.avgB) / 2 - stats.avgR : 0;
  const castB = stats ? (stats.avgR + stats.avgG) / 2 - stats.avgB : 0;
  const castStrength =
    mode === 'natural' || mode === 'vivid' || mode === 'film' ? 0.35 * t : 0.15 * t;

  const shadowLift = mode === 'shadows' ? 0.28 * t : mode === 'natural' ? 0.12 * t : 0.06 * t;
  const midBoost =
    mode === 'clarity' || mode === 'vivid' ? 0.18 * t : mode === 'film' ? 0.1 * t : 0.08 * t;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Auto levels
    r = ((r - lo) / span) * 255;
    g = ((g - lo) / span) * 255;
    b = ((b - lo) / span) * 255;

    // Cast neutralize
    r += castR * castStrength;
    b += castB * castStrength;

    // Soft shadow lift (lift darks toward mid)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 90) {
      const lift = (1 - lum / 90) * shadowLift * 40;
      r += lift;
      g += lift;
      b += lift;
    }

    // Midtone soft-light style pop
    if (lum > 40 && lum < 200) {
      const m = ((lum - 40) / 160) * (1 - (lum - 40) / 160) * 4; // peak mid
      const pop = m * midBoost * 28;
      r += pop;
      g += pop;
      b += pop;
    }

    // Film warmth
    if (mode === 'film') {
      r += 8 * t;
      b -= 6 * t;
      g += 2 * t;
    }

    // Vivid saturation nudge
    if (mode === 'vivid') {
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * (1 + 0.22 * t);
      g = avg + (g - avg) * (1 + 0.22 * t);
      b = avg + (b - avg) * (1 + 0.22 * t);
    }

    data[i] = clamp(Math.round(r), 0, 255);
    data[i + 1] = clamp(Math.round(g), 0, 255);
    data[i + 2] = clamp(Math.round(b), 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);

  // Clarity / vivid: light unsharp mask
  if (mode === 'clarity' || mode === 'vivid') {
    applyUnsharp(ctx, canvas.width, canvas.height, 0.35 + 0.45 * t, 1.2);
  }

  return canvas.toDataURL('image/png');
}

function applyUnsharp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
  radius: number
) {
  const src = ctx.getImageData(0, 0, w, h);
  // Blur via draw scale trick
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Blend two adjustment sets by intensity (for preview mixing). */
export function mixAdjustments(
  base: ImageAdjustments,
  target: ImageAdjustments,
  intensity: number
): ImageAdjustments {
  const t = clamp(intensity, 0, 1);
  return {
    ...DEFAULT_ADJUSTMENTS,
    brightness: Math.round(lerp(base.brightness, target.brightness, t)),
    contrast: Math.round(lerp(base.contrast, target.contrast, t)),
    saturation: Math.round(lerp(base.saturation, target.saturation, t)),
    exposure: Math.round(lerp(base.exposure, target.exposure, t)),
    sharpness: Math.round(lerp(base.sharpness, target.sharpness, t)),
    blur: lerp(base.blur, target.blur, t),
    vibrance: Math.round(lerp(base.vibrance, target.vibrance, t)),
    temperature: Math.round(lerp(base.temperature, target.temperature, t)),
    tint: Math.round(lerp(base.tint, target.tint, t)),
    hue: Math.round(lerp(base.hue, target.hue, t)),
    invert: target.invert,
    grayscale: target.grayscale,
    sepia: target.sepia,
  };
}
