import type { Layer, Psd } from 'ag-psd';
import type { BlendMode, EditorLayer, ImageLayer, TextLayer } from '../types/editor';

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

const OUR_BLEND_TO_PSD: Partial<Record<BlendMode, string>> = {
  'source-over': 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  'hard-light': 'hard light',
  'soft-light': 'soft light',
  difference: 'difference',
  exclusion: 'exclusion',
};

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

function textLayerToCanvas(layer: TextLayer): HTMLCanvasElement {
  const w = Math.max(40, Math.round(layer.width * Math.abs(layer.scaleX || 1)));
  const lineCount = Math.max(1, layer.text.split('\n').length);
  const h = Math.max(
    Math.round(layer.fontSize * layer.lineHeight * lineCount),
    Math.round((layer.height || layer.fontSize) * Math.abs(layer.scaleY || 1))
  );
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const style = layer.fontStyle?.includes('italic') ? 'italic ' : '';
  const weight = layer.fontStyle?.includes('bold') ? 'bold ' : '';
  ctx.font = `${style}${weight}${layer.fontSize}px ${layer.fontFamily || 'Source Sans 3'}`;
  ctx.fillStyle = layer.fill || '#000000';
  ctx.textBaseline = 'top';
  layer.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, 0, i * layer.fontSize * layer.lineHeight);
  });
  return canvas;
}

async function maskCanvasFromSrc(src: string): Promise<HTMLCanvasElement | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('mask load failed'));
    img.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0);
  return canvas;
}

async function exportOneLayer(layer: EditorLayer): Promise<Layer | null> {
  if (layer.type === 'image') {
    const canvas = await imageLayerToCanvas(layer);
    const node: Layer = {
      name: layer.name,
      left: Math.round(layer.x),
      top: Math.round(layer.y),
      right: Math.round(layer.x + canvas.width),
      bottom: Math.round(layer.y + canvas.height),
      opacity: Math.round(Math.max(0, Math.min(1, layer.opacity)) * 255),
      hidden: !layer.visible,
      blendMode: (OUR_BLEND_TO_PSD[layer.blendMode] ?? 'normal') as Layer['blendMode'],
      canvas,
    };
    if (layer.hasLayerMask && layer.layerMaskSrc) {
      const maskCanvas = await maskCanvasFromSrc(layer.layerMaskSrc);
      if (maskCanvas) {
        node.mask = { canvas: maskCanvas, positionRelativeToLayer: true } as Layer['mask'];
      }
    }
    return node;
  }
  if (layer.type === 'text') {
    const canvas = textLayerToCanvas(layer);
    return {
      name: layer.name,
      left: Math.round(layer.x),
      top: Math.round(layer.y),
      right: Math.round(layer.x + canvas.width),
      bottom: Math.round(layer.y + canvas.height),
      opacity: Math.round(Math.max(0, Math.min(1, layer.opacity)) * 255),
      hidden: !layer.visible,
      blendMode: (OUR_BLEND_TO_PSD[layer.blendMode] ?? 'normal') as Layer['blendMode'],
      canvas,
    };
  }
  return null;
}

async function buildPsdChildren(layers: EditorLayer[], parentGroupId: string | null): Promise<Layer[]> {
  const siblings = layers.filter(
    (l) =>
      (l.parentGroupId ?? null) === parentGroupId &&
      l.type !== 'adjustment' &&
      l.type !== 'drawing' &&
      l.type !== 'shape' &&
      l.type !== 'path' &&
      l.type !== 'gradient' &&
      l.type !== 'lottie'
  );
  const children: Layer[] = [];
  for (const layer of siblings) {
    if (layer.type === 'group') {
      const nested = await buildPsdChildren(layers, layer.id);
      children.push({
        name: layer.name,
        opacity: Math.round(Math.max(0, Math.min(1, layer.opacity)) * 255),
        hidden: !layer.visible,
        children: nested,
      });
      continue;
    }
    const node = await exportOneLayer(layer);
    if (node) children.push(node);
  }
  return children;
}

/**
 * Partial PSD export: rasterized image + text layers, folders for groups, layer masks when present.
 * Shape/drawing/adjustment layers are omitted — label in File menu stays honest.
 */
export async function exportPsdPartial(options: {
  title: string;
  width: number;
  height: number;
  layers: EditorLayer[];
}): Promise<Blob> {
  const { writePsd } = await loadAgPsd();
  await ensureCanvasFactory();

  const children = await buildPsdChildren(options.layers, null);

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