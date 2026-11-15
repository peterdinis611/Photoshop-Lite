/**
 * Perspective / distort warp: maps the unit square of an image onto an arbitrary quad.
 * Corner order is clockwise from the top-left: TL, TR, BR, BL.
 *
 * The pixel kernel (`warpPixelsToQuad`) is pure so it can be unit-tested in node;
 * `warpImagePerspective` wraps it with canvas decode / encode.
 */
import { createCanvas, loadImage } from './canvasUtils';
import type { PixelBuffer } from './magneticEdge';

export type Quad = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];

export type WarpMethod = 'projective' | 'bilinear';

export interface WarpOptions {
  /** `pixel` (default): corners in source-pixel space. `relative`: 0-1 of the source size. */
  space?: 'pixel' | 'relative';
  /** `projective` keeps straight lines converging (perspective); `bilinear` is a free distort. */
  method?: WarpMethod;
}

export interface WarpResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Top-left of the output within the source pixel space. */
  offsetX: number;
  offsetY: number;
}

export interface WarpedImage {
  src: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const MAX_OUTPUT_SIDE = 8192;

/** Axis-aligned bounds of a quad. */
export function quadBounds(q: Quad) {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Heckbert unit-square → quad projective matrix (row-major 3x3, last element 1). */
export function squareToQuadMatrix(q: Quad): Mat3 {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0, 1];
  }
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
}

function invertMat3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ];
}

/** Map a unit-square point forward onto the quad (projective). */
export function mapUnitToQuad(q: Quad, u: number, v: number): { x: number; y: number } {
  const m = squareToQuadMatrix(q);
  const w = m[6] * u + m[7] * v + m[8];
  return {
    x: (m[0] * u + m[1] * v + m[2]) / w,
    y: (m[3] * u + m[4] * v + m[5]) / w,
  };
}

/** Inverse of the projective map: quad point → unit-square (u, v). */
export function createProjectiveInverse(q: Quad) {
  const inv = invertMat3(squareToQuadMatrix(q));
  if (!inv) return null;
  return (x: number, y: number): { u: number; v: number } => {
    const w = inv[6] * x + inv[7] * y + inv[8];
    return {
      u: (inv[0] * x + inv[1] * y + inv[2]) / w,
      v: (inv[3] * x + inv[4] * y + inv[5]) / w,
    };
  };
}

/** Inverse of the bilinear quad map Q(u,v) = P0 + e·u + f·v + g·u·v. */
export function createBilinearInverse(q: Quad) {
  const [a, b, c, d] = q;
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const fx = d.x - a.x;
  const fy = d.y - a.y;
  const gx = a.x - b.x + c.x - d.x;
  const gy = a.y - b.y + c.y - d.y;
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const k2 = cross(gx, gy, fx, fy);

  const solveU = (hx: number, hy: number, v: number) => {
    const denX = ex + gx * v;
    const denY = ey + gy * v;
    return Math.abs(denX) > Math.abs(denY) ? (hx - fx * v) / denX : (hy - fy * v) / denY;
  };

  return (x: number, y: number): { u: number; v: number } | null => {
    const hx = x - a.x;
    const hy = y - a.y;
    const k1 = cross(ex, ey, fx, fy) + cross(hx, hy, gx, gy);
    const k0 = cross(hx, hy, ex, ey);

    if (Math.abs(k2) < 1e-9) {
      if (Math.abs(k1) < 1e-12) return null;
      const v = -k0 / k1;
      return { u: solveU(hx, hy, v), v };
    }
    const disc = k1 * k1 - 4 * k0 * k2;
    if (disc < 0) return null;
    const w = Math.sqrt(disc);
    const ik2 = 0.5 / k2;
    let v = (-k1 - w) * ik2;
    let u = solveU(hx, hy, v);
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      v = (-k1 + w) * ik2;
      u = solveU(hx, hy, v);
    }
    return { u, v };
  };
}

/** Normalise `corners` to source-pixel space. */
export function resolveQuad(
  corners: Quad | ReadonlyArray<{ x: number; y: number }>,
  srcWidth: number,
  srcHeight: number,
  space: 'pixel' | 'relative' = 'pixel'
): Quad {
  if (corners.length !== 4) throw new Error('Perspective warp needs exactly 4 corners');
  const sx = space === 'relative' ? srcWidth : 1;
  const sy = space === 'relative' ? srcHeight : 1;
  const [a, b, c, d] = corners.map((p) => ({ x: p.x * sx, y: p.y * sy }));
  return [a, b, c, d];
}

