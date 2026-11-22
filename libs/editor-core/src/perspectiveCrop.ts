import { createCanvas, loadImage } from './canvasUtils';
import { mapUnitToQuad, type Quad } from './perspectiveWarp';

/**
 * Perspective crop: sample the region inside `sourceQuad` (TL,TR,BR,BL in image
 * pixels) into an axis-aligned `outWidth` × `outHeight` rectangle.
 */
export async function perspectiveCropToRect(
  src: string,
  sourceQuad: Quad,
  outWidth: number,
  outHeight: number
): Promise<{ src: string; width: number; height: number } | null> {
  const img = await loadImage(src, 'perspective crop');
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const { ctx: srcCtx } = createCanvas(sw, sh);
  if (!srcCtx) return null;
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, sw, sh).data;

  const w = Math.max(1, Math.round(outWidth));
  const h = Math.max(1, Math.round(outHeight));
  const { canvas, ctx } = createCanvas(w, h);
  if (!ctx) return null;
  const out = ctx.createImageData(w, h);
  const od = out.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const p = mapUnitToQuad(sourceQuad, u, v);
      const fx = Math.min(sw - 1, Math.max(0, p.x - 0.5));
      const fy = Math.min(sh - 1, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const a =
        srcData[i00 + 3] * w00 +
        srcData[i10 + 3] * w10 +
        srcData[i01 + 3] * w01 +
        srcData[i11 + 3] * w11;
      const o = (y * w + x) * 4;
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) {
        const premul =
          srcData[i00 + c] * srcData[i00 + 3] * w00 +
          srcData[i10 + c] * srcData[i10 + 3] * w10 +
          srcData[i01 + c] * srcData[i01 + 3] * w01 +
          srcData[i11 + c] * srcData[i11 + 3] * w11;
        od[o + c] = premul / a;
      }
      od[o + 3] = a;
    }
  }

  ctx.putImageData(out, 0, 0);
  return { src: canvas.toDataURL('image/png'), width: w, height: h };
}
