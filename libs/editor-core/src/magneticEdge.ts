/**
 * Edge cost helpers for the magnetic lasso. Pure math on RGBA pixel buffers so it runs in
 * node (tests) as well as the browser.
 */

export interface PixelBuffer {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
}

/** Sobel gradient magnitude of the Rec.709 luminance, one float per pixel (row-major). */
export function buildLuminanceGradient(imageData: PixelBuffer): Float32Array {
  const { data, width, height } = imageData;
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    const a = data[p + 3] / 255;
    lum[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) * a;
  }

  const grad = new Float32Array(width * height);
  if (width < 3 || height < 3) return grad;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = lum[i - width - 1];
      const tc = lum[i - width];
      const tr = lum[i - width + 1];
      const ml = lum[i - 1];
      const mr = lum[i + 1];
      const bl = lum[i + width - 1];
      const bc = lum[i + width];
      const br = lum[i + width + 1];
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
      grad[i] = Math.hypot(gx, gy);
    }
  }
  return grad;
}

/**
 * Pick the pixel inside `searchRadius` of (x, y) that sits on the strongest edge
 * (maximum gradient magnitude = minimum cost). A mild distance penalty keeps the anchor
 * close to the pointer on flat or equally strong neighbourhoods.
 * Falls back to the (clamped) input point when the neighbourhood has no edge.
 */
export function snapToEdge(
  gradient: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  searchRadius: number
): { x: number; y: number } {
  const cx = Math.min(width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(height - 1, Math.max(0, Math.round(y)));
  const r = Math.max(0, Math.floor(searchRadius));
  if (r === 0 || gradient.length < width * height) return { x: cx, y: cy };

  let bestX = cx;
  let bestY = cy;
  let bestScore = -1;
  let bestRaw = 0;

  const x0 = Math.max(0, cx - r);
  const x1 = Math.min(width - 1, cx + r);
  const y0 = Math.max(0, cy - r);
  const y1 = Math.min(height - 1, cy + r);

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const g = gradient[py * width + px];
      const score = g * (1 - 0.15 * (d / r));
      if (score > bestScore) {
        bestScore = score;
        bestRaw = g;
        bestX = px;
        bestY = py;
      }
    }
  }

  // No edge in range: keep the pointer where it is
  if (bestRaw < 1e-3) return { x: cx, y: cy };
  return { x: bestX, y: bestY };
}
