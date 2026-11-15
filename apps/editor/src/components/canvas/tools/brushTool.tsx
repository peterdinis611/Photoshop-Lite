import { Line } from 'react-konva';
import { paintStrokeOnMask, eraseStrokeOnImage } from '../../../utils/maskHelpers';
import { renderCursorRing } from './cursorRing';
import type { ToolHandler } from './types';

/** Brush, Eraser and Refine Brush share one stroke pipeline. */
export const brushTool: ToolHandler = {
  id: ['brush', 'eraser', 'refineBrush'],

  onPointerDown: ({ point }, ctx) => {
    const { session, tool } = ctx;
    const { brushSettings } = ctx.getStore();
    const isEraser =
      tool === 'eraser' || (tool === 'refineBrush' && brushSettings.refineMode === 'erase');
    session.brushStroke = {
      points: [point.x, point.y],
      color: isEraser ? 'rgba(0,0,0,1)' : brushSettings.color,
      size: brushSettings.size,
      opacity: brushSettings.opacity,
      isEraser,
      hardness: brushSettings.hardness,
    };
    session.brushPreview = [point.x, point.y];
  },

  onPointerMove: ({ point }, { session }) => {
    if (!session.brushStroke) return;
    const newPoints = [...session.brushStroke.points, point.x, point.y];
    session.brushStroke.points = newPoints;
    session.brushPreview = newPoints;
  },

  onPointerUp: async (_e, ctx) => {
    const { session, tool } = ctx;
    const stroke = session.brushStroke;
    if (!stroke) return;
    session.brushStroke = null;
    session.brushPreview = null;
    ctx.requestRedraw();

    const store = ctx.getStore();
    const imageLayer = ctx.getSelectedImageLayer();

    // Refine brush → paint (or auto-create) layer mask
    if (tool === 'refineBrush' && imageLayer) {
      if (!imageLayer.hasLayerMask || !imageLayer.layerMaskSrc) {
        store.toggleLayerMask(imageLayer.id);
      }
      const masked = ctx.getStore().layers.find((l) => l.id === imageLayer.id);
      const maskSrc =
        masked?.type === 'image' && masked.hasLayerMask ? masked.layerMaskSrc : undefined;
      if (maskSrc) {
        store.commitHistory('Paint Layer Mask');
        const newMask = await paintStrokeOnMask({
          maskSrc,
          layerX: imageLayer.x,
          layerY: imageLayer.y,
          layerWidth: imageLayer.width,
          layerHeight: imageLayer.height,
          points: stroke.points,
          size: stroke.size,
          erase: stroke.isEraser,
        });
        store.paintLayerMask(imageLayer.id, newMask);
        return;
      }
    }

    // Eraser on selected image → punch transparent pixels
    if (tool === 'eraser' && imageLayer) {
      store.commitHistory('Erase');
      const newSrc = await eraseStrokeOnImage({
        src: imageLayer.src,
        layerX: imageLayer.x,
        layerY: imageLayer.y,
        layerWidth: imageLayer.width,
        layerHeight: imageLayer.height,
        points: stroke.points,
        size: stroke.size,
        hardness: stroke.hardness,
      });
      store.updateLayer(imageLayer.id, { src: newSrc });
      return;
    }

    const drawingLayer = ctx.getStore().layers.find((l) => l.type === 'drawing');
    store.addDrawingStroke(drawingLayer?.id || 'new', stroke);
  },

  renderOverlay: (ctx) => {
    const { session, tool } = ctx;
    const { brushSettings } = ctx.getStore();
    return (
      <>
        {session.brushPreview && (
          <Line
            points={session.brushPreview}
            stroke={
              tool === 'eraser' || (tool === 'refineBrush' && brushSettings.refineMode === 'erase')
                ? 'rgba(239, 68, 68, 0.7)'
                : brushSettings.color
            }
            strokeWidth={brushSettings.size}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            opacity={brushSettings.opacity}
            listening={false}
          />
        )}
        {renderCursorRing(ctx)}
      </>
    );
  },
};
