import type { Point } from './types';

/** Document coordinates → image-layer-local pixels (honours position, rotation and scale). */
export function toImageLocal(
  layer: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
  x: number,
  y: number
): Point {
  const rad = (-layer.rotation * Math.PI) / 180;
  const dx = x - layer.x;
  const dy = y - layer.y;
  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;
  return {
    x: (dx * Math.cos(rad) - dy * Math.sin(rad)) / sx,
    y: (dx * Math.sin(rad) + dy * Math.cos(rad)) / sy,
  };
}

/** Image-layer-local pixels → document coordinates (inverse of `toImageLocal`). */
export function toDocument(
  layer: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
  lx: number,
  ly: number
): Point {
  const rad = (layer.rotation * Math.PI) / 180;
  const sx = lx * (layer.scaleX || 1);
  const sy = ly * (layer.scaleY || 1);
  return {
    x: layer.x + sx * Math.cos(rad) - sy * Math.sin(rad),
    y: layer.y + sx * Math.sin(rad) + sy * Math.cos(rad),
  };
}

/** Document-space vector → image-local vector (no translation). */
export function toImageLocalVector(
  layer: { rotation: number; scaleX: number; scaleY: number },
  dx: number,
  dy: number
): Point {
  return toImageLocal({ x: 0, y: 0, ...layer }, dx, dy);
}

export const averageScale = (layer: { scaleX: number; scaleY: number }) =>
  Math.max(0.01, (Math.abs(layer.scaleX || 1) + Math.abs(layer.scaleY || 1)) / 2);

export function pathBounds(points: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** Selection → closed polygon in document coordinates (flat [x,y,...]). */
export function selectionToPolygon(sel: {
  x: number;
  y: number;
  width: number;
  height: number;
  mode?: 'rect' | 'ellipse';
  path?: number[];
}): number[] {
  if (sel.path && sel.path.length >= 6) return sel.path;
  if (sel.mode === 'ellipse') {
    const pts: number[] = [];
    const cx = sel.x + sel.width / 2;
    const cy = sel.y + sel.height / 2;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(cx + (Math.cos(a) * sel.width) / 2, cy + (Math.sin(a) * sel.height) / 2);
    }
    return pts;
  }
  return [
    sel.x, sel.y,
    sel.x + sel.width, sel.y,
    sel.x + sel.width, sel.y + sel.height,
    sel.x, sel.y + sel.height,
  ];
}
