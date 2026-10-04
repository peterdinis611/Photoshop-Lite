/** Extensions the editor accepts for open / drop / paste. */
export const IMAGE_EXTENSIONS = [
  'png',
  'apng',
  'jpg',
  'jpeg',
  'jfif',
  'jpe',
  'pjp',
  'pjpeg',
  'gif',
  'webp',
  'bmp',
  'dib',
  'avif',
  'svg',
  'svgz',
  'heic',
  'heif',
  'tif',
  'tiff',
  'ico',
  'cur',
  'jxl',
  'xbm',
] as const;

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/** `<input accept>` + drag hints — MIME wildcards plus explicit extensions for picky browsers. */
export const IMAGE_ACCEPT = [
  'image/*',
  'image/png',
  'image/apng',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/x-ms-bmp',
  'image/avif',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/jxl',
  ...IMAGE_EXTENSIONS.map((ext) => `.${ext}`),
].join(',');

const IMAGE_MIME = /^image\//i;
const IMAGE_EXT_RE = new RegExp(
  `\\.(${IMAGE_EXTENSIONS.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
  'i'
);

/** Formats browsers often decode but Konva/crop handle more reliably as PNG. */
const NORMALIZE_EXT =
  /\.(heic|heif|tif|tiff|bmp|dib|ico|cur|jxl|xbm|svgz)$/i;

/** Sources that may carry transparency — never re-encode as JPEG. */
const ALPHA_HINT =
  /png|apng|webp|gif|svg|avif|ico|bmp|tif|heic|heif|jxl|transparent/i;

export function extensionOf(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? '';
}

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME.test(file.type)) return true;
  return IMAGE_EXT_RE.test(file.name);
}

export function isSvgFile(file: File): boolean {
  if (file.type === 'image/svg+xml') return true;
  const ext = extensionOf(file.name);
  return ext === 'svg' || ext === 'svgz';
}

/** True when we should bake pixels to a browser-safe PNG after decode. */
export function shouldNormalizeToPng(file: File): boolean {
  if (NORMALIZE_EXT.test(file.name)) return true;
  const t = (file.type || '').toLowerCase();
  return (
    t.includes('heic') ||
    t.includes('heif') ||
    t.includes('tiff') ||
    t.includes('bmp') ||
    t.includes('icon') ||
    t.includes('jxl') ||
    t === 'image/x-icon'
  );
}

export function likelyHasAlpha(mimeOrName: string): boolean {
  return ALPHA_HINT.test(mimeOrName);
}

export type EncodeMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';

/** Pick a canvas encode target that preserves alpha and stays browser-friendly. */
export function preferEncodeMime(
  mimeHint: string,
  width: number,
  height: number
): EncodeMime {
  if (/jpe?g|jfif|pjp/i.test(mimeHint)) return 'image/jpeg';
  if (/webp/i.test(mimeHint)) return 'image/webp';
  if (/avif/i.test(mimeHint)) return 'image/avif';
  // PNG / GIF / SVG / ICO / TIFF… keep alpha via PNG
  if (likelyHasAlpha(mimeHint)) return 'image/png';
  // Huge opaque bitmaps → JPEG to save memory
  if (width * height > 8_000_000) return 'image/jpeg';
  return 'image/webp';
}

export function mimeToExtension(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('avif')) return 'avif';
  if (m.includes('svg')) return 'svg';
  if (m.includes('bmp')) return 'bmp';
  if (m.includes('tiff') || m.includes('tif')) return 'tiff';
  if (m.includes('heic')) return 'heic';
  if (m.includes('heif')) return 'heif';
  if (m.includes('jxl')) return 'jxl';
  if (m.includes('icon') || m.includes('x-icon')) return 'ico';
  if (m.includes('apng')) return 'apng';
  return 'png';
}

/** Export formats the canvas stack can produce in this browser. */
export type ExportImageFormat = 'png' | 'jpeg' | 'webp' | 'avif';

const EXPORT_MIME: Record<ExportImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

export function exportFormatToMime(format: ExportImageFormat): string {
  return EXPORT_MIME[format];
}

let avifEncodeSupported: boolean | null = null;

/** Feature-detect AVIF encoding via canvas (Chrome 108+). */
export async function isAvifEncodeSupported(): Promise<boolean> {
  if (avifEncodeSupported !== null) return avifEncodeSupported;
  if (typeof document === 'undefined') {
    avifEncodeSupported = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/avif', 0.8)
    );
    avifEncodeSupported = Boolean(blob && blob.type === 'image/avif' && blob.size > 0);
  } catch {
    avifEncodeSupported = false;
  }
  return avifEncodeSupported;
}

export function listExportFormats(avifOk: boolean): ExportImageFormat[] {
  return avifOk ? ['png', 'jpeg', 'webp', 'avif'] : ['png', 'jpeg', 'webp'];
}
