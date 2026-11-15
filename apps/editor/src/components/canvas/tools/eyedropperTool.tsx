import { sampleCanvasColor } from '../../../utils/retouchHelpers';
import type { ToolContext, ToolHandler } from './types';

/** Flatten visible image layers into an off-screen canvas and sample one pixel from it. */
async function sampleAt(ctx: ToolContext, canvasX: number, canvasY: number) {
  const { layers, canvasWidth, canvasHeight, updateBrushSettings } = ctx.getStore();
  const offscreen = document.createElement('canvas');
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;
  const g = offscreen.getContext('2d');
  if (!g) return;

  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.type === 'image') {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          g.save();
          g.globalAlpha = layer.opacity;
          g.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
          g.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
          g.rotate((layer.rotation * Math.PI) / 180);
          g.scale(layer.scaleX, layer.scaleY);
          g.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
          g.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = layer.src;
      });
    }
  }

  const sampledColor = sampleCanvasColor(offscreen, canvasX, canvasY);
  updateBrushSettings({ color: sampledColor });
  ctx.session.eyedropperPreview = null;
  return sampledColor;
}

export const eyedropperTool: ToolHandler = {
  id: 'eyedropper',

  onPointerDown: async ({ point }, ctx) => {
    await sampleAt(ctx, point.x, point.y);
  },

  onPointerMove: ({ point }, ctx) => {
    // Hover only shows position; actual sampling happens on click
    ctx.session.eyedropperPreview = `${point.x}, ${point.y}`;
  },

  renderHud: (ctx) => {
    const preview = ctx.session.eyedropperPreview;
    const { brushSettings } = ctx.getStore();
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1e2025]/95 backdrop-blur-md border border-[#2c2f38] px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 z-40 text-xs text-zinc-300">
        <div
          className="w-3 h-3 rounded-full border border-zinc-600"
          style={{ backgroundColor: preview?.startsWith('#') ? preview : brushSettings.color }}
        />
        Click anywhere to sample color → sets as brush/primary color
      </div>
    );
  },
};
