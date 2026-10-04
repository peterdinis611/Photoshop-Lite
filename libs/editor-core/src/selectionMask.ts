/**
 * Rasterize a document-space selection (rect / ellipse / lasso path) into a
 * white-on-black mask PNG data URL for inpainting APIs.
 */
export async function selectionToMaskDataUrl(params: {
  canvasWidth: number;
  canvasHeight: number;
  selection: {
    x: number;
    y: number;
    width: number;
    height: number;
    mode?: 'rect' | 'ellipse';
    path?: number[];
  };
}): Promise<string> {
  const { canvasWidth, canvasHeight, selection } = params;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, canvasWidth);
  canvas.height = Math.max(1, canvasHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create mask canvas');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();

  if (selection.path && selection.path.length >= 6) {
    const [fx, fy, ...rest] = selection.path;
    ctx.moveTo(fx, fy);
    for (let i = 0; i < rest.length; i += 2) {
      ctx.lineTo(rest[i], rest[i + 1]);
    }
    ctx.closePath();
  } else if (selection.mode === 'ellipse') {
    ctx.ellipse(
      selection.x + selection.width / 2,
      selection.y + selection.height / 2,
      Math.abs(selection.width) / 2,
      Math.abs(selection.height) / 2,
      0,
      0,
      Math.PI * 2
    );
  } else {
    ctx.rect(selection.x, selection.y, selection.width, selection.height);
  }

  ctx.fill();
  return canvas.toDataURL('image/png');
}
