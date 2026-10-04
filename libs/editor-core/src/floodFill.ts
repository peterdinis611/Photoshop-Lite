/**
 * Flood-fill pixels on an image data URL (contiguous similar colors).
 */
export async function floodFillImage(options: {
  src: string;
  layerX: number;
  layerY: number;
  clickX: number;
  clickY: number;
  fillColor: string;
  tolerance?: number;
}): Promise<string | null> {
  const { src, layerX, layerY, clickX, clickY, fillColor, tolerance = 28 } = options;
  const lx = Math.floor(clickX - layerX);
  const ly = Math.floor(clickY - layerY);

  const img = await loadImage(src);
  if (lx < 0 || ly < 0 || lx >= img.naturalWidth || ly >= img.naturalHeight) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const startIdx = (ly * width + lx) * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];
  const ta = data[startIdx + 3];

  const fill = parseHexColor(fillColor);
  if (colorClose(tr, tg, tb, ta, fill.r, fill.g, fill.b, 255, 2)) {
    return null; // already filled
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [lx, ly];

  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = y * width + x;
    if (visited[i]) continue;
    visited[i] = 1;

    const p = i * 4;
    if (!colorClose(data[p], data[p + 1], data[p + 2], data[p + 3], tr, tg, tb, ta, tolerance)) {
      continue;
    }

    data[p] = fill.r;
    data[p + 1] = fill.g;
    data[p + 2] = fill.b;
    data[p + 3] = 255;

    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for fill'));
    img.src = src;
  });
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function colorClose(
  r1: number,
  g1: number,
  b1: number,
  a1: number,
  r2: number,
  g2: number,
  b2: number,
  a2: number,
  tol: number
): boolean {
  return (
    Math.abs(r1 - r2) <= tol &&
    Math.abs(g1 - g2) <= tol &&
    Math.abs(b1 - b2) <= tol &&
    Math.abs(a1 - a2) <= tol
  );
}
