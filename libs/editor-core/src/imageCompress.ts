export type CompressFormat = 'image/jpeg' | 'image/webp' | 'image/png';

export interface CompressOptions {
  maxEdge?: number;
  quality?: number; // 0.1–1 for jpeg/webp
  format?: CompressFormat;
}

export interface CompressResult {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: CompressFormat;
  approxBytes: number;
}

/** Client-side resize + recompress — no network. */
export async function compressImageSource(
  src: string,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const maxEdge = options.maxEdge ?? 2048;
  const quality = Math.min(1, Math.max(0.1, options.quality ?? 0.82));
  const format: CompressFormat = options.format ?? 'image/jpeg';

  const img = await loadImage(src);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl =
    format === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL(format, quality);

  return {
    dataUrl,
    width,
    height,
    mimeType: format,
    approxBytes: Math.round(((dataUrl.split(',')[1] || '').length * 3) / 4),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
