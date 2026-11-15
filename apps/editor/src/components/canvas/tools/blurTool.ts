import { applyBlurSpotToImage } from '../../../utils/retouchHelpers';
import { runThrottled } from './async';
import { renderCursorRing } from './cursorRing';
import type { Point, ToolContext, ToolHandler } from './types';

/** Reads fresh state itself so the throttler can capture it once. */
function makeBlurSpot(ctx: ToolContext) {
  return async (coords: Point) => {
    const imageLayer = ctx.getSelectedImageLayer();
    if (!imageLayer) return;
    const { brushSettings: brush, updateLayer } = ctx.getStore();
    const newSrc = await applyBlurSpotToImage(
      imageLayer.src,
      imageLayer.x,
      imageLayer.y,
      coords.x,
      coords.y,
      brush.size / 2,
      brush.opacity
    );
    updateLayer(imageLayer.id, { src: newSrc });
  };
}

const stamp = (ctx: ToolContext, coords: Point) =>
  runThrottled(ctx.session, 'blur', 50, makeBlurSpot(ctx), coords);

export const blurTool: ToolHandler = {
  id: 'blur',

  onPointerDown: ({ point }, ctx) => {
    ctx.session.blurring = true;
    stamp(ctx, point);
  },

  onPointerMove: ({ point }, ctx) => {
    if (ctx.session.blurring) stamp(ctx, point);
  },

  onPointerUp: (_e, ctx) => {
    ctx.session.blurring = false;
  },

  renderOverlay: renderCursorRing,
};
