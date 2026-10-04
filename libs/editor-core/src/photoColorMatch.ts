import { clamp } from './optimize';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for color match'));
    img.src = src;
  });
}

interface ChannelStats {
  meanR: number;
  meanG: number;
  meanB: number;
  stdR: number;
  stdG: number;
  stdB: number;
}

function sampleStats(img: HTMLImageElement): ChannelStats | null {
  const maxDim = 360;
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(nw, nh));
  const w = Math.max(8, Math.floor(nw * scale));
  const h = Math.max(8, Math.floor(nh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let n = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    n++;
  }
  if (n < 8) return null;
  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;

  let vR = 0;
  let vG = 0;
  let vB = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    vR += (data[i] - meanR) ** 2;
    vG += (data[i + 1] - meanG) ** 2;
    vB += (data[i + 2] - meanB) ** 2;
  }
  return {
    meanR,
    meanG,
    meanB,
    stdR: Math.sqrt(vR / n) || 1,
    stdG: Math.sqrt(vG / n) || 1,
    stdB: Math.sqrt(vB / n) || 1,
  };
}

/**
 * Reinhard-style color / grade transfer from a reference image onto `src`.
 * Matches mean + std per channel, blended by intensity.
 */
export async function bakeColorMatchPixels(
  src: string,
  referenceSrc: string,
  intensity = 0.8
): Promise<string> {
  const [img, ref] = await Promise.all([loadImage(src), loadImage(referenceSrc)]);
  const srcStats = sampleStats(img);
  const refStats = sampleStats(ref);
  if (!srcStats || !refStats) {
    throw new Error('Could not analyze images for color match');
  }

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const t = clamp(intensity, 0, 1);

  const scaleR = refStats.stdR / srcStats.stdR;
  const scaleG = refStats.stdG / srcStats.stdG;
  const scaleB = refStats.stdB / srcStats.stdB;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    const matchedR =
      (data[i] - srcStats.meanR) * scaleR + refStats.meanR;
    const matchedG =
      (data[i + 1] - srcStats.meanG) * scaleG + refStats.meanG;
    const matchedB =
      (data[i + 2] - srcStats.meanB) * scaleB + refStats.meanB;

    data[i] = clamp(Math.round(data[i] * (1 - t) + matchedR * t), 0, 255);
    data[i + 1] = clamp(Math.round(data[i + 1] * (1 - t) + matchedG * t), 0, 255);
    data[i + 2] = clamp(Math.round(data[i + 2] * (1 - t) + matchedB * t), 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
