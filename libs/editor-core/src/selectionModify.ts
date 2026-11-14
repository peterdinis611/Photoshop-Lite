import type { SelectionShape } from '@photoshop-lite/shared-types';
import { createCanvas, gaussianBlurRgba } from './canvasUtils';

/**
 * Selection modification helpers working on document-space SelectionShape values
 * (rect / ellipse / lasso path).
 */

function normalizeRect(sel: SelectionShape): SelectionShape {
  const x = sel.width < 0 ? sel.x + sel.width : sel.x;
  const y = sel.height < 0 ? sel.y + sel.height : sel.y;
  return { ...sel, x, y, width: Math.abs(sel.width), height: Math.abs(sel.height) };
}

function hasPath(sel: SelectionShape): sel is SelectionShape & { path: number[] } {
  return Array.isArray(sel.path) && sel.path.length >= 6;
}

/**
 * Lite invert: returns a full-canvas rect selection. (A true inverse of an arbitrary
 * shape is not representable as a single SelectionShape.)
 */
export function invertSelection(
  _sel: SelectionShape,
  canvasW: number,
  canvasH: number
): SelectionShape {
  return { x: 0, y: 0, width: Math.max(0, canvasW), height: Math.max(0, canvasH), mode: 'rect' };
}

function pathBounds(points: { x: number; y: number }[]): Pick<
  SelectionShape,
  'x' | 'y' | 'width' | 'height'
> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function signedArea(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Mitered polygon offset by `d` pixels (positive grows, negative shrinks). */
function offsetPolygon(
  flat: number[],
  d: number
): { x: number; y: number }[] | null {
  let pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const p = { x: flat[i], y: flat[i + 1] };
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) pts.push(p);
  }
  // Drop explicit closing point
  if (
    pts.length > 3 &&
    Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-6
  ) {
    pts = pts.slice(0, -1);
  }
  if (pts.length < 3) return null;

  const area = signedArea(pts);
  if (Math.abs(area) < 1e-6) return null;
  const orient = area > 0 ? 1 : -1;
  const n = pts.length;

  const out = pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const e1x = p.x - prev.x, e1y = p.y - prev.y;
    const e2x = next.x - p.x, e2y = next.y - p.y;
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;
    // Outward normals
    const n1x = (e1y / l1) * orient, n1y = (-e1x / l1) * orient;
    const n2x = (e2y / l2) * orient, n2y = (-e2x / l2) * orient;
    const dot = n1x * n2x + n1y * n2y;
    const denom = Math.max(0.25, 1 + dot);
    return {
      x: p.x + ((n1x + n2x) * d) / denom,
      y: p.y + ((n1y + n2y) * d) / denom,
    };
  });

  // A shrink that inverts the polygon means it collapsed.
  const newArea = signedArea(out);
  if (d < 0 && (Math.sign(newArea) !== Math.sign(area) || Math.abs(newArea) < 1)) return null;
  return out;
}

function offsetSelection(sel: SelectionShape, px: number): SelectionShape {
  if (!Number.isFinite(px) || px === 0) return { ...sel };

  if (hasPath(sel)) {
    const pts = offsetPolygon(sel.path, px);
    if (!pts) {
      const b = normalizeRect(sel);
      return {
        ...sel,
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        width: 0,
        height: 0,
        path: undefined,
      };
    }
    const path: number[] = [];
    for (const p of pts) path.push(p.x, p.y);
    return { ...sel, ...pathBounds(pts), path };
  }

  const r = normalizeRect(sel);
  const width = Math.max(0, r.width + px * 2);
  const height = Math.max(0, r.height + px * 2);
  // Collapse towards the centre when contracting past zero
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return { ...r, x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Grows the selection outward by `px` pixels. */
export function expandSelection(sel: SelectionShape, px: number): SelectionShape {
  return offsetSelection(sel, Math.abs(px));
}

/** Shrinks the selection inward by `px` pixels (collapses to zero size if exhausted). */
export function contractSelection(sel: SelectionShape, px: number): SelectionShape {
  return offsetSelection(sel, -Math.abs(px));
}

function fillSelectionShape(ctx: CanvasRenderingContext2D, sel: SelectionShape): void {
  ctx.beginPath();
  if (hasPath(sel)) {
    ctx.moveTo(sel.path[0], sel.path[1]);
    for (let i = 2; i + 1 < sel.path.length; i += 2) ctx.lineTo(sel.path[i], sel.path[i + 1]);
    ctx.closePath();
  } else if (sel.mode === 'ellipse') {
    ctx.ellipse(
      sel.x + sel.width / 2,
      sel.y + sel.height / 2,
      Math.abs(sel.width) / 2,
      Math.abs(sel.height) / 2,
      0,
      0,
      Math.PI * 2
    );
  } else {
    ctx.rect(sel.x, sel.y, sel.width, sel.height);
  }
  ctx.fill();
}

/**
 * Rasterises the selection to a soft mask PNG data URL (white = selected, black = not,
 * same convention as selectionToMaskDataUrl). The edge is blurred with a Gaussian so the
 * transition spans roughly `featherPx` pixels on each side.
 */
export async function featherSelectionMask(
  sel: SelectionShape,
  featherPx: number,
  canvasW: number,
  canvasH: number
): Promise<string> {
  const { canvas, ctx } = createCanvas(canvasW, canvasH);
  if (!ctx) throw new Error('Failed to create mask canvas');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  fillSelectionShape(ctx, sel);

  const feather = Math.max(0, featherPx || 0);
  if (feather > 0) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    img.data.set(gaussianBlurRgba(img.data, canvas.width, canvas.height, feather / 2));
    ctx.putImageData(img, 0, 0);
  }
  return canvas.toDataURL('image/png');
}
