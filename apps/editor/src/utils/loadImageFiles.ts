import {
  isImageFile as isImageFileByFormat,
  isSvgFile,
  preferEncodeMime,
  shouldNormalizeToPng,
} from './imageFormats';

export { IMAGE_ACCEPT, IMAGE_EXTENSIONS, isImageFile } from './imageFormats';

/** Browser-safe decode limits — larger photos are downscaled, not rejected. */
export const MAX_IMAGE_EDGE = 8192;
export const MAX_IMAGE_PIXELS = 40_000_000; // ~6324²

export function collectImageFiles(fileList: FileList | File[] | null | undefined): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter(isImageFileByFormat);
}

export function dragEventHasFiles(e: { dataTransfer?: DataTransfer | null }): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

export interface LoadedImageFile {
  src: string;
  name: string;
  width: number;
  height: number;
  file: File;
  /** True when the bitmap was downscaled for memory/browser limits */
  downscaled?: boolean;
  /** True when exotic format was baked to a browser-safe PNG/WebP */
  normalized?: boolean;
  originalWidth?: number;
  originalHeight?: number;
}

export type LoadImagePhase = 'read' | 'decode' | 'optimize' | 'done' | 'error';

export interface LoadImageProgress {
  fileName: string;
  index: number;
  total: number;
  phase: LoadImagePhase;
  /** 0–100 overall across the batch */
  percent: number;
}

function baseName(file: File): string {
  return file.name.replace(/\.[^/.]+$/, '') || 'Image';
}

export function computeImageScale(width: number, height: number): number {
  let scale = 1;
  if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
    scale = Math.min(MAX_IMAGE_EDGE / width, MAX_IMAGE_EDGE / height);
  }
  const pixels = width * height;
  if (pixels * scale * scale > MAX_IMAGE_PIXELS) {
    scale = Math.sqrt(MAX_IMAGE_PIXELS / pixels);
  }
  return Math.min(1, scale);
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Unsupported or corrupted image (browser cannot decode this format)'));
    img.src = src;
  });
}

/** Parse SVG intrinsic size when the browser reports 0×0. */
export async function resolveSvgDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  try {
    const text = await file.text();
    const vb = text.match(/viewBox\s*=\s*["']?\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/i);
    if (vb) {
      const w = Math.abs(parseFloat(vb[3]));
      const h = Math.abs(parseFloat(vb[4]));
      if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
    }
    const wAttr = text.match(/\bwidth\s*=\s*["']?([\d.]+)/i);
    const hAttr = text.match(/\bheight\s*=\s*["']?([\d.]+)/i);
    if (wAttr && hAttr) {
      const w = parseFloat(wAttr[1]);
      const h = parseFloat(hAttr[1]);
      if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
    }
  } catch {
    /* ignore */
  }
  return { width: 512, height: 512 };
}

async function decodeFile(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  release: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        release: () => bitmap.close(),
      };
    } catch {
      /* SVG / HEIC / exotic — fall through */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    if ((!width || !height) && isSvgFile(file)) {
      const dims = await resolveSvgDimensions(file);
      width = dims?.width ?? 512;
      height = dims?.height ?? 512;
    }

    return {
      width,
      height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  mimeHint: string,
  width: number,
  height: number
): Promise<string> {
  const type = preferEncodeMime(mimeHint, width, height);
  const quality = type === 'image/png' ? undefined : type === 'image/jpeg' ? 0.92 : 0.9;

  return new Promise((resolve, reject) => {
    const tryEncode = (mime: string, q?: number) => {
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(URL.createObjectURL(blob));
            return;
          }
          // Fallback chain: requested → webp → png
          if (mime === 'image/avif') {
            tryEncode('image/webp', 0.9);
            return;
          }
          if (mime === 'image/webp' || mime === 'image/jpeg') {
            tryEncode('image/png');
            return;
          }
          reject(new Error('Failed to encode image'));
        },
        mime,
        q
      );
    };
    tryEncode(type, quality);
  });
}

async function rasterizeDecoded(
  decoded: {
    width: number;
    height: number;
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  },
  width: number,
  height: number,
  mimeHint: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas unavailable');
  decoded.draw(ctx, width, height);
  return canvasToObjectUrl(canvas, mimeHint, width, height);
}

/**
 * Load a single image file for the editor.
 * Uses object URLs (not giant data-URLs) and downscales only when needed.
 * Exotic formats (HEIC/TIFF/ICO/BMP/…) are normalized to PNG/WebP after decode.
 */
export async function loadImageFile(
  file: File,
  onPhase?: (phase: LoadImagePhase) => void
): Promise<LoadedImageFile> {
  onPhase?.('read');
  onPhase?.('decode');

  let decoded: Awaited<ReturnType<typeof decodeFile>>;
  try {
    decoded = await decodeFile(file);
  } catch {
    throw new Error(
      `Cannot decode “${file.name}”. Try PNG, JPEG, WebP, GIF, AVIF, BMP, SVG, or TIFF (browser-supported).`
    );
  }

  const originalWidth = decoded.width;
  const originalHeight = decoded.height;

  if (!originalWidth || !originalHeight) {
    decoded.release();
    throw new Error(`Invalid image dimensions for “${file.name}”`);
  }

  const scale = computeImageScale(originalWidth, originalHeight);
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  const normalize = shouldNormalizeToPng(file) || scale < 0.999;
  const mimeHint = file.type || file.name;

  try {
    if (normalize) {
      onPhase?.('optimize');
      // Prefer PNG for normalized exotic formats so alpha + crop stay reliable
      const encodeHint = shouldNormalizeToPng(file) ? 'image/png' : mimeHint;
      const src = await rasterizeDecoded(decoded, width, height, encodeHint);
      onPhase?.('done');
      return {
        src,
        name: baseName(file),
        width,
        height,
        file,
        downscaled: scale < 0.999,
        normalized: shouldNormalizeToPng(file),
        originalWidth,
        originalHeight,
      };
    }

    // Keep original bytes as object URL — avoids base64 blow-up on large files
    const src = URL.createObjectURL(file);
    onPhase?.('done');
    return {
      src,
      name: baseName(file),
      width,
      height,
      file,
      originalWidth,
      originalHeight,
    };
  } finally {
    decoded.release();
  }
}

export async function loadImageFiles(
  files: File[],
  onProgress?: (p: LoadImageProgress) => void
): Promise<LoadedImageFile[]> {
  const images = collectImageFiles(files);
  const total = images.length;
  const loaded: LoadedImageFile[] = [];

  for (let index = 0; index < images.length; index++) {
    const file = images[index];
    const slice = 100 / Math.max(total, 1);

    const emit = (phase: LoadImagePhase, local = 0.5) => {
      onProgress?.({
        fileName: file.name,
        index,
        total,
        phase,
        percent: Math.min(99, Math.round(index * slice + slice * local)),
      });
    };

    try {
      emit('read', 0.1);
      const item = await loadImageFile(file, (phase) => {
        const local =
          phase === 'read' ? 0.2 : phase === 'decode' ? 0.55 : phase === 'optimize' ? 0.85 : 1;
        emit(phase, local);
      });
      loaded.push(item);
      emit('done', 1);
    } catch {
      onProgress?.({
        fileName: file.name,
        index,
        total,
        phase: 'error',
        percent: Math.round((index + 1) * slice),
      });
    }
  }

  if (loaded.length) {
    onProgress?.({
      fileName: loaded[loaded.length - 1].file.name,
      index: Math.max(0, total - 1),
      total,
      phase: 'done',
      percent: 100,
    });
  }

  return loaded;
}
