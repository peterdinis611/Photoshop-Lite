import type { ImageLayer } from '../types/editor';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CroppedImageResult {
  src: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image for crop'));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode cropped image'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      format,
      quality
    );
  });
}

/** Axis-aligned bounding box of a layer after scale + rotation (Konva top-left origin). */
export function layerAxisAlignedBounds(layer: {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}): CropRect {
  const w = layer.width * layer.scaleX;
  const h = layer.height * layer.scaleY;
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ].map((p) => ({
    x: layer.x + p.x * cos - p.y * sin,
    y: layer.y + p.x * sin + p.y * cos,
  }));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

export function intersectRects(a: CropRect, b: CropRect): CropRect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Rasterize an image layer into the intersection with `crop` (delete cropped pixels).
 * Bakes scale / rotation / flips / layer mask into a new top-left-aligned image.
 * Returns null when the layer does not intersect the crop rect.
 */
export async function cropImageLayerToRect(
  layer: ImageLayer,
  crop: CropRect
): Promise<CroppedImageResult | null> {
  const aabb = layerAxisAlignedBounds(layer);
  const overlap = intersectRects(aabb, crop);
  if (!overlap) return null;

  const outW = Math.max(1, Math.round(overlap.width));
  const outH = Math.max(1, Math.round(overlap.height));

  const img = await loadImage(layer.src);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Map canvas coords so overlap top-left → (0, 0)
  ctx.save();
  ctx.translate(layer.x - overlap.x, layer.y - overlap.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scaleX, layer.scaleY);
  ctx.drawImage(img, 0, 0, layer.width, layer.height);

  if (layer.hasLayerMask && layer.layerMaskSrc) {
    const mask = await loadImage(layer.layerMaskSrc);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, layer.width, layer.height);
  } else if (layer.maskDataUrl) {
    const mask = await loadImage(layer.maskDataUrl);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, layer.width, layer.height);
  }
  ctx.restore();

  const src = await canvasToObjectUrl(canvas, 'image/png');
  return {
    src,
    width: outW,
    height: outH,
    x: Math.round(overlap.x - crop.x),
    y: Math.round(overlap.y - crop.y),
  };
}

/** Apply crop transform to an image layer (pixel crop + reposition), or shift if no overlap. */
export async function applyCropToImageLayer(
  layer: ImageLayer,
  crop: CropRect
): Promise<ImageLayer> {
  const cropped = await cropImageLayerToRect(layer, crop);
  if (!cropped) {
    return {
      ...layer,
      x: layer.x - crop.x,
      y: layer.y - crop.y,
    };
  }

  return {
    ...layer,
    src: cropped.src,
    originalSrc: cropped.src,
    x: cropped.x,
    y: cropped.y,
    width: cropped.width,
    height: cropped.height,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    hasLayerMask: false,
    layerMaskSrc: undefined,
    maskDataUrl: undefined,
  };
}
