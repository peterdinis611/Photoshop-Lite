export const LOTTIE_EXTENSIONS = ['json', 'lottie'] as const;

/** `<input accept>` for Lottie / dotLottie. */
export const LOTTIE_ACCEPT = [
  '.json',
  '.lottie',
  'application/json',
  'application/zip',
].join(',');

function extensionOf(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? '';
}

/** True for Bodymovin JSON shape (not a PixelLite project). */
export function isLottieAnimationData(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.layers)) return false;
  if (typeof o.fr !== 'number' && typeof o.fr !== 'string') return false;
  if (typeof o.ip !== 'number' && typeof o.ip !== 'string') return false;
  if (typeof o.op !== 'number' && typeof o.op !== 'string') return false;
  // Project files also have layers[] — require Lottie composition size
  if (typeof o.w !== 'number' && typeof o.w !== 'string') return false;
  if (typeof o.h !== 'number' && typeof o.h !== 'string') return false;
  // PixelLite projects use typed EditorLayer objects with `type` + `id`
  const first = (o.layers as unknown[])[0];
  if (first && typeof first === 'object' && first !== null && 'type' in first && 'id' in first) {
    return false;
  }
  return true;
}

export function isLottieFile(file: File): boolean {
  const ext = extensionOf(file.name);
  if (ext === 'lottie') return true;
  if (ext === 'json') return true;
  if (file.type === 'application/json') return true;
  if (file.type === 'application/zip' && ext === 'lottie') return true;
  return false;
}

export function collectLottieFiles(fileList: FileList | File[] | null | undefined): File[] {
  if (!fileList) return [];
  return Array.from(fileList).filter(isLottieFile);
}
