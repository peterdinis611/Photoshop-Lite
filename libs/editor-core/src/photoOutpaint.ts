export type OutpaintPreset = 'expand' | '16:9' | '1:1' | '9:16' | '4:5';

export interface OutpaintModeMeta {
  id: OutpaintPreset;
  label: string;
  blurb: string;
}

export const OUTPAINT_PRESETS: OutpaintModeMeta[] = [
  {
    id: 'expand',
    label: '+15%',
    blurb: 'Grow canvas evenly on all sides',
  },
  {
    id: '16:9',
    label: '16:9',
    blurb: 'Widen to cinematic widescreen',
  },
  {
    id: '1:1',
    label: '1:1',
    blurb: 'Square crop-friendly frame',
  },
  {
    id: '9:16',
    label: '9:16',
    blurb: 'Tall story / Reel frame',
  },
  {
    id: '4:5',
    label: '4:5',
    blurb: 'Portrait social frame',
  },
];

export interface OutpaintLayout {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** Compute new canvas size + content offset (where old (0,0) lands). */
export function computeOutpaintLayout(
  canvasWidth: number,
  canvasHeight: number,
  preset: OutpaintPreset,
  expandRatio = 0.15
): OutpaintLayout {
  const cw = Math.max(50, canvasWidth);
  const ch = Math.max(50, canvasHeight);

  if (preset === 'expand') {
    const padX = Math.round(cw * expandRatio);
    const padY = Math.round(ch * expandRatio);
    return {
      width: cw + padX * 2,
      height: ch + padY * 2,
      offsetX: padX,
      offsetY: padY,
    };
  }

  const ratios: Record<Exclude<OutpaintPreset, 'expand'>, number> = {
    '16:9': 16 / 9,
    '1:1': 1,
    '9:16': 9 / 16,
    '4:5': 4 / 5,
  };
  const target = ratios[preset];
  const current = cw / ch;

  let width = cw;
  let height = ch;
  if (current < target) {
    // need wider
    width = Math.round(ch * target);
    height = ch;
  } else if (current > target) {
    // need taller
    width = cw;
    height = Math.round(cw / target);
  } else {
    // already matches — still expand a little so outpaint has room
    width = Math.round(cw * (1 + expandRatio));
    height = Math.round(ch * (1 + expandRatio));
  }

  // Ensure we're at least as large as original
  width = Math.max(width, cw);
  height = Math.max(height, ch);

  return {
    width,
    height,
    offsetX: Math.round((width - cw) / 2),
    offsetY: Math.round((height - ch) / 2),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for outpaint'));
    img.src = src;
  });
}

/** Flatten an image source to exact pixel size (document / layer display size). */
export async function rasterizeImageToSize(
  src: string,
  width: number,
  height: number
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/**
 * Expand an image into a larger frame and fill new borders by edge stretch + soft blur.
 * Returns new object/data URL and dimensions. Original content stays at (padL, padT).
 */
export async function expandImageWithEdgeFill(
  src: string,
  padL: number,
  padT: number,
  padR: number,
  padB: number
): Promise<{ src: string; width: number; height: number }> {
  const img = await loadImage(src);
  const ow = img.naturalWidth || img.width;
  const oh = img.naturalHeight || img.height;
  const nw = Math.max(1, ow + padL + padR);
  const nh = Math.max(1, oh + padT + padB);

  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { src, width: ow, height: oh };
  }

  // 1) Stretch whole image to fill (rough base)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, nw, nh);

  // 2) Soften the stretched base
  ctx.filter = 'blur(10px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  // 3) Draw sharp original centered in the padded region
  ctx.drawImage(img, padL, padT, ow, oh);

  // 4) Feather edge strips slightly into the fill for a softer seam
  const feather = Math.min(24, Math.max(padL, padT, padR, padB, 8));
  if (padL > 0) {
    ctx.drawImage(img, 0, 0, 1, oh, padL - feather, padT, feather, oh);
  }
  if (padR > 0) {
    ctx.drawImage(img, ow - 1, 0, 1, oh, padL + ow, padT, feather, oh);
  }
  if (padT > 0) {
    ctx.drawImage(img, 0, 0, ow, 1, padL, padT - feather, ow, feather);
  }
  if (padB > 0) {
    ctx.drawImage(img, 0, oh - 1, ow, 1, padL, padT + oh, ow, feather);
  }

  // Re-draw sharp original on top
  ctx.drawImage(img, padL, padT, ow, oh);

  return {
    src: canvas.toDataURL('image/png'),
    width: nw,
    height: nh,
  };
}

/** White = generate (border), black = keep (original inset). */
export async function buildOutpaintBorderMask(
  width: number,
  height: number,
  insetX: number,
  insetY: number,
  insetW: number,
  insetH: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(insetX, insetY, insetW, insetH);
  return canvas.toDataURL('image/png');
}
