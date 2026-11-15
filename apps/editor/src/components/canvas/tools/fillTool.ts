import { floodFillImage } from '../../../utils/retouchHelpers';
import { renderCursorRing } from './cursorRing';
import type { ToolHandler } from './types';

/** Paint bucket flood fill. */
export const fillTool: ToolHandler = {
  id: 'fill',

  onPointerDown: async ({ point }, ctx) => {
    const imageLayer = ctx.getSelectedImageLayer();
    if (!imageLayer) return;
    const { brushSettings, wandTolerance, updateLayer } = ctx.getStore();
    const filled = await floodFillImage({
      src: imageLayer.src,
      layerX: imageLayer.x,
      layerY: imageLayer.y,
      clickX: point.x,
      clickY: point.y,
      fillColor: brushSettings.color,
      tolerance: wandTolerance,
    });
    if (filled) updateLayer(imageLayer.id, { src: filled });
  },

  renderOverlay: renderCursorRing,
};
