import { Circle, Line } from 'react-konva';
import { dist } from '../../../utils/pathHelpers';
import type { ToolHandler } from './types';

/** Gradient — drag from start to end point (Shift snaps to 45°, Alt-release bakes a raster fill). */
export const gradientTool: ToolHandler = {
  id: 'gradient',

  onPointerDown: ({ point }, { session }) => {
    session.gradientDrag = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
  },

  onPointerMove: ({ point, shiftKey }, { session }) => {
    const drag = session.gradientDrag;
    if (!drag) return;
    let { x: x2, y: y2 } = point;
    const { x1, y1 } = drag;
    if (shiftKey) {
      // Constrain to 45° steps
      const len = dist(x1, y1, x2, y2);
      const angle = Math.round(Math.atan2(y2 - y1, x2 - x1) / (Math.PI / 4)) * (Math.PI / 4);
      x2 = Math.round(x1 + Math.cos(angle) * len);
      y2 = Math.round(y1 + Math.sin(angle) * len);
    }
    session.gradientDrag = { x1, y1, x2, y2 };
  },

  onPointerUp: ({ altKey }, ctx) => {
    const drag = ctx.session.gradientDrag;
    if (!drag) return;
    const { x1, y1, x2, y2 } = drag;
    ctx.session.gradientDrag = null;
    if (dist(x1, y1, x2, y2) >= 2) {
      const { placeGradientFill, addGradientLayerFromDrag } = ctx.getStore();
      // Default: editable gradient layer. Alt-release bakes a raster fill layer instead.
      if (altKey) placeGradientFill(x1, y1, x2, y2);
      else addGradientLayerFromDrag(x1, y1, x2, y2);
    }
  },

  onDeactivate: ({ session }) => {
    session.gradientDrag = null;
  },

  renderOverlay: (ctx) => {
    const drag = ctx.session.gradientDrag;
    if (!drag) return null;
    const { zoom } = ctx.getView();
    const { gradientSettings } = ctx.getStore();
    const stops = gradientSettings.colorStops;
    return (
      <>
        {gradientSettings.gradientType === 'radial' && (
          <Circle
            x={drag.x1}
            y={drag.y1}
            radius={dist(drag.x1, drag.y1, drag.x2, drag.y2)}
            stroke="rgba(236, 232, 225, 0.6)"
            strokeWidth={1 / zoom}
            dash={[6 / zoom, 4 / zoom]}
            listening={false}
          />
        )}
        <Line
          points={[drag.x1, drag.y1, drag.x2, drag.y2]}
          stroke="#1a1208"
          strokeWidth={3.5 / zoom}
          lineCap="round"
          listening={false}
        />
        <Line
          points={[drag.x1, drag.y1, drag.x2, drag.y2]}
          stroke="#ece8e1"
          strokeWidth={1.5 / zoom}
          lineCap="round"
          listening={false}
        />
        <Circle
          x={drag.x1}
          y={drag.y1}
          radius={5 / zoom}
          fill={stops[0]?.color ?? '#000000'}
          stroke="#ece8e1"
          strokeWidth={1.5 / zoom}
          listening={false}
        />
        <Circle
          x={drag.x2}
          y={drag.y2}
          radius={5 / zoom}
          fill={stops[stops.length - 1]?.color ?? '#ffffff'}
          stroke="#ece8e1"
          strokeWidth={1.5 / zoom}
          listening={false}
        />
      </>
    );
  },
};