/**
 * Inverse-map every output pixel into the source with bilinear (premultiplied) sampling.
 * Output covers the quad's bounding box; pixels outside the quad stay transparent.
 * Returns null for degenerate quads or outputs larger than 8192 px per side.
 */
export function warpPixelsToQuad(
  src: PixelBuffer,
  quad: Quad,
  method: WarpMethod = 'projective'
): WarpResult | null {
  const { minX, minY, maxX, maxY } = quadBounds(quad);
  const offsetX = Math.floor(minX);
  const offsetY = Math.floor(minY);
  const width = Math.ceil(maxX) - offsetX;
  const height = Math.ceil(maxY) - offsetY;
  if (width < 1 || height < 1 || width > MAX_OUTPUT_SIDE || height > MAX_OUTPUT_SIDE) return null;

  const inverse =
    method === 'projective'
      ? createProjectiveInverse(quad)
      : (() => {
          const fn = createBilinearInverse(quad);
          return (x: number, y: number) => fn(x, y);
        })();
  if (!inverse) return null;

  const { width: sw, height: sh } = src;
  const sd = src.data;
  const out = new Uint8ClampedArray(width * height * 4);
  const eps = 1e-4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const uv = inverse(offsetX + x + 0.5, offsetY + y + 0.5);
      if (!uv || !Number.isFinite(uv.u) || !Number.isFinite(uv.v)) continue;
      const { u, v } = uv;
      if (u < -eps || u > 1 + eps || v < -eps || v > 1 + eps) continue;

      const fx = Math.min(sw - 1, Math.max(0, u * sw - 0.5));
      const fy = Math.min(sh - 1, Math.max(0, v * sh - 0.5));
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
        sd[i00 + 3] * w00 + sd[i10 + 3] * w10 + sd[i01 + 3] * w01 + sd[i11 + 3] * w11;
      const o = (y * width + x) * 4;
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) {
        const premul =
          sd[i00 + c] * sd[i00 + 3] * w00 +
          sd[i10 + c] * sd[i10 + 3] * w10 +
          sd[i01 + c] * sd[i01 + 3] * w01 +
          sd[i11 + c] * sd[i11 + 3] * w11;
        out[o + c] = premul / a;
      }
      out[o + 3] = a;
    }
  }
  return { data: out, width, height, offsetX, offsetY };
}

/**
 * Warp `src` so its unit square lands on `corners` (TL, TR, BR, BL). Returns the new image
 * plus where its top-left sits in source-pixel space (so callers can reposition the layer).
 */
export async function warpImagePerspectiveDetailed(
  src: string,
  corners: Quad | ReadonlyArray<{ x: number; y: number }>,
  opts: WarpOptions = {}
): Promise<WarpedImage | null> {
  const img = await loadImage(src, 'perspective warp');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const { ctx } = createCanvas(w, h);
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const srcData = ctx.getImageData(0, 0, w, h);

  const quad = resolveQuad(corners, w, h, opts.space);
  const result = warpPixelsToQuad(srcData, quad, opts.method ?? 'projective');
  if (!result) return null;

  const { canvas: outCanvas, ctx: outCtx } = createCanvas(result.width, result.height);
  if (!outCtx) return null;
  outCtx.putImageData(new ImageData(result.data as Uint8ClampedArray<ArrayBuffer>, result.width, result.height), 0, 0);
  return {
    src: outCanvas.toDataURL('image/png'),
    width: result.width,
    height: result.height,
    offsetX: result.offsetX,
    offsetY: result.offsetY,
  };
}

/** Bilinear / projective warp of an image onto a quad; resolves to a PNG data URL. */
export async function warpImagePerspective(
  src: string,
  corners: Quad | ReadonlyArray<{ x: number; y: number }>,
  opts: WarpOptions = {}
): Promise<string> {
  const warped = await warpImagePerspectiveDetailed(src, corners, opts);
  return warped ? warped.src : src;
}
