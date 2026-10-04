/**
 * Advanced Photo Retouching Utilities:
 * 1. Eyedropper Tool: Pixel color sampler
 * 2. Spot Healing Brush: Content-aware annulus texture blending & blemish removal
 * 3. Clone Stamp Tool: Source-to-destination texture transfer with soft feathering
 */

/**
 * Samples the exact color (hex) at a specific coordinate from a canvas element.
 */
export function sampleCanvasColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';

  const clX = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
  const clY = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
  const pixel = ctx.getImageData(clX, clY, 1, 1).data;

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
}

/**
 * Spot Healing: Takes an image source, performs local patch synthesis & Poisson-like texture
 * interpolation from surrounding boundary pixels to remove blemishes, spots, and scratches.
 */
export async function applySpotHealingToImage(
  imageSrc: string,
  layerX: number,
  layerY: number,
  spotX: number,
  spotY: number,
  radius: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSrc);

        ctx.drawImage(img, 0, 0);

        // Coordinates local to the image
        const localX = Math.round(spotX - layerX);
        const localY = Math.round(spotY - layerY);

        if (localX < 0 || localX >= w || localY < 0 || localY >= h) {
          return resolve(imageSrc);
        }

        const r = Math.max(4, Math.round(radius));
        const minX = Math.max(0, localX - r);
        const maxX = Math.min(w - 1, localX + r);
        const minY = Math.max(0, localY - r);
        const maxY = Math.min(h - 1, localY + r);

        const patchW = maxX - minX + 1;
        const patchH = maxY - minY + 1;

        const imgData = ctx.getImageData(minX, minY, patchW, patchH);
        const data = imgData.data;

        // 1. Collect surrounding ring/annulus samples
        const ringSamples: { r: number; g: number; b: number; a: number; angle: number }[] = [];
        const rOuter = r;
        const rInner = Math.max(2, r * 0.7);

        for (let py = 0; py < patchH; py++) {
          for (let px = 0; px < patchW; px++) {
            const dx = px - (localX - minX);
            const dy = py - (localY - minY);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= rInner && dist <= rOuter) {
              const idx = (py * patchW + px) * 4;
              const angle = Math.atan2(dy, dx);
              ringSamples.push({
                r: data[idx],
                g: data[idx + 1],
                b: data[idx + 2],
                a: data[idx + 3],
                angle,
              });
            }
          }
        }

        if (ringSamples.length === 0) return resolve(imageSrc);

        // Calculate average background color
        let avgR = 0, avgG = 0, avgB = 0;
        for (const s of ringSamples) {
          avgR += s.r;
          avgG += s.g;
          avgB += s.b;
        }
        avgR /= ringSamples.length;
        avgG /= ringSamples.length;
        avgB /= ringSamples.length;

        // 2. In-paint inside the circular patch with soft radial weighting
        for (let py = 0; py < patchH; py++) {
          for (let px = 0; px < patchW; px++) {
            const dx = px - (localX - minX);
            const dy = py - (localY - minY);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= r) {
              const idx = (py * patchW + px) * 4;
              const angle = Math.atan2(dy, dx);

              // Find closest angular boundary samples
              let nearestSample = ringSamples[0];
              let minAngleDiff = 999;
              for (const s of ringSamples) {
                let diff = Math.abs(s.angle - angle);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if (diff < minAngleDiff) {
                  minAngleDiff = diff;
                  nearestSample = s;
                }
              }

              // Blend nearest angular boundary pixel with average to preserve texture
              const weight = 1 - Math.pow(dist / r, 1.5); // center has highest weight
              const targetR = nearestSample.r * 0.7 + avgR * 0.3;
              const targetG = nearestSample.g * 0.7 + avgG * 0.3;
              const targetB = nearestSample.b * 0.7 + avgB * 0.3;

              data[idx] = Math.round(data[idx] * (1 - weight) + targetR * weight);
              data[idx + 1] = Math.round(data[idx + 1] * (1 - weight) + targetG * weight);
              data[idx + 2] = Math.round(data[idx + 2] * (1 - weight) + targetB * weight);
            }
          }
        }

        ctx.putImageData(imgData, minX, minY);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('Spot healing error:', e);
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

/**
 * Clone Stamp: Stamps pixels from clone source (srcX, srcY) into (destX, destY) with feathered edge.
 */
export async function applyCloneStampToImage(
  imageSrc: string,
  layerX: number,
  layerY: number,
  srcX: number,
  srcY: number,
  destX: number,
  destY: number,
  radius: number,
  opacity: number = 1
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSrc);

        ctx.drawImage(img, 0, 0);

        const localSrcX = Math.round(srcX - layerX);
        const localSrcY = Math.round(srcY - layerY);
        const localDestX = Math.round(destX - layerX);
        const localDestY = Math.round(destY - layerY);

        const r = Math.max(4, Math.round(radius));

        // Create temporary pattern from source
        const patchCanvas = document.createElement('canvas');
        patchCanvas.width = r * 2;
        patchCanvas.height = r * 2;
        const pCtx = patchCanvas.getContext('2d');
        if (!pCtx) return resolve(imageSrc);

        // Draw source circle with radial gradient feather
        pCtx.save();
        pCtx.beginPath();
        pCtx.arc(r, r, r, 0, Math.PI * 2);
        pCtx.clip();

        pCtx.drawImage(
          canvas,
          localSrcX - r,
          localSrcY - r,
          r * 2,
          r * 2,
          0,
          0,
          r * 2,
          r * 2
        );
        pCtx.restore();

        // Apply feathering via radial gradient alpha mask
        const grad = pCtx.createRadialGradient(r, r, r * 0.4, r, r, r);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        pCtx.globalCompositeOperation = 'destination-in';
        pCtx.fillStyle = grad;
        pCtx.fillRect(0, 0, r * 2, r * 2);

        // Stamp onto destination
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(patchCanvas, localDestX - r, localDestY - r);
        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('Clone stamp error:', e);
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}
