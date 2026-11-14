/**
 * Liquify "forward warp" brush. Pixels inside a circular region are pushed along the drag
 * vector with a smooth radial falloff (backward-mapped, bilinear sampled).
 * All coordinates are image-local pixels.
 */

export interface LiquifyPushOptions {
  cx: number;
  cy: number;
  /** Brush radius in pixels */
  radius: number;
  /** Drag vector since the previous stamp */
  dx: number;
  dy: number;
  /** 0-1 push strength (default 1) */
  strength?: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function applyLiquifyPush(src: string, opts: LiquifyPushOptions): Promise<string> {
  const img = await loadImageElement(src);
  if (!img) return src;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);

  const r = Math.max(4, opts.radius);
  const strength = Math.min(1, Math.max(0, opts.strength ?? 1));
  const reach = Math.hypot(opts.dx, opts.dy);
  if (reach < 0.5) return src;

  // Destination box (circle bounds) and a padded source box (content is pulled from behind)
  const minX = Math.max(0, Math.floor(opts.cx - r));
  const maxX = Math.min(w - 1, Math.ceil(opts.cx + r));
  const minY = Math.max(0, Math.floor(opts.cy - r));
  const maxY = Math.min(h - 1, Math.ceil(opts.cy + r));
  if (maxX < minX || maxY < minY) return src;

  const pad = Math.ceil(reach * strength) + 2;
  const sx0 = Math.max(0, minX - pad);
  const sy0 = Math.max(0, minY - pad);
  const sx1 = Math.min(w - 1, maxX + pad);
  const sy1 = Math.min(h - 1, maxY + pad);
  const sw = sx1 - sx0 + 1;
  const sh = sy1 - sy0 + 1;

  const srcData = ctx.getImageData(sx0, sy0, sw, sh).data;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const out = ctx.getImageData(minX, minY, bw, bh);
  const dst = out.data;

  const sample = (fx: number, fy: number, c: number): number => {
    const x = Math.min(sw - 1, Math.max(0, fx - sx0));
    const y = Math.min(sh - 1, Math.max(0, fy - sy0));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(sw - 1, x0 + 1);
    const y1 = Math.min(sh - 1, y0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const a = srcData[(y0 * sw + x0) * 4 + c];
    const b = srcData[(y0 * sw + x1) * 4 + c];
    const cc = srcData[(y1 * sw + x0) * 4 + c];
    const d = srcData[(y1 * sw + x1) * 4 + c];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
  };

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const px = x + minX;
      const py = y + minY;
      const dist = Math.hypot(px - opts.cx, py - opts.cy);
      if (dist >= r) continue;
      const t = 1 - dist / r;
      const amount = strength * t * t * (3 - 2 * t);
      const fx = px - opts.dx * amount;
      const fy = py - opts.dy * amount;
      const i = (y * bw + x) * 4;
      for (let c = 0; c < 4; c++) {
        dst[i + c] = sample(fx, fy, c);
      }
    }
  }

  ctx.putImageData(out, minX, minY);
  return canvas.toDataURL('image/png');
}
