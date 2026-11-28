import type { BlendMode } from '../types/editor';

export interface PsdImportedLayer {
  name: string;
  /** PNG data URL of the layer's pixels */
  src: string;
  /** Top-left position in document space */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0–1 */
  opacity: number;
  visible: boolean;
  blendMode: BlendMode;
  hasLayerMask?: boolean;
  layerMaskSrc?: string;
}

export interface PsdImportedGroupStub {
  name: string;
  visible: boolean;
  opacity: number;
}

export interface PsdImportResult {
  width: number;
  height: number;
  layers: PsdImportedLayer[];
  groupStubs: PsdImportedGroupStub[];
  title: string;
  /** True when per-layer decode wasn't possible and `layers` holds one flattened composite. */
  flattened: boolean;
}

let canvasReady = false;

async function loadAgPsd() {
  return import('ag-psd');
}

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

function titleFromFile(file: File): string {
  const base = file.name.replace(/\.psd$/i, '').trim();
  return base || 'Untitled PSD';
}

const PSD_BLEND_MAP: Record<string, BlendMode> = {
  normal: 'source-over',
  dissolve: 'source-over',
  darken: 'darken',
  multiply: 'multiply',
  colorburn: 'color-burn',
  'color burn': 'color-burn',
  linearburn: 'color-burn',
  lightendarken: 'overlay',
  lighten: 'lighten',
  screen: 'screen',
  colordodge: 'color-dodge',
  'color dodge': 'color-dodge',
  lineardodge: 'color-dodge',
  overlay: 'overlay',
  softlight: 'soft-light',
  'soft light': 'soft-light',
  hardlight: 'hard-light',
  'hard light': 'hard-light',
  vividlight: 'hard-light',
  linearlight: 'hard-light',
  pinlight: 'hard-light',
  hardmix: 'hard-light',
  difference: 'difference',
  exclusion: 'exclusion',
};

function mapPsdBlendMode(raw: string | undefined): BlendMode {
  if (!raw) return 'source-over';
  const key = raw.toLowerCase().replace(/\s+/g, '');
  return PSD_BLEND_MAP[key] ?? PSD_BLEND_MAP[raw.toLowerCase()] ?? 'source-over';
}

/** Walks the layer tree (bottom → top), flattening groups and inheriting hidden state. */
function collectLayers(
  nodes: import('ag-psd').Layer[] | undefined,
  parentVisible: boolean,
  out: PsdImportedLayer[],
  groups: PsdImportedGroupStub[]
): void {
  if (!nodes) return;
  nodes.forEach((node, index) => {
    const visible = parentVisible && !node.hidden;
    if (node.children?.length) {
      groups.push({
        name: node.name?.trim() || `Group ${groups.length + 1}`,
        visible,
        opacity: node.opacity == null ? 1 : Math.min(1, Math.max(0, node.opacity)),
      });
      collectLayers(node.children, visible, out, groups);
      return;
    }
    const canvas = node.canvas;
    if (!canvas || canvas.width < 1 || canvas.height < 1) return;

    const left = node.left ?? 0;
    const top = node.top ?? 0;
    const maskCanvas = node.mask?.canvas;
    out.push({
      name: node.name?.trim() || `Layer ${out.length + index + 1}`,
      src: canvas.toDataURL('image/png'),
      x: Math.round(left),
      y: Math.round(top),
      width: canvas.width,
      height: canvas.height,
      opacity: node.opacity == null ? 1 : Math.min(1, Math.max(0, node.opacity)),
      visible,
      blendMode: mapPsdBlendMode(node.blendMode),
      ...(maskCanvas && maskCanvas.width > 0 && maskCanvas.height > 0
        ? {
            hasLayerMask: true,
            layerMaskSrc: maskCanvas.toDataURL('image/png'),
          }
        : {}),
    });
  });
}

/**
 * Imports a .psd file. Tries to decode each layer's pixels; if that fails or
 * yields nothing, falls back to the flattened composite image.
 */
export async function importPsdFile(file: File): Promise<PsdImportResult> {
  const { readPsd } = await loadAgPsd();
  await ensureCanvasFactory();
  const buffer = await file.arrayBuffer();
  const title = titleFromFile(file);

  const tryRead = (layersWanted: boolean) =>
    readPsd(buffer, {
      skipLayerImageData: !layersWanted,
      skipCompositeImageData: false,
      skipThumbnail: true,
      skipLinkedFilesData: true,
    });

  let width = 0;
  let height = 0;
  const layers: PsdImportedLayer[] = [];
  const groupStubs: PsdImportedGroupStub[] = [];
  let compositeCanvas: HTMLCanvasElement | undefined;

  try {
    const psd = tryRead(true);
    width = psd.width;
    height = psd.height;
    compositeCanvas = psd.canvas;
    collectLayers(psd.children, true, layers, groupStubs);
  } catch (err) {
    console.warn('PSD layer decode failed, falling back to composite', err);
  }

  if (layers.length > 0) {
    return { width, height, layers, groupStubs, title, flattened: false };
  }

  if (!compositeCanvas) {
    try {
      const psd = tryRead(false);
      width = psd.width;
      height = psd.height;
      compositeCanvas = psd.canvas;
    } catch (err) {
      throw new Error(
        `Could not read PSD: ${err instanceof Error ? err.message : 'unsupported file'}`
      );
    }
  }

  if (!compositeCanvas) {
    throw new Error('This PSD has no flattened preview and its layers could not be decoded.');
  }

  return {
    width: width || compositeCanvas.width,
    height: height || compositeCanvas.height,
    layers: [
      {
        name: 'Background',
        src: compositeCanvas.toDataURL('image/png'),
        x: 0,
        y: 0,
        width: compositeCanvas.width,
        height: compositeCanvas.height,
        opacity: 1,
        visible: true,
        blendMode: 'source-over',
      },
    ],
    groupStubs: [],
    title,
    flattened: true,
  };
}