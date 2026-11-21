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
}

export interface PsdImportResult {
  width: number;
  height: number;
  layers: PsdImportedLayer[];
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

/** Walks the layer tree (bottom → top), flattening groups and inheriting hidden state. */
function collectLayers(
  nodes: import('ag-psd').Layer[] | undefined,
  parentVisible: boolean,
  out: PsdImportedLayer[]
): void {
  if (!nodes) return;
  nodes.forEach((node, index) => {
    const visible = parentVisible && !node.hidden;
    if (node.children?.length) {
      collectLayers(node.children, visible, out);
      return;
    }
    const canvas = node.canvas;
    if (!canvas || canvas.width < 1 || canvas.height < 1) return;

    const left = node.left ?? 0;
    const top = node.top ?? 0;
    out.push({
      name: node.name?.trim() || `Layer ${out.length + index + 1}`,
      src: canvas.toDataURL('image/png'),
      x: Math.round(left),
      y: Math.round(top),
      width: canvas.width,
      height: canvas.height,
      opacity: node.opacity == null ? 1 : Math.min(1, Math.max(0, node.opacity)),
      visible,
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
  let compositeCanvas: HTMLCanvasElement | undefined;

  try {
    const psd = tryRead(true);
    width = psd.width;
    height = psd.height;
    compositeCanvas = psd.canvas;
    collectLayers(psd.children, true, layers);
  } catch (err) {
    console.warn('PSD layer decode failed, falling back to composite', err);
  }

  if (layers.length > 0) {
    return { width, height, layers, title, flattened: false };
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
      },
    ],
    title,
    flattened: true,
  };
}
