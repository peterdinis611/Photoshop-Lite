const IMAGE_MIME = /^image\//i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg|heic|heif|tif{1,2})$/i;

/** Browser-safe decode limits — larger photos are downscaled, not rejected. */
export const MAX_IMAGE_EDGE = 8192;
export const MAX_IMAGE_PIXELS = 40_000_000; // ~6324²

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME.test(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export function collectImageFiles(fileList: FileList | File[] | null | undefined): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter(isImageFile);
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
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = src;
  });
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
      /* SVG / exotic — fall through */
    }
  }

  const url = URL.createObjectURL(file);
  const img = await loadHtmlImage(url);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    release: () => URL.revokeObjectURL(url),
  };
}

function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  mimeHint: string,
  width: number,
  height: number
): Promise<string> {
  const preferJpeg = /jpe?g/i.test(mimeHint) || width * height > 8_000_000;
  const type = preferJpeg ? 'image/jpeg' : 'image/webp';
  const quality = preferJpeg ? 0.92 : 0.9;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      type,
      quality
    );
  });
}

/**
 * Load a single image file for the editor.
 * Uses object URLs (not giant data-URLs) and downscales only when needed.
 */
export async function loadImageFile(
  file: File,
  onPhase?: (phase: LoadImagePhase) => void
): Promise<LoadedImageFile> {
  onPhase?.('read');
  onPhase?.('decode');

  const decoded = await decodeFile(file);
  const originalWidth = decoded.width;
  const originalHeight = decoded.height;

  if (!originalWidth || !originalHeight) {
    decoded.release();
    throw new Error('Invalid image');
  }

  const scale = computeImageScale(originalWidth, originalHeight);
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  try {
    if (scale < 0.999) {
      onPhase?.('optimize');
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('Canvas unavailable');
      decoded.draw(ctx, width, height);
      const src = await canvasToObjectUrl(canvas, file.type || file.name, width, height);
      onPhase?.('done');
      return {
        src,
        name: baseName(file),
        width,
        height,
        file,
        downscaled: true,
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
