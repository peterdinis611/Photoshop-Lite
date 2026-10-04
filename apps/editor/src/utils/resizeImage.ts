export type ResizeFormat = 'image/jpeg' | 'image/webp' | 'image/png' | 'image/avif';

export interface ResizeImageOptions {
  width: number;
  height: number;
  format?: ResizeFormat;
  /** 0–1, used for jpeg/webp */
  quality?: number;
}

export interface ResizedImageResult {
  src: string;
  width: number;
  height: number;
  bytesEstimate: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image for resize'));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  format: ResizeFormat,
  quality: number
): Promise<{ src: string; bytesEstimate: number }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode resized image'));
          return;
        }
        resolve({ src: URL.createObjectURL(blob), bytesEstimate: blob.size });
      },
      format,
      quality
    );
  });
}

/** Resize (and optionally recompress) an image source for the editor. */
export async function resizeImageSource(
  src: string,
  options: ResizeImageOptions
): Promise<ResizedImageResult> {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const format = options.format ?? 'image/jpeg';
  const quality = Math.min(1, Math.max(0.4, options.quality ?? 0.85));

  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const wantsAlpha = format === 'image/png' || format === 'image/webp' || format === 'image/avif';
  const ctx = canvas.getContext('2d', { alpha: wantsAlpha });
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  let encoded: { src: string; bytesEstimate: number };
  try {
    encoded = await canvasToObjectUrl(canvas, format, quality);
  } catch {
    // AVIF may be unavailable — fall back to WebP then PNG
    if (format === 'image/avif') {
      try {
        encoded = await canvasToObjectUrl(canvas, 'image/webp', quality);
      } catch {
        encoded = await canvasToObjectUrl(canvas, 'image/png', 1);
      }
    } else {
      throw new Error('Failed to encode resized image');
    }
  }
  return {
    src: encoded.src,
    width,
    height,
    bytesEstimate: encoded.bytesEstimate,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
