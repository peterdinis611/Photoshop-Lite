import type { CurvePoint, CurvesAdjustment } from '@photoshop-lite/shared-types';
import { clampByte, loadImageToCanvas } from './canvasUtils';

/**
 * Curves & Levels:
 * 1. Curves: monotone cubic (Fritsch-Carlson) LUT per channel + composite RGB curve
 * 2. Levels: input black/white, gamma and output black/white
 */

const LINEAR: () => CurvePoint[] = () => [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

export const DEFAULT_CURVES: CurvesAdjustment = {
  rgb: LINEAR(),
  red: LINEAR(),
  green: LINEAR(),
  blue: LINEAR(),
};

export interface LevelsParams {
  /** Input black point, 0-255 */
  inBlack: number;
  /** Input white point, 0-255 */
  inWhite: number;
  /** Midtone gamma; 1 = neutral, >1 brightens, <1 darkens */
  inGamma: number;
  /** Output black point, 0-255 */
  outBlack: number;
  /** Output white point, 0-255 */
  outWhite: number;
}

export const DEFAULT_LEVELS: LevelsParams = {
  inBlack: 0,
  inWhite: 255,
  inGamma: 1,
  outBlack: 0,
  outWhite: 255,
};

function identityLut(): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = i;
  return lut;
}

function isIdentityLut(lut: Uint8Array): boolean {
  for (let i = 0; i < 256; i++) if (lut[i] !== i) return false;
  return true;
}

/**
 * Builds a 256-entry lookup table from control points using monotone cubic
 * interpolation (no overshoot between points). Values outside the first/last
 * point are held flat.
 */
export function buildCurveLut(points: CurvePoint[]): Uint8Array {
  const byX = new Map<number, number>();
  for (const p of points ?? []) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    byX.set(Math.round(clampByte(p.x) * 1000) / 1000, clampByte(p.y));
  }
  if (byX.size < 2) {
    // Anchor missing ends so a single point still shapes the curve.
    if (!byX.has(0)) byX.set(0, 0);
    if (!byX.has(255)) byX.set(255, 255);
  }

  const pts = [...byX.entries()].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n < 2) return identityLut();

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);

  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));

  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  }
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[k] = t * a * d[k];
      m[k + 1] = t * b * d[k];
    }
  }

  const lut = new Uint8Array(256);
  let seg = 0;
  for (let x = 0; x < 256; x++) {
    let y: number;
    if (x <= xs[0]) {
      y = ys[0];
    } else if (x >= xs[n - 1]) {
      y = ys[n - 1];
    } else {
      while (seg < n - 2 && x > xs[seg + 1]) seg++;
      const h = xs[seg + 1] - xs[seg];
      const t = (x - xs[seg]) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      y =
        (2 * t3 - 3 * t2 + 1) * ys[seg] +
        (t3 - 2 * t2 + t) * h * m[seg] +
        (-2 * t3 + 3 * t2) * ys[seg + 1] +
        (t3 - t2) * h * m[seg + 1];
    }
    lut[x] = Math.round(clampByte(y));
  }
  return lut;
}

/** Applies composite RGB curve followed by per-channel R/G/B curves, in place. */
export function applyCurvesToImageData(data: ImageData, curves: CurvesAdjustment): void {
  const rgb = buildCurveLut(curves?.rgb ?? DEFAULT_CURVES.rgb);
  const red = buildCurveLut(curves?.red ?? DEFAULT_CURVES.red);
  const green = buildCurveLut(curves?.green ?? DEFAULT_CURVES.green);
  const blue = buildCurveLut(curves?.blue ?? DEFAULT_CURVES.blue);

  if (
    isIdentityLut(rgb) &&
    isIdentityLut(red) &&
    isIdentityLut(green) &&
    isIdentityLut(blue)
  ) {
    return;
  }

  const lutR = new Uint8Array(256);
  const lutG = new Uint8Array(256);
  const lutB = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lutR[i] = red[rgb[i]];
    lutG[i] = green[rgb[i]];
    lutB[i] = blue[rgb[i]];
  }

  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = lutR[px[i]];
    px[i + 1] = lutG[px[i + 1]];
    px[i + 2] = lutB[px[i + 2]];
  }
}

function buildLevelsLut(levels: LevelsParams): Uint8Array {
  const inBlack = clampByte(levels.inBlack);
  const inWhite = Math.max(inBlack + 1, clampByte(levels.inWhite));
  const gamma = Math.min(10, Math.max(0.1, Number.isFinite(levels.inGamma) ? levels.inGamma : 1));
  const outBlack = clampByte(levels.outBlack);
  const outWhite = clampByte(levels.outWhite);
  const invGamma = 1 / gamma;

  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let t = (i - inBlack) / (inWhite - inBlack);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    t = Math.pow(t, invGamma);
    lut[i] = Math.round(clampByte(outBlack + t * (outWhite - outBlack)));
  }
  return lut;
}

/** Applies Levels to R, G and B channels, in place. */
export function applyLevelsToImageData(data: ImageData, levels: LevelsParams): void {
  const lut = buildLevelsLut({ ...DEFAULT_LEVELS, ...levels });
  if (isIdentityLut(lut)) return;
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = lut[px[i]];
    px[i + 1] = lut[px[i + 1]];
    px[i + 2] = lut[px[i + 2]];
  }
}

/** Renders curves then levels into the image and returns a PNG data URL. */
export async function bakeCurvesLevels(
  src: string,
  opts: { curves?: CurvesAdjustment; levels?: LevelsParams }
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'curves/levels');
  if (!loaded) return src;
  const { canvas, ctx, width, height } = loaded;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    if (opts.levels) applyLevelsToImageData(imageData, opts.levels);
    if (opts.curves) applyCurvesToImageData(imageData, opts.curves);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Curves/levels error:', e);
    return src;
  }
}
