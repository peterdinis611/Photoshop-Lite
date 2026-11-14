import { createCanvas } from './canvasUtils';

/** Procedural gradient rasterisation to PNG data URLs. */

export interface GradientColorStop {
  /** 0-1 */
  offset: number;
  /** Any CSS color */
  color: string;
}

export interface LinearGradientOptions {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorStops: GradientColorStop[];
}

export interface RadialGradientOptions {
  cx: number;
  cy: number;
  r: number;
  colorStops: GradientColorStop[];
}

function addStops(grad: CanvasGradient, stops: GradientColorStop[]): void {
  const sorted = [...stops]
    .filter((s) => Number.isFinite(s.offset))
    .sort((a, b) => a.offset - b.offset);
  for (const s of sorted) {
    grad.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color);
  }
}

export function createLinearGradientDataUrl(
  w: number,
  h: number,
  opts: LinearGradientOptions
): string {
  const { canvas, ctx } = createCanvas(w, h);
  if (!ctx) return canvas.toDataURL('image/png');
  if (opts.colorStops.length > 0) {
    const grad = ctx.createLinearGradient(opts.x1, opts.y1, opts.x2, opts.y2);
    addStops(grad, opts.colorStops);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/png');
}

export function createRadialGradientDataUrl(
  w: number,
  h: number,
  opts: RadialGradientOptions
): string {
  const { canvas, ctx } = createCanvas(w, h);
  if (!ctx) return canvas.toDataURL('image/png');
  if (opts.colorStops.length > 0) {
    const grad = ctx.createRadialGradient(
      opts.cx,
      opts.cy,
      0,
      opts.cx,
      opts.cy,
      Math.max(0.01, opts.r)
    );
    addStops(grad, opts.colorStops);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/png');
}
