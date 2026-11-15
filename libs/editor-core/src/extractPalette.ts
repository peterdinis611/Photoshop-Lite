export type ExtractedPalette = {
  colors: string[];
  /** Rough warmth (−1 cool … +1 warm) from dominant hue */
  warmth: number;
  /** Suggested grade tweaks derived from the palette */
  grade: {
    temperature: number;
    tint: number;
    saturation: number;
    vibrance: number;
    contrast: number;
  };
};

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for palette'));
    img.src = src;
  });
}

/** Bucket RGB into coarse bins and pick top-N by population. */
export async function extractPaletteFromImage(
  src: string,
  count = 5
): Promise<ExtractedPalette> {
  const img = await loadImage(src);
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas context');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Skip near-black / near-white for more useful accents
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 28 || min > 235) continue;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const cur = buckets.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, Math.max(3, count))
    .map((c) => rgbToHex(Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)));

  while (ranked.length < count) {
    ranked.push(ranked[ranked.length - 1] || '#d4923a');
  }

  const dominant = ranked[0];
  const warmth = hueWarmth(dominant);
  const grade = {
    temperature: Math.round(warmth * 28),
    tint: Math.round((1 - Math.abs(warmth)) * (warmth >= 0 ? 6 : -8)),
    saturation: 8 + Math.round(Math.abs(warmth) * 10),
    vibrance: 12 + Math.round(Math.abs(warmth) * 8),
    contrast: 6,
  };

  return { colors: ranked.slice(0, count), warmth, grade };
}

function hueWarmth(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const b = n & 255;
  // Simple warm/cool from R vs B balance
  return Math.max(-1, Math.min(1, (r - b) / 255));
}
