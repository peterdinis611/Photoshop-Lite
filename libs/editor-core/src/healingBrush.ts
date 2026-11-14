import {
  brushFalloff,
  clampByte,
  createCanvas,
  gaussianBlurRgba,
  loadImageToCanvas,
  unitRange,
} from './canvasUtils';

/**
 * Healing brush & patch tool. Coordinates are in image-local pixels.
 */

export interface HealingBrushOptions {
  /** Stroke path, flat [x,y,...] */
  points: number[];
  /** Brush diameter in pixels */
  size: number;
  /** 0-1 (or 0-100) */
  hardness: number;
  /** Source sample = destination + offset */
  sourceOffsetX: number;
  sourceOffsetY: number;
}

export interface PatchOptions {
  /** Closed polygon of the region to copy, flat [x,y,...] */
  fromPath: number[];
  /** Destination for the centre of the patch's bounding box */
  toX: number;
  toY: number;
  /** Edge feather in pixels (default 2) */
  feather?: number;
}

function sampleClamped(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number
): number {
  const sx = x < 0 ? 0 : x >= w ? w - 1 : x;
  const sy = y < 0 ? 0 : y >= h ? h - 1 : y;
  return (sy * w + sx) * 4;
}

/** Mean RGB of pixels at distance [rIn, rOut] from (cx,cy). */
function ringMean(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rIn: number,
  rOut: number
): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  const ext = Math.ceil(rOut);
  for (let dy = -ext; dy <= ext; dy++) {
    for (let dx = -ext; dx <= ext; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < rIn || d > rOut) continue;
      const i = sampleClamped(data, w, h, cx + dx, cy + dy);
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return n === 0 ? [0, 0, 0] : [r / n, g / n, b / n];
}

function strokeStamps(points: number[], spacing: number): { x: number; y: number }[] {
  const stamps: { x: number; y: number }[] = [];
  if (points.length < 2) return stamps;
  stamps.push({ x: points[0], y: points[1] });
  let carry = 0;
  for (let i = 2; i + 1 < points.length; i += 2) {
    const x0 = points[i - 2], y0 = points[i - 1];
    const x1 = points[i], y1 = points[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) continue;
    let pos = spacing - carry;
    while (pos <= len) {
      const t = pos / len;
      stamps.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
      pos += spacing;
    }
    carry = len - (pos - spacing);
  }
  return stamps;
}

/**
 * Healing brush: clones texture from the offset source but shifts its colour so the mean
 * of the surrounding ring matches the destination (low frequencies from the target, high
 * frequencies from the source).
 */
export async function applyHealingBrushToImage(
  src: string,
  opts: HealingBrushOptions
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'healing brush');
  if (!loaded) return src;
  const { canvas, ctx, width: w, height: h } = loaded;

  try {
    const r = Math.max(2, opts.size / 2);
    const hardness = unitRange(opts.hardness, 0.5);
    const ox = Math.round(opts.sourceOffsetX);
    const oy = Math.round(opts.sourceOffsetY);
    if (ox === 0 && oy === 0) return src;

    const image = ctx.getImageData(0, 0, w, h);
    const out = image.data;
    const original = new Uint8ClampedArray(out);

    const stamps = strokeStamps(opts.points, Math.max(1, r * 0.4));
    const ringIn = r * 0.75;
    const ringOut = r * 1.15;

    for (const s of stamps) {
      const cx = Math.round(s.x);
      const cy = Math.round(s.y);

      const dstMean = ringMean(original, w, h, cx, cy, ringIn, ringOut);
      const srcMean = ringMean(original, w, h, cx + ox, cy + oy, ringIn, ringOut);
      const dR = dstMean[0] - srcMean[0];
      const dG = dstMean[1] - srcMean[1];
      const dB = dstMean[2] - srcMean[2];

      const minX = Math.max(0, Math.floor(cx - r));
      const maxX = Math.min(w - 1, Math.ceil(cx + r));
      const minY = Math.max(0, Math.floor(cy - r));
      const maxY = Math.min(h - 1, Math.ceil(cy + r));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const falloff = brushFalloff(Math.hypot(x - s.x, y - s.y), r, hardness);
          if (falloff <= 0) continue;
          const di = (y * w + x) * 4;
          const si = sampleClamped(original, w, h, x + ox, y + oy);
          out[di] = clampByte(out[di] + (original[si] + dR - out[di]) * falloff);
          out[di + 1] = clampByte(out[di + 1] + (original[si + 1] + dG - out[di + 1]) * falloff);
          out[di + 2] = clampByte(out[di + 2] + (original[si + 2] + dB - out[di + 2]) * falloff);
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Healing brush error:', e);
    return src;
  }
}

/**
 * Patch: copies the polygon region `fromPath` so that its bounding-box centre lands on
 * (toX, toY), with a feathered edge.
 */
export async function applyPatchToImage(src: string, opts: PatchOptions): Promise<string> {
  const path = opts.fromPath;
  if (!path || path.length < 6) return src;

  const loaded = await loadImageToCanvas(src, 'patch');
  if (!loaded) return src;
  const { canvas, ctx, width: w, height: h } = loaded;

  try {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < path.length; i += 2) {
      minX = Math.min(minX, path[i]);
      maxX = Math.max(maxX, path[i]);
      minY = Math.min(minY, path[i + 1]);
      maxY = Math.max(maxY, path[i + 1]);
    }
    const feather = Math.max(0, opts.feather ?? 2);
    const pad = Math.ceil(feather * 1.5) + 1;
    const bx = Math.floor(minX) - pad;
    const by = Math.floor(minY) - pad;
    const bw = Math.ceil(maxX) - Math.floor(minX) + 1 + pad * 2;
    const bh = Math.ceil(maxY) - Math.floor(minY) + 1 + pad * 2;

    // Polygon coverage mask (alpha), softened by a small Gaussian.
    const { ctx: mctx } = createCanvas(bw, bh);
    if (!mctx) return src;
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(path[0] - bx, path[1] - by);
    for (let i = 2; i + 1 < path.length; i += 2) mctx.lineTo(path[i] - bx, path[i + 1] - by);
    mctx.closePath();
    mctx.fill();
    const maskData = mctx.getImageData(0, 0, bw, bh);
    const soft =
      feather > 0 ? gaussianBlurRgba(maskData.data, bw, bh, feather / 2) : maskData.data;

    const image = ctx.getImageData(0, 0, w, h);
    const out = image.data;
    const original = new Uint8ClampedArray(out);

    const dx = Math.round(opts.toX - (minX + maxX) / 2);
    const dy = Math.round(opts.toY - (minY + maxY) / 2);

    for (let y = 0; y < bh; y++) {
      const srcY = by + y;
      const dstY = srcY + dy;
      if (srcY < 0 || srcY >= h || dstY < 0 || dstY >= h) continue;
      for (let x = 0; x < bw; x++) {
        const m = soft[(y * bw + x) * 4 + 3] / 255;
        if (m <= 0) continue;
        const srcX = bx + x;
        const dstX = srcX + dx;
        if (srcX < 0 || srcX >= w || dstX < 0 || dstX >= w) continue;
        const si = (srcY * w + srcX) * 4;
        const di = (dstY * w + dstX) * 4;
        for (let c = 0; c < 4; c++) {
          out[di + c] = out[di + c] + (original[si + c] - out[di + c]) * m;
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Patch error:', e);
    return src;
  }
}
