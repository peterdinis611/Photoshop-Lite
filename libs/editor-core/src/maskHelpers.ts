/**
 * Paint a brush stroke onto a layer mask (white = reveal, black = hide).
 * Stroke points are in document/canvas coordinates.
 */
export async function paintStrokeOnMask(params: {
  maskSrc: string;
  layerX: number;
  layerY: number;
  layerWidth: number;
  layerHeight: number;
  points: number[];
  size: number;
  erase: boolean;
}): Promise<string> {
  const {
    maskSrc,
    layerX,
    layerY,
    layerWidth,
    layerHeight,
    points,
    size,
    erase,
  } = params;

  const img = await loadImage(maskSrc);
  const canvas = document.createElement('canvas');
  canvas.width = layerWidth;
  canvas.height = layerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return maskSrc;

  ctx.drawImage(img, 0, 0, layerWidth, layerHeight);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size;

  if (erase) {
    // Punch holes (transparent) — destination-in compositing hides these
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    // Restore visibility with opaque white
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff';
  }

  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    const lx = points[i] - layerX;
    const ly = points[i + 1] - layerY;
    if (i === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  }
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Clear (make transparent) a rectangular region of an image layer.
 * Rect is in document coordinates.
 */
export async function clearImageRect(params: {
  src: string;
  layerX: number;
  layerY: number;
  layerWidth: number;
  layerHeight: number;
  rect: { x: number; y: number; width: number; height: number };
}): Promise<string> {
  return clearImageSelection({
    ...params,
    selection: { ...params.rect, mode: 'rect' },
  });
}

/**
 * Clear pixels under a selection (rect, ellipse, or closed lasso path).
 * Selection coords are in document space.
 */
export async function clearImageSelection(params: {
  src: string;
  layerX: number;
  layerY: number;
  layerWidth: number;
  layerHeight: number;
  selection: {
    x: number;
    y: number;
    width: number;
    height: number;
    mode?: 'rect' | 'ellipse';
    path?: number[];
  };
}): Promise<string> {
  const { src, layerX, layerY, layerWidth, layerHeight, selection } = params;
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = layerWidth;
  canvas.height = layerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0, layerWidth, layerHeight);
  ctx.save();
  ctx.beginPath();

  if (selection.path && selection.path.length >= 6) {
    const [fx, fy, ...rest] = selection.path;
    ctx.moveTo(fx - layerX, fy - layerY);
    for (let i = 0; i < rest.length; i += 2) {
      ctx.lineTo(rest[i] - layerX, rest[i + 1] - layerY);
    }
    ctx.closePath();
  } else if (selection.mode === 'ellipse') {
    const cx = selection.x - layerX + selection.width / 2;
    const cy = selection.y - layerY + selection.height / 2;
    ctx.ellipse(cx, cy, Math.abs(selection.width) / 2, Math.abs(selection.height) / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.rect(selection.x - layerX, selection.y - layerY, selection.width, selection.height);
  }

  ctx.clip();
  ctx.clearRect(0, 0, layerWidth, layerHeight);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Magic wand: find bounding box of similar-colored pixels around a click.
 * Returns document-space selection or null if nothing matched.
 */
export async function magicWandBounds(params: {
  src: string;
  layerX: number;
  layerY: number;
  layerWidth: number;
  layerHeight: number;
  clickX: number;
  clickY: number;
  tolerance?: number;
}): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const {
    src,
    layerX,
    layerY,
    layerWidth,
    layerHeight,
    clickX,
    clickY,
    tolerance = 32,
  } = params;

  const lx = Math.round(clickX - layerX);
  const ly = Math.round(clickY - layerY);
  if (lx < 0 || ly < 0 || lx >= layerWidth || ly >= layerHeight) return null;

  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = layerWidth;
  canvas.height = layerHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, layerWidth, layerHeight);

  const { data, width, height } = ctx.getImageData(0, 0, layerWidth, layerHeight);
  const idx = (ly * width + lx) * 4;
  const tr = data[idx];
  const tg = data[idx + 1];
  const tb = data[idx + 2];
  const ta = data[idx + 3];
  if (ta < 8) return null;

  const match = (i: number) => {
    const a = data[i + 3];
    if (a < 8) return false;
    return (
      Math.abs(data[i] - tr) <= tolerance &&
      Math.abs(data[i + 1] - tg) <= tolerance &&
      Math.abs(data[i + 2] - tb) <= tolerance
    );
  };

  const visited = new Uint8Array(width * height);
  const stack = [lx, ly];
  visited[ly * width + lx] = 1;
  let minX = lx;
  let maxX = lx;
  let minY = ly;
  let maxY = ly;
  let count = 0;
  const maxPixels = Math.min(width * height, 250_000);

  while (stack.length > 0 && count < maxPixels) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    count += 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const vi = ny * width + nx;
      if (visited[vi]) continue;
      if (!match(vi * 4)) continue;
      visited[vi] = 1;
      stack.push(nx, ny);
    }
  }

  if (count < 4) return null;
  return {
    x: layerX + minX,
    y: layerY + minY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
  };
}
