import React, { useCallback } from 'react';
import { Shape } from 'react-konva';
import type Konva from 'konva';

interface CanvasGridProps {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  spacing?: number;
}

/**
 * Single Shape sceneFunc instead of O(n) Konva.Line nodes — much cheaper
 * when the artboard is large and the grid is toggled on.
 */
export const CanvasGrid: React.FC<CanvasGridProps> = React.memo(
  ({ canvasWidth, canvasHeight, zoom, spacing = 50 }) => {
    const sceneFunc = useCallback(
      (context: Konva.Context) => {
        const stroke = Math.max(0.35 / zoom, 0.25);
        const dash = [4 / zoom, 4 / zoom];
        context.beginPath();
        for (let x = 0; x <= canvasWidth; x += spacing) {
          context.moveTo(x, 0);
          context.lineTo(x, canvasHeight);
        }
        for (let y = 0; y <= canvasHeight; y += spacing) {
          context.moveTo(0, y);
          context.lineTo(canvasWidth, y);
        }
        context.setAttr('strokeStyle', '#374151');
        context.setAttr('lineWidth', stroke);
        // Konva Context proxies CanvasRenderingContext2D for dash
        (context as unknown as CanvasRenderingContext2D).setLineDash(dash);
        context.stroke();
      },
      [canvasWidth, canvasHeight, zoom, spacing]
    );

    return (
      <Shape listening={false} perfectDrawEnabled={false} sceneFunc={sceneFunc} />
    );
  }
);

CanvasGrid.displayName = 'CanvasGrid';
