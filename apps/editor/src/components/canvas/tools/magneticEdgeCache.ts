import { buildLuminanceGradient, snapToEdge } from '@photoshop-lite/editor-core';
import type { ImageLayer } from '../../../types/editor';
import { averageScale, toDocument, toImageLocal } from './geometry';
import type { Point, ToolContext } from './types';

/** Longest side of the analysis grid; larger layers are sampled at a reduced scale. */
const MAX_ANALYSIS_SIDE = 2048;
/** Snap search radius in document pixels. */
const SNAP_RADIUS_DOC = 10;

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function decodeGradient(src: string) {
  const img = await loadImageElement(src);
  if (!img) return null;
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) return null;

  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(nw, nh));
  const width = Math.max(1, Math.round(nw * scale));
  const height = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  // Throws on tainted canvases — callers treat that as "no edge data"
  const imageData = ctx.getImageData(0, 0, width, height);
  return { gradient: buildLuminanceGradient(imageData), width, height, scale: width / nw };
}

/**
 * Start decoding the selected image layer's gradient (once per layer + src). The sampled
 * ImageData is cached on the session; until it is ready `snapMagneticPoint` is a no-op.
 */
export function primeMagneticEdge(ctx: ToolContext): void {
  const layer = ctx.getSelectedImageLayer();
  const { session } = ctx;
  if (!layer) {
    session.magneticEdge = null;
    return;
  }
  const cached = session.magneticEdge;
  if (cached && cached.layerId === layer.id && cached.src === layer.src) return;

  const entry = { layerId: layer.id, src: layer.src, status: 'loading' as const };
  session.magneticEdge = entry;
  void decodeGradient(layer.src)
    .then((result) => {
      if (session.magneticEdge !== entry) return;
      session.magneticEdge = result
        ? { ...entry, status: 'ready', ...result }
        : { ...entry, status: 'failed' };
    })
    .catch(() => {
      if (session.magneticEdge === entry) session.magneticEdge = { ...entry, status: 'failed' };
    });
}

/**
 * Snap a document-space point to the strongest nearby edge of the selected image layer.
 * Returns the input unchanged when no edge data is available (no image, still decoding,
 * decode failed) so the caller keeps the plain stepping behaviour.
 */
export function snapMagneticPoint(
  ctx: ToolContext,
  layer: ImageLayer | null,
  point: Point
): Point {
  const cache = ctx.session.magneticEdge;
  if (
    !layer ||
    !cache ||
    cache.status !== 'ready' ||
    cache.layerId !== layer.id ||
    cache.src !== layer.src ||
    !cache.gradient ||
    !cache.width ||
    !cache.height ||
    !cache.scale
  ) {
    return point;
  }

  const local = toImageLocal(layer, point.x, point.y);
  const gx = local.x * cache.scale;
  const gy = local.y * cache.scale;
  // Ignore points outside the image: there are no edges to latch on to
  if (gx < 0 || gy < 0 || gx >= cache.width || gy >= cache.height) return point;

  const radius = Math.max(2, (SNAP_RADIUS_DOC / averageScale(layer)) * cache.scale);
  const snapped = snapToEdge(cache.gradient, cache.width, cache.height, gx, gy, radius);
  const doc = toDocument(layer, snapped.x / cache.scale, snapped.y / cache.scale);
  return { x: Math.round(doc.x), y: Math.round(doc.y) };
}
