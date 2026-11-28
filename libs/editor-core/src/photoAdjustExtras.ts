import { clampByte, loadImageToCanvas } from './canvasUtils';

export interface GradientMapStop {
  offset: number;
  color: string;
}

function parseHex(color: string): [number, number, number] {
  const c = color.trim();
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    if (c.length === 4) {
      const r = parseInt(c[1] + c[1], 16);
      const g = parseInt(c[2] + c[2], 16);
      const b = parseInt(c[3] + c[3], 16);
      return [r, g, b];
    }
    return [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
  }
  return [128, 128, 128];
}

function lerpStop(
  stops: GradientMapStop[],
  t: number
): [number, number, number] {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (sorted.length === 0) return [128, 128, 128];
  if (sorted.length === 1) return parseHex(sorted[0].color);
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1].offset < x) i += 1;
  const a = sorted[i];
  const b = sorted[Math.min(sorted.length - 1, i + 1)];
  const span = Math.max(1e-6, b.offset - a.offset);
  const u = (x - a.offset) / span;
  const ca = parseHex(a.color);
  const cb = parseHex(b.color);
  return [
    ca[0] + (cb[0] - ca[0]) * u,
    ca[1] + (cb[1] - ca[1]) * u,
    ca[2] + (cb[2] - ca[2]) * u,
  ];
}

/** Map luminance → gradient stops (Photoshop Gradient Map approx). */
export function applyGradientMapImageData(
  data: ImageData,
  stops: GradientMapStop[],
  amount = 1
): void {
  const mix = Math.max(0, Math.min(1, amount));
  if (mix <= 0 || stops.length === 0) return;
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const [r, g, b] = lerpStop(stops, lum);
    px[i] = clampByte(px[i] * (1 - mix) + r * mix);
    px[i + 1] = clampByte(px[i + 1] * (1 - mix) + g * mix);
    px[i + 2] = clampByte(px[i + 2] * (1 - mix) + b * mix);
  }
}

/** Photo Filter wash. `density` 0–1. */
export function applyPhotoFilterImageData(
  data: ImageData,
  color: string,
  density: number,
  preserveLuminosity = true
): void {
  const mix = Math.max(0, Math.min(1, density));
  if (mix <= 0) return;
  const [fr, fg, fb] = parseHex(color);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r0 = px[i];
    const g0 = px[i + 1];
    const b0 = px[i + 2];
    let r = r0 * (1 - mix) + fr * mix;
    let g = g0 * (1 - mix) + fg * mix;
    let b = b0 * (1 - mix) + fb * mix;
    if (preserveLuminosity) {
      const lum0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
      const lum1 = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum1 > 1e-3) {
        const s = lum0 / lum1;
        r *= s;
        g *= s;
        b *= s;
      }
    }
    px[i] = clampByte(r);
    px[i + 1] = clampByte(g);
    px[i + 2] = clampByte(b);
  }
}

export async function bakeGradientMap(
  src: string,
  stops: GradientMapStop[],
  amount = 1
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'gradient map');
  if (!loaded) return src;
  const { canvas, ctx, width, height } = loaded;
  const imageData = ctx.getImageData(0, 0, width, height);
  applyGradientMapImageData(imageData, stops, amount);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function bakePhotoFilter(
  src: string,
  color: string,
  density: number,
  preserveLuminosity = true
): Promise<string> {
  const loaded = await loadImageToCanvas(src, 'photo filter');
  if (!loaded) return src;
  const { canvas, ctx, width, height } = loaded;
  const imageData = ctx.getImageData(0, 0, width, height);
  applyPhotoFilterImageData(imageData, color, density, preserveLuminosity);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
