import type { PathAnchor } from '../types/editor';

/** Convert path anchors to SVG path `d` (absolute coords). */
export function anchorsToSvgPath(anchors: PathAnchor[], closed: boolean): string {
  if (anchors.length === 0) return '';
  if (anchors.length === 1) return `M ${anchors[0].x} ${anchors[0].y}`;

  let d = `M ${anchors[0].x} ${anchors[0].y}`;

  const appendSegment = (prev: PathAnchor, curr: PathAnchor) => {
    const hasCurve =
      (prev.handleOutX ?? 0) !== 0 ||
      (prev.handleOutY ?? 0) !== 0 ||
      (curr.handleInX ?? 0) !== 0 ||
      (curr.handleInY ?? 0) !== 0;

    if (!hasCurve) {
      d += ` L ${curr.x} ${curr.y}`;
      return;
    }

    const cp1x = prev.x + (prev.handleOutX ?? 0);
    const cp1y = prev.y + (prev.handleOutY ?? 0);
    const cp2x = curr.x + (curr.handleInX ?? 0);
    const cp2y = curr.y + (curr.handleInY ?? 0);
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${curr.x} ${curr.y}`;
  };

  for (let i = 1; i < anchors.length; i++) {
    appendSegment(anchors[i - 1], anchors[i]);
  }

  if (closed && anchors.length > 2) {
    appendSegment(anchors[anchors.length - 1], anchors[0]);
    d += ' Z';
  }

  return d;
}

export function pathBounds(
  anchors: PathAnchor[],
  padding = 8
): { x: number; y: number; width: number; height: number } {
  if (anchors.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const a of anchors) {
    consider(a.x, a.y);
    consider(a.x + (a.handleInX ?? 0), a.y + (a.handleInY ?? 0));
    consider(a.x + (a.handleOutX ?? 0), a.y + (a.handleOutY ?? 0));
  }

  return {
    x: Math.floor(minX - padding),
    y: Math.floor(minY - padding),
    width: Math.max(1, Math.ceil(maxX - minX + padding * 2)),
    height: Math.max(1, Math.ceil(maxY - minY + padding * 2)),
  };
}

/** Shift anchors into layer-local space (origin at bounds top-left). */
export function normalizeAnchors(
  anchors: PathAnchor[],
  originX: number,
  originY: number
): PathAnchor[] {
  return anchors.map((a) => ({
    ...a,
    x: a.x - originX,
    y: a.y - originY,
  }));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}
