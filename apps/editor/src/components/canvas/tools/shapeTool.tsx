import { ShapePreview } from './ShapePreview';
import type { ToolHandler } from './types';

/** Drag to size a shape; a plain click drops a default-sized one centred on the pointer. */
export const shapeTool: ToolHandler = {
  id: 'shape',

  onPointerDown: ({ point }, { session }) => {
    session.shapeStart = { x: point.x, y: point.y };
    session.shapePreview = { x: point.x, y: point.y, width: 0, height: 0, x2: point.x, y2: point.y };
  },

  onPointerMove: ({ point }, { session }) => {
    const start = session.shapeStart;
    if (!start) return;
    session.shapePreview = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
      x2: point.x,
      y2: point.y,
    };
  },

  onPointerUp: (_e, ctx) => {
    const { session } = ctx;
    const start = session.shapeStart;
    const box = session.shapePreview;
    if (!start || !box) return;
    session.shapeStart = null;
    session.shapePreview = null;

    const { activeShapeType, addShapeLayer, updateLayer } = ctx.getStore();
    const { x, y, width, height, x2, y2 } = box;
    const isClick = width <= 5 && height <= 5;
    const isLineLike = activeShapeType === 'line' || activeShapeType === 'arrow';

    if (isClick && !isLineLike) {
      // Click to drop a default-sized shape centered on the pointer
      addShapeLayer(activeShapeType);
      setTimeout(() => {
        const currentSelected = ctx.getStore().selectedLayerId;
        if (!currentSelected) return;
        const size = 180;
        updateLayer(currentSelected, {
          x: Math.round(start.x - size / 2),
          y: Math.round(start.y - size / 2),
          width: size,
          height: size,
        });
      }, 10);
    } else if (width > 5 || height > 5 || (x2 !== undefined && y2 !== undefined)) {
      addShapeLayer(activeShapeType);
      setTimeout(() => {
        const currentSelected = ctx.getStore().selectedLayerId;
        if (!currentSelected) return;
        if (isLineLike && x2 !== undefined && y2 !== undefined) {
          const minX = Math.min(start.x, x2);
          const minY = Math.min(start.y, y2);
          updateLayer(currentSelected, {
            x: minX,
            y: minY,
            width: Math.max(8, Math.abs(x2 - start.x)),
            height: Math.max(8, Math.abs(y2 - start.y)),
            points: [start.x - minX, start.y - minY, x2 - minX, y2 - minY],
          });
        } else {
          updateLayer(currentSelected, {
            x,
            y,
            width: Math.max(8, width),
            height: Math.max(8, height),
          });
        }
      }, 10);
    }
  },

  renderOverlay: (ctx) => {
    const { shapePreview, shapeStart } = ctx.session;
    if (!shapePreview) return null;
    return (
      <ShapePreview
        type={ctx.getStore().activeShapeType}
        box={shapePreview}
        start={shapeStart}
        zoom={ctx.getView().zoom}
      />
    );
  },
};
