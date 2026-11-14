import Konva from 'konva';
import type { ImageAdjustments } from '@photoshop-lite/shared-types';

declare module 'konva' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Konva exposes Filters as a namespace
  namespace Filters {
    const PhotoAdjust: (imageData: ImageData) => void;
  }
}

let photoAdjustRegistered = false;

/** Register custom PhotoAdjust filter once (exposure, vibrance, temp, tint, sepia, sharpness). */
export function registerPhotoAdjustFilter(): void {
  if (photoAdjustRegistered) return;
  photoAdjustRegistered = true;

  (Konva.Filters as unknown as Record<string, (imageData: ImageData) => void>).PhotoAdjust =
    function (imageData: ImageData) {
      const data = imageData.data;
      const nPixels = data.length;

      const node = this as unknown as { photoAdjustments?: ImageAdjustments };
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

      const expMultiplier = Math.pow(2, exposure / 50);
      const tempR = temperature > 0 ? 1 + (temperature / 100) * 0.4 : 1;
      const tempB = temperature < 0 ? 1 + (-temperature / 100) * 0.4 : 1;
      const tintG = tint < 0 ? 1 + (-tint / 100) * 0.3 : 1;
      const tintM = tint > 0 ? 1 + (tint / 100) * 0.3 : 1;
      const vibFactor = vibrance / 100;

      for (let i = 0; i < nPixels; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        if (exposure !== 0) {
          r = Math.min(255, Math.max(0, r * expMultiplier));
          g = Math.min(255, Math.max(0, g * expMultiplier));
          b = Math.min(255, Math.max(0, b * expMultiplier));
        }

        if (temperature !== 0) {
          r = Math.min(255, Math.max(0, r * tempR));
          b = Math.min(255, Math.max(0, b * tempB));
        }

        if (tint !== 0) {
          g = Math.min(255, Math.max(0, g * tintG * (tint < 0 ? 1 : tintM)));
          if (tint > 0) {
            r = Math.min(255, Math.max(0, r * tintM));
            b = Math.min(255, Math.max(0, b * tintM));
          }
        }

        if (vibrance !== 0) {
          const max = Math.max(r, g, b);
          const avg = (r + g + b) / 3;
          const amt = ((Math.abs(max - avg) / 128) * vibFactor) * (max === avg ? 0 : 1);
          r = Math.min(255, Math.max(0, r + (r - avg) * amt));
          g = Math.min(255, Math.max(0, g + (g - avg) * amt));
          b = Math.min(255, Math.max(0, b + (b - avg) * amt));
        }

        if (sepia) {
          const sr = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
          const sg = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
          const sb = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
          r = sr;
          g = sg;
          b = sb;
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }

      if (sharpness > 0) {
        const w = imageData.width;
        const h = imageData.height;
        const copy = new Uint8ClampedArray(data);
        const amt = sharpness / 100;
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
}

registerPhotoAdjustFilter();

/** Apply ImageAdjustments to a Konva.Image via filters + cache. */
export function applyImageNodeFilters(
  imageNode: Konva.Image,
  adjustments: ImageAdjustments
): void {
  registerPhotoAdjustFilter();
  const filters: ((imageData: ImageData) => void)[] = [];

  if (adjustments.brightness !== 0) {
    filters.push(Konva.Filters.Brighten);
    imageNode.brightness(adjustments.brightness / 100);
  }

  if (adjustments.contrast !== 0) {
    filters.push(Konva.Filters.Contrast);
    imageNode.contrast(adjustments.contrast);
  }

  if (adjustments.hue !== 0 || adjustments.saturation !== 0) {
    filters.push(Konva.Filters.HSL);
    if (adjustments.hue !== 0) imageNode.hue(adjustments.hue);
    if (adjustments.saturation !== 0) {
      imageNode.saturation(adjustments.saturation / 50);
    }
  }

  if (adjustments.blur > 0) {
    filters.push(Konva.Filters.Blur);
    imageNode.blurRadius(adjustments.blur);
  }

  if (adjustments.grayscale) filters.push(Konva.Filters.Grayscale);
  if (adjustments.invert) filters.push(Konva.Filters.Invert);

  (imageNode as unknown as { photoAdjustments: ImageAdjustments }).photoAdjustments =
    adjustments;
  filters.push(
    (Konva.Filters as unknown as Record<string, (imgData: ImageData) => void>).PhotoAdjust
  );

  imageNode.clearCache();
  imageNode.filters(filters);
  imageNode.cache({ pixelRatio: Math.min(2, window.devicePixelRatio || 1) });
}
