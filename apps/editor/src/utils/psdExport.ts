import type { Layer, Psd } from 'ag-psd';
import type { EditorLayer, ImageLayer } from '../types/editor';

async function loadAgPsd() {
  return import('ag-psd');
}

let canvasReady = false;

async function ensureCanvasFactory(): Promise<void> {
  if (canvasReady) return;
  const { initializeCanvas } = await loadAgPsd();
  canvasReady = true;
  initializeCanvas(
    (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      return canvas;
    },
    (width, height) => new ImageData(Math.max(1, width), Math.max(1, height))
  );
}

async function imageLayerToCanvas(layer: ImageLayer): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load ${layer.name}`));
    img.src = layer.src;
  });
  const w = Math.max(1, Math.round(layer.width * (layer.scaleX || 1)));
  const h = Math.max(1, Math.round(layer.height * (layer.scaleY || 1)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Partial PSD export: image layers only (baked pixels), bottom → top.
 * Text/shape/drawing/group layers are skipped in this first cut.
 */
export async function exportPsdPartial(options: {
  title: string;
  width: number;
  height: number;
  layers: EditorLayer[];
}): Promise<Blob> {
  const { writePsd } = await loadAgPsd();
  await ensureCanvasFactory();

  const imageLayers = options.layers.filter(
    (l): l is ImageLayer => l.type === 'image' && l.visible
  );

  const children: Layer[] = [];
  for (const layer of imageLayers) {
    const canvas = await imageLayerToCanvas(layer);
    children.push({
      name: layer.name,
      left: Math.round(layer.x),
      top: Math.round(layer.y),
      right: Math.round(layer.x + canvas.width),
      bottom: Math.round(layer.y + canvas.height),
      opacity: Math.round(Math.max(0, Math.min(1, layer.opacity)) * 255),
      hidden: !layer.visible,
      canvas,
    });
  }

  const psd: Psd = {
    width: options.width,
    height: options.height,
    children,
  };

  const buffer = writePsd(psd);
  return new Blob([new Uint8Array(buffer)], { type: 'image/vnd.adobe.photoshop' });
}

export function downloadPsdBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.psd') ? fileName : `${fileName}.psd`;
  a.click();
  URL.revokeObjectURL(url);
}
