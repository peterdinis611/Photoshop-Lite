import { unzipSync } from 'fflate';
import {
  collectLottieFiles,
  isLottieAnimationData,
  isLottieFile,
  LOTTIE_ACCEPT,
  LOTTIE_EXTENSIONS,
} from './lottieDetect';

export {
  collectLottieFiles,
  isLottieAnimationData,
  isLottieFile,
  LOTTIE_ACCEPT,
  LOTTIE_EXTENSIONS,
};

export interface LoadedLottieFile {
  name: string;
  width: number;
  height: number;
  animationData: Record<string, unknown>;
  file: File;
}

function baseName(file: File): string {
  return file.name.replace(/\.[^/.]+$/, '') || 'Lottie';
}

function extensionOf(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? '';
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function mimeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

/** Embed external image assets from a .lottie zip into the animation JSON. */
function embedZipAssets(
  animationData: Record<string, unknown>,
  files: Record<string, Uint8Array>
): Record<string, unknown> {
  const assets = animationData.assets;
  if (!Array.isArray(assets)) return animationData;

  const keys = Object.keys(files);
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object') continue;
    const a = asset as Record<string, unknown>;
    if (a.e === 1) continue;
    const fileName = typeof a.p === 'string' ? a.p : '';
    if (!fileName || fileName.startsWith('data:')) continue;

    const match =
      keys.find((k) => k === fileName || k.endsWith(`/${fileName}`)) ||
      keys.find((k) => k.endsWith(`images/${fileName}`)) ||
      keys.find((k) => k.split('/').pop() === fileName);

    if (!match) continue;
    a.u = '';
    a.p = bytesToDataUrl(files[match], mimeForPath(match));
    a.e = 1;
  }
  return animationData;
}

async function loadDotLottie(file: File): Promise<Record<string, unknown>> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf);
  } catch {
    throw new Error(`“${file.name}” is not a valid .lottie archive`);
  }

  const decoder = new TextDecoder();
  const manifestBytes = files['manifest.json'];
  let animPath: string | null = null;

  if (manifestBytes) {
    try {
      const manifest = JSON.parse(decoder.decode(manifestBytes)) as {
        animations?: Array<string | { id?: string }>;
      };
      const entry = manifest.animations?.[0];
      const id = typeof entry === 'string' ? entry : entry?.id;
      if (id) animPath = `animations/${id}.json`;
    } catch {
      /* fall through */
    }
  }

  if (!animPath || !files[animPath]) {
    animPath =
      Object.keys(files).find((k) => /^animations\/.+\.json$/i.test(k)) ??
      Object.keys(files).find((k) => k.endsWith('.json') && k !== 'manifest.json') ??
      null;
  }

  if (!animPath || !files[animPath]) {
    throw new Error(`No animation JSON found inside “${file.name}”`);
  }

  let data: unknown;
  try {
    data = JSON.parse(decoder.decode(files[animPath]));
  } catch {
    throw new Error(`Corrupt animation JSON in “${file.name}”`);
  }

  if (!isLottieAnimationData(data)) {
    throw new Error(`“${file.name}” does not contain a Lottie composition`);
  }

  return embedZipAssets(structuredClone(data), files);
}

async function loadLottieJson(file: File): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(`“${file.name}” is not valid JSON`);
  }
  if (!isLottieAnimationData(data)) {
    throw new Error(
      `“${file.name}” is not a Lottie file (open projects via File → Open Project)`
    );
  }
  return structuredClone(data);
}

export async function loadLottieFile(file: File): Promise<LoadedLottieFile> {
  const ext = extensionOf(file.name);
  const animationData =
    ext === 'lottie' ? await loadDotLottie(file) : await loadLottieJson(file);

  const width = Math.max(1, Math.round(asNumber(animationData.w, 512)));
  const height = Math.max(1, Math.round(asNumber(animationData.h, 512)));

  return {
    name: baseName(file),
    width,
    height,
    animationData,
    file,
  };
}

export async function loadLottieFiles(files: File[]): Promise<LoadedLottieFile[]> {
  const out: LoadedLottieFile[] = [];
  for (const file of collectLottieFiles(files)) {
    try {
      out.push(await loadLottieFile(file));
    } catch {
      /* skip bad files — caller may toast */
    }
  }
  return out;
}

/**
 * Rasterize a single frame of a Lottie composition to a PNG object URL.
 * Used for “Bake frame → image layer”.
 */
export async function rasterizeLottieFrame(
  animationData: Record<string, unknown>,
  width: number,
  height: number,
  frame?: number
): Promise<string> {
  const lottie = (await import('lottie-web')).default;
  type AnimationItem = import('lottie-web').AnimationItem;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas unavailable'));
      return;
    }

    let anim: AnimationItem | null = null;
    try {
      anim = lottie.loadAnimation({
        renderer: 'canvas',
        loop: false,
        autoplay: false,
        animationData: structuredClone(animationData),
        rendererSettings: {
          context: ctx,
          clearCanvas: true,
          preserveAspectRatio: 'xMidYMid meet',
        },
      } as Parameters<typeof lottie.loadAnimation>[0]);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to load Lottie'));
      return;
    }

    const finish = () => {
      try {
        canvas.toBlob(
          (blob) => {
            anim?.destroy();
            if (!blob) {
              reject(new Error('Failed to encode Lottie frame'));
              return;
            }
            resolve(URL.createObjectURL(blob));
          },
          'image/png'
        );
      } catch (err) {
        anim?.destroy();
        reject(err instanceof Error ? err : new Error('Failed to encode Lottie frame'));
      }
    };

    anim.addEventListener('DOMLoaded', () => {
      const total = anim!.totalFrames;
      const target =
        frame !== undefined
          ? Math.max(0, Math.min(total - 1, frame))
          : Math.max(0, Math.floor(total / 2));
      anim!.goToAndStop(target, true);
      requestAnimationFrame(() => requestAnimationFrame(finish));
    });
  });
}
