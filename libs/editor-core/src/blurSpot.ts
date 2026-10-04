/** Soft circular blur on an image at document coordinates. */
export async function applyBlurSpotToImage(
  src: string,
  layerX: number,
  layerY: number,
  clickX: number,
  clickY: number,
  radius: number,
  strength = 0.65
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);

  const lx = clickX - layerX;
  const ly = clickY - layerY;
  const r = Math.max(4, radius);
  const size = Math.ceil(r * 2);
  const sx = Math.max(0, Math.floor(lx - r));
  const sy = Math.max(0, Math.floor(ly - r));
  const sw = Math.min(size, canvas.width - sx);
  const sh = Math.min(size, canvas.height - sy);
  if (sw <= 0 || sh <= 0) return src;

  const tmp = document.createElement('canvas');
  tmp.width = sw;
  tmp.height = sh;
  const tctx = tmp.getContext('2d');
  if (!tctx) return src;

  tctx.filter = `blur(${Math.round(2 + strength * 6)}px)`;
  tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  ctx.save();
  ctx.beginPath();
  ctx.arc(lx, ly, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.35 + strength * 0.55;
  ctx.drawImage(tmp, sx, sy);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for blur'));
    img.src = src;
  });
}
