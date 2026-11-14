export type ColorizePreset = 'sepia' | 'warm' | 'cool' | 'teal-orange' | 'rose' | 'forest';

export interface ColorizePresetMeta {
  id: ColorizePreset;
  label: string;
  blurb: string;
}

export const COLORIZE_PRESETS: ColorizePresetMeta[] = [
  { id: 'sepia', label: 'Sepia', blurb: 'Classic warm brown tone' },
  { id: 'warm', label: 'Warm', blurb: 'Golden hour lift' },
  { id: 'cool', label: 'Cool', blurb: 'Blue / cyan cast' },
  { id: 'teal-orange', label: 'Teal · Orange', blurb: 'Cinematic split' },
  { id: 'rose', label: 'Rose', blurb: 'Soft magenta wash' },
  { id: 'forest', label: 'Forest', blurb: 'Deep green grade' },
];

type Rgb = [number, number, number];

const LUT: Record<ColorizePreset, { shadows: Rgb; mid: Rgb; highlights: Rgb }> = {
  sepia: { shadows: [62, 42, 20], mid: [170, 130, 80], highlights: [245, 220, 170] },
  warm: { shadows: [40, 28, 18], mid: [190, 140, 90], highlights: [255, 235, 200] },
  cool: { shadows: [18, 28, 48], mid: [90, 130, 180], highlights: [200, 230, 255] },
  'teal-orange': { shadows: [10, 60, 70], mid: [40, 120, 130], highlights: [240, 170, 90] },
  rose: { shadows: [50, 20, 40], mid: [180, 100, 140], highlights: [255, 210, 230] },
  forest: { shadows: [15, 35, 20], mid: [60, 120, 70], highlights: [200, 230, 180] },
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixTone(lum: number, preset: ColorizePreset): Rgb {
  const { shadows, mid, highlights } = LUT[preset];
  if (lum < 0.5) {
    const t = lum * 2;
    return [
      lerp(shadows[0], mid[0], t),
      lerp(shadows[1], mid[1], t),
      lerp(shadows[2], mid[2], t),
    ];
  }
  const t = (lum - 0.5) * 2;
  return [
    lerp(mid[0], highlights[0], t),
    lerp(mid[1], highlights[1], t),
    lerp(mid[2], highlights[2], t),
  ];
}

/**
 * Client-side colorize / duotone grade.
 * Works especially well on B&W or flat photos — no API key.
 */
export async function colorizeImageSource(
  src: string,
  preset: ColorizePreset = 'sepia',
  intensity = 0.85
): Promise<string> {
  const amt = Math.min(1, Math.max(0, intensity));
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const [tr, tg, tb] = mixTone(lum, preset);
    d[i] = Math.round(lerp(r, tr, amt));
    d[i + 1] = Math.round(lerp(g, tg, amt));
    d[i + 2] = Math.round(lerp(b, tb, amt));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
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
