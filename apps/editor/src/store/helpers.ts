import type { EditorLayer, ImageLayer, PathLayer, AdjustmentLayerKind } from '../types/editor';

/** Unique layer name: "Portrait · Revived", "Portrait · Revived 2", … */
export function uniqueLayerName(base: string, layers: EditorLayer[]): string {
  const names = new Set(layers.map((l) => l.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function derivativeName(sourceName: string, suffix: string, layers: EditorLayer[]): string {
  const root = sourceName
    .replace(/\s*·\s*(Revived|Cleaned)(\s+\d+)?$/i, '')
    .replace(/\s*\((Cutout|\d+x Upscaled)\)(\s+\d+)?$/i, '')
    .trim();
  return uniqueLayerName(`${root} · ${suffix}`, layers);
}

export function makeId(tag: string): string {
  return `${Date.now()}_${tag}_${Math.random().toString(36).substring(2, 6)}`;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export const ADJUSTMENT_LABELS: Record<AdjustmentLayerKind, string> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  levels: 'Levels',
  curves: 'Curves',
  hueSaturation: 'Hue/Saturation',
  invert: 'Invert',
  grayscale: 'Black & White',
  gradientMap: 'Gradient Map',
  photoFilter: 'Photo Filter',
};

/** Flatten a bezier path layer into document-space [x,y,…] points (honours scale + rotation). */
export function flattenPathLayer(layer: PathLayer, segments = 16): number[] {
  const { anchors, closed } = layer;
  if (anchors.length === 0) return [];
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toDoc = (px: number, py: number): [number, number] => {
    const lx = px * layer.scaleX;
    const ly = py * layer.scaleY;
    return [layer.x + lx * cos - ly * sin, layer.y + lx * sin + ly * cos];
  };

  const out: number[] = [];
  const pushPoint = (px: number, py: number) => {
    const [dx, dy] = toDoc(px, py);
    out.push(dx, dy);
  };

  const count = closed ? anchors.length : anchors.length - 1;
  pushPoint(anchors[0].x, anchors[0].y);
  for (let i = 0; i < count; i += 1) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    const hasCurve =
      !!(a.handleOutX || a.handleOutY || b.handleInX || b.handleInY);
    if (!hasCurve) {
      pushPoint(b.x, b.y);
      continue;
    }
    const p1x = a.x + (a.handleOutX ?? 0);
    const p1y = a.y + (a.handleOutY ?? 0);
    const p2x = b.x + (b.handleInX ?? 0);
    const p2y = b.y + (b.handleInY ?? 0);
    for (let s = 1; s <= segments; s += 1) {
      const t = s / segments;
      const mt = 1 - t;
      const x = mt * mt * mt * a.x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * b.x;
      const y = mt * mt * mt * a.y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * b.y;
      pushPoint(x, y);
    }
  }
  // Closed paths end back on the first point; drop the duplicate (callers close explicitly).
  return closed && out.length > 2 ? out.slice(0, -2) : out;
}

/** Document-space feathered selection mask → image-layer mask (luminance → alpha, layer-local). */
export async function selectionMaskToLayerMask(
  maskDataUrl: string,
  layer: ImageLayer,
  canvasW: number,
  canvasH: number
): Promise<string> {
  const img = await loadImageElement(maskDataUrl);
  const w = Math.max(1, Math.round(layer.width));
  const h = Math.max(1, Math.round(layer.height));
  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create mask canvas');
  ctx.drawImage(img, -layer.x / sx, -layer.y / sy, canvasW / sx, canvasH / sy);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i];
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = lum;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Cloud segment / cutout mask → layer-local alpha mask (stretch to layer bounds). */
export async function rasterMaskToLayerMask(
  maskDataUrl: string,
  layer: ImageLayer
): Promise<string> {
  const img = await loadImageElement(maskDataUrl);
  const w = Math.max(1, Math.round(layer.width));
  const h = Math.max(1, Math.round(layer.height));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create mask canvas');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    const alpha = px[i + 3] < 250 ? px[i + 3] : lum;
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = alpha;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

/** True while playAction runs, so replayed steps are not re-recorded. */
let isPlayingAction = false;

export function isActionPlaying(): boolean {
  return isPlayingAction;
}

export function setActionPlaying(value: boolean): void {
  isPlayingAction = value;
}

/** Max undo snapshots kept in history. */
export const MAX_HISTORY = 40;
