import { ImageAdjustments } from '@photoshop-lite/shared-types';

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  sharpness: 0,
  blur: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  invert: false,
  grayscale: false,
  sepia: false,
};

export interface FilterPreset {
  id: string;
  name: string;
  adjustments: Partial<ImageAdjustments>;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'normal',
    name: 'Normal',
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  },
  {
    id: 'vivid',
    name: 'Vivid Pop',
    adjustments: {
      brightness: 4,
      contrast: 22,
      saturation: 30,
      vibrance: 25,
      sharpness: 15,
    },
  },
  {
    id: 'vintage',
    name: 'Vintage Film',
    adjustments: {
      brightness: -2,
      contrast: 15,
      saturation: -15,
      temperature: 30,
      sepia: true,
      exposure: -5,
    },
  },
  {
    id: 'warm-sunset',
    name: 'Warm Glow',
    adjustments: {
      brightness: 6,
      contrast: 12,
      temperature: 45,
      tint: 12,
      saturation: 18,
      vibrance: 15,
    },
  },
  {
    id: 'cool-slate',
    name: 'Cool Slate',
    adjustments: {
      brightness: 2,
      contrast: 18,
      temperature: -40,
      tint: -8,
      saturation: -12,
    },
  },
  {
    id: 'bw-dramatic',
    name: 'B&W Dramatic',
    adjustments: {
      contrast: 40,
      brightness: 6,
      grayscale: true,
      sharpness: 25,
      exposure: 5,
    },
  },
  {
    id: 'cinematic',
    name: 'Cinematic Mood',
    adjustments: {
      brightness: -3,
      contrast: 32,
      saturation: 12,
      temperature: 15,
      tint: -12,
      vibrance: 22,
      sharpness: 10,
    },
  },
  {
    id: 'soft-pastel',
    name: 'Soft Pastel',
    adjustments: {
      brightness: 12,
      contrast: -12,
      saturation: -15,
      temperature: 10,
      blur: 1,
    },
  },
];

/**
 * Analyzes image histogram and calculates optimal adjustments to auto-enhance / revive the photo.
 */
export function analyzeAndAutoEnhance(img: HTMLImageElement): ImageAdjustments {
  const canvas = document.createElement('canvas');
  const maxDimension = 400; // sample size for rapid histogram analysis
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(10, Math.floor((img.naturalWidth || img.width) * scale));
  const h = Math.max(10, Math.floor((img.naturalHeight || img.height) * scale));

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ...DEFAULT_ADJUSTMENTS };

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let totalLuminance = 0;
  let minLum = 255;
  let maxLum = 0;
  const lumHistogram = new Int32Array(256);
  let totalSat = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    lumHistogram[lum]++;
    totalLuminance += lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    totalSat += sat;
  }

  const numPixels = w * h;
  const avgLum = totalLuminance / numPixels;
  const avgSat = totalSat / numPixels;

  // 1% and 99% percentile cutoffs
  let count = 0;
  let p1 = 0;
  let p99 = 255;
  const p1Target = numPixels * 0.01;
  const p99Target = numPixels * 0.99;

  for (let l = 0; l < 256; l++) {
    count += lumHistogram[l];
    if (count >= p1Target && p1 === 0) p1 = l;
    if (count >= p99Target) {
      p99 = l;
      break;
    }
  }

  // Calculate brightness adjustment (target midtone around 128)
  let calculatedBrightness = Math.round(((128 - avgLum) / 128) * 35);
  calculatedBrightness = Math.max(-25, Math.min(30, calculatedBrightness));

  // Calculate contrast stretch (if dynamic range is compressed)
  const range = Math.max(20, p99 - p1);
  let calculatedContrast = Math.round(((255 - range) / 255) * 50);
  calculatedContrast = Math.max(10, Math.min(45, calculatedContrast));

  // Saturation boost if image looks washed out
  let calculatedSaturation = avgSat < 0.25 ? 30 : avgSat < 0.4 ? 18 : 8;
  const calculatedVibrance = 20;
  const calculatedSharpness = 25;
  const calculatedExposure = calculatedBrightness > 15 ? 5 : 0;

  return {
    ...DEFAULT_ADJUSTMENTS,
    brightness: calculatedBrightness,
    contrast: calculatedContrast,
    saturation: calculatedSaturation,
    vibrance: calculatedVibrance,
    sharpness: calculatedSharpness,
    exposure: calculatedExposure,
  };
}

/**
 * Perform high-quality client-side image upscaling with bicubic interpolation and unsharp mask.
 */
export async function clientSideSuperResolution(
  imageSrc: string,
  scaleFactor: number = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        const dw = Math.round(sw * scaleFactor);
        const dh = Math.round(sh * scaleFactor);

        const canvas = document.createElement('canvas');
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSrc);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, dw, dh);

        // Apply Unsharp Masking filter for crisp edge recovery
        const imgData = ctx.getImageData(0, 0, dw, dh);
        const data = imgData.data;
        const copy = new Uint8ClampedArray(data);

        // Simple Laplacian high-pass kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
        const amount = 0.4; // subtle sharpening amount
        const width = dw;
        const height = dh;

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            for (let c = 0; c < 3; c++) {
              const center = copy[idx + c];
              const top = copy[((y - 1) * width + x) * 4 + c];
              const bottom = copy[((y + 1) * width + x) * 4 + c];
              const left = copy[(y * width + (x - 1)) * 4 + c];
              const right = copy[(y * width + (x + 1)) * 4 + c];

              const sharp = center * 5 - (top + bottom + left + right);
              data[idx + c] = Math.min(255, Math.max(0, center * (1 - amount) + sharp * amount));
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}
