import { clamp } from './optimize';

export type RelightMode = 'softbox' | 'rim' | 'golden';

export interface RelightModeMeta {
  id: RelightMode;
  label: string;
  blurb: string;
}

export const RELIGHT_MODES: RelightModeMeta[] = [
  {
    id: 'softbox',
    label: 'Softbox',
    blurb: 'Even studio fill — flattens harsh shadows',
  },
  {
    id: 'rim',
    label: 'Rim light',
    blurb: 'Edge glow from behind — subject pops from background',
  },
  {
    id: 'golden',
    label: 'Golden hour',
    blurb: 'Warm low sun — soft contrast and amber highlights',
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for relight'));
    img.src = src;
  });
}

function paintLightMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: RelightMode,
  intensity: number
) {
  const t = clamp(intensity, 0.2, 1);
  ctx.clearRect(0, 0, w, h);

  if (mode === 'softbox') {
    // Soft key from upper-left + gentle fill
    const key = ctx.createRadialGradient(w * 0.28, h * 0.18, 0, w * 0.4, h * 0.35, Math.max(w, h) * 0.85);
    key.addColorStop(0, `rgba(255,252,245,${0.55 * t})`);
    key.addColorStop(0.45, `rgba(255,248,235,${0.22 * t})`);
    key.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, w, h);

    const fill = ctx.createRadialGradient(w * 0.75, h * 0.7, 0, w * 0.7, h * 0.65, Math.max(w, h) * 0.7);
    fill.addColorStop(0, `rgba(210,225,255,${0.18 * t})`);
    fill.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
  } else if (mode === 'rim') {
    // Darken center slightly, bright rim from back-right
    const shade = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    shade.addColorStop(0, `rgba(0,0,0,${0.12 * t})`);
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    const rim = ctx.createRadialGradient(w * 0.92, h * 0.35, 0, w * 0.75, h * 0.45, Math.max(w, h) * 0.55);
    rim.addColorStop(0, `rgba(255,255,255,${0.7 * t})`);
    rim.addColorStop(0.35, `rgba(220,235,255,${0.35 * t})`);
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, w, h);

    const kick = ctx.createRadialGradient(w * 0.08, h * 0.65, 0, w * 0.2, h * 0.6, Math.max(w, h) * 0.4);
    kick.addColorStop(0, `rgba(180,200,255,${0.25 * t})`);
    kick.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = kick;
    ctx.fillRect(0, 0, w, h);
  } else {
    // Golden hour — warm low sun from left + cool shadow lift
    const sun = ctx.createRadialGradient(w * 0.05, h * 0.35, 0, w * 0.35, h * 0.5, Math.max(w, h) * 0.9);
    sun.addColorStop(0, `rgba(255,200,120,${0.55 * t})`);
    sun.addColorStop(0.4, `rgba(255,160,80,${0.28 * t})`);
    sun.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    const ambient = ctx.createLinearGradient(0, 0, w, h);
    ambient.addColorStop(0, `rgba(255,220,160,${0.12 * t})`);
    ambient.addColorStop(0.55, 'rgba(0,0,0,0)');
    ambient.addColorStop(1, `rgba(40,60,120,${0.1 * t})`);
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * Studio / natural relight bake — gradient light maps + soft luminance blend.
 * Keeps detail; does not invent geometry (client-side approximation).
 */
export async function bakeRelightPixels(
  src: string,
  mode: RelightMode = 'softbox',
  intensity = 0.7
): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w < 2 || h < 2) return src;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);
  const base = ctx.getImageData(0, 0, w, h);

  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = w;
  lightCanvas.height = h;
  const lctx = lightCanvas.getContext('2d');
  if (!lctx) return src;
  paintLightMap(lctx, w, h, mode, intensity);
  const light = lctx.getImageData(0, 0, w, h);

  const out = ctx.createImageData(w, h);
  const srcData = base.data;
  const lit = light.data;
  const dst = out.data;
  const t = clamp(intensity, 0.2, 1);

  for (let i = 0; i < srcData.length; i += 4) {
    const a = srcData[i + 3];
    if (a === 0) {
      dst[i + 3] = 0;
      continue;
    }

    const r = srcData[i];
    const g = srcData[i + 1];
    const b = srcData[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Light map as add + soft screen; shadows get a touch of multiply for rim/golden
    const lr = lit[i] / 255;
    const lg = lit[i + 1] / 255;
    const lb = lit[i + 2] / 255;
    const la = lit[i + 3] / 255;

    const add = 0.55 * t * la;
    const screen = 0.35 * t * la;

    let nr = r + lr * 255 * add;
    let ng = g + lg * 255 * add;
    let nb = b + lb * 255 * add;

    nr = nr + (255 - nr) * lr * screen;
    ng = ng + (255 - ng) * lg * screen;
    nb = nb + (255 - nb) * lb * screen;

    if (mode === 'rim' || mode === 'golden') {
      // Slightly deepen mid shadows opposite the key
      const shadow = (1 - Math.max(lr, lg, lb)) * 0.12 * t * (1 - lum);
      nr *= 1 - shadow;
      ng *= 1 - shadow * (mode === 'golden' ? 0.85 : 1);
      nb *= 1 - shadow * (mode === 'golden' ? 0.7 : 1);
    }

    if (mode === 'golden') {
      // Warm midtone push
      nr = nr * (1 + 0.06 * t) + 8 * t;
      ng = ng * (1 + 0.02 * t) + 3 * t;
      nb = nb * (1 - 0.04 * t);
    }

    dst[i] = clamp(Math.round(nr), 0, 255);
    dst[i + 1] = clamp(Math.round(ng), 0, 255);
    dst[i + 2] = clamp(Math.round(nb), 0, 255);
    dst[i + 3] = a;
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Cloud / Replicate prompt for each studio look */
export function relightCloudPrompt(mode: RelightMode): string {
  switch (mode) {
    case 'softbox':
      return 'professional studio softbox lighting, even soft key light, photorealistic portrait lighting, natural skin, match original subject';
    case 'rim':
      return 'dramatic rim lighting, back edge light separating subject, cinematic photorealistic, preserve identity';
    case 'golden':
      return 'golden hour warm sunlight, soft amber highlights, gentle contrast, photorealistic outdoor light';
  }
}
