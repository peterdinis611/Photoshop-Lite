import Konva from 'konva';
import { ImageAdjustments } from '../../types/editor';

// Augment Konva.Filters namespace
declare module 'konva' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Konva exposes Filters as a namespace
  namespace Filters {
    const PhotoAdjust: (imageData: ImageData) => void;
  }
}

// Custom Konva filter for Temperature, Tint, Exposure, Vibrance, Sharpness & Sepia
(Konva.Filters as unknown as Record<string, (imageData: ImageData) => void>).PhotoAdjust = function (
  imageData: ImageData
) {
  const data = imageData.data;
  const nPixels = data.length;

  // Retrieve adjustments from node attribute
  const node = this as unknown as {
    photoAdjustments?: ImageAdjustments;
  };
  const adj = node.photoAdjustments;
  if (!adj) return;

  const {
    exposure = 0,
    vibrance = 0,
    temperature = 0,
    tint = 0,
    sepia = false,
    sharpness = 0,
  } = adj;

  // Pre-calculate coefficients
  const expMultiplier = Math.pow(2, exposure / 50); // -100 to 100 -> exposure stops
  const tempR = temperature > 0 ? 1 + (temperature / 100) * 0.4 : 1;
  const tempB = temperature < 0 ? 1 + (-temperature / 100) * 0.4 : 1;
  const tintG = tint < 0 ? 1 + (-tint / 100) * 0.3 : 1;
  const tintM = tint > 0 ? 1 + (tint / 100) * 0.3 : 1;
  const vibFactor = vibrance / 100;

  for (let i = 0; i < nPixels; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Exposure adjustment
    if (exposure !== 0) {
      r = Math.min(255, Math.max(0, r * expMultiplier));
      g = Math.min(255, Math.max(0, g * expMultiplier));
      b = Math.min(255, Math.max(0, b * expMultiplier));
    }

    // Temperature & Tint adjustment
    if (temperature !== 0 || tint !== 0) {
      r = Math.min(255, Math.max(0, r * tempR * tintM));
      g = Math.min(255, Math.max(0, g * tintG));
      b = Math.min(255, Math.max(0, b * tempB * tintM));
    }

    // Vibrance adjustment (selectively boosts less-saturated colors)
    if (vibrance !== 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const amt = (1 - sat) * vibFactor;
      const avg = (r + g + b) / 3;

      r = Math.min(255, Math.max(0, r + (r - avg) * amt));
      g = Math.min(255, Math.max(0, g + (g - avg) * amt));
      b = Math.min(255, Math.max(0, b + (b - avg) * amt));
    }

    // Sepia filter
    if (sepia) {
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = Math.min(255, tr);
      g = Math.min(255, tg);
      b = Math.min(255, tb);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  // Sharpness (Simple 3x3 unsharp kernel if sharpness > 0)
  if (sharpness > 0) {
    const w = imageData.width;
    const h = imageData.height;
    const copy = new Uint8ClampedArray(data);
    const amt = (sharpness / 100) * 0.6;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const top = copy[((y - 1) * w + x) * 4 + c];
          const bottom = copy[((y + 1) * w + x) * 4 + c];
          const left = copy[(y * w + (x - 1)) * 4 + c];
          const right = copy[(y * w + (x + 1)) * 4 + c];
          const sharp = center * 5 - (top + bottom + left + right);
          data[idx + c] = Math.min(255, Math.max(0, center * (1 - amt) + sharp * amt));
        }
      }
    }
  }
};

export const applyImageNodeFilters = (
  imageNode: Konva.Image,
  adjustments: ImageAdjustments
) => {
  const filters: ((imageData: ImageData) => void)[] = [];

  // Brightness: Konva uses -1 to 1 (we map -100..100 -> -1..1)
  if (adjustments.brightness !== 0) {
    filters.push(Konva.Filters.Brighten);
    imageNode.brightness(adjustments.brightness / 100);
  }

  // Contrast: Konva uses -100 to 100
  if (adjustments.contrast !== 0) {
    filters.push(Konva.Filters.Contrast);
    imageNode.contrast(adjustments.contrast);
  }

  // HSL: Hue & Saturation
  if (adjustments.hue !== 0 || adjustments.saturation !== 0) {
    filters.push(Konva.Filters.HSL);
    if (adjustments.hue !== 0) {
      imageNode.hue(adjustments.hue);
    }
    if (adjustments.saturation !== 0) {
      imageNode.saturation(adjustments.saturation / 50); // -100..100 -> -2..2
    }
  }

  // Blur
  if (adjustments.blur > 0) {
    filters.push(Konva.Filters.Blur);
    imageNode.blurRadius(adjustments.blur);
  }

  // Grayscale
  if (adjustments.grayscale) {
    filters.push(Konva.Filters.Grayscale);
  }

  // Invert
  if (adjustments.invert) {
    filters.push(Konva.Filters.Invert);
  }

  // PhotoAdjust custom filter (exposure, vibrance, temp, tint, sepia, sharpness)
  (imageNode as unknown as { photoAdjustments: ImageAdjustments }).photoAdjustments = adjustments;
  filters.push((Konva.Filters as unknown as Record<string, (imgData: ImageData) => void>).PhotoAdjust);

  imageNode.filters(filters);
  imageNode.cache();
};
