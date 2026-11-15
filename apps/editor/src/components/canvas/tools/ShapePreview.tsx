import React from 'react';
import { Arc, Arrow, Circle, Ellipse, Line, Rect, Ring, RegularPolygon, Star, Wedge } from 'react-konva';
import type { ShapeType } from '../../../types/editor';

/** Live drag preview for shape tool — uses matching Konva primitives */
export const ShapePreview: React.FC<{
  type: ShapeType;
  box: { x: number; y: number; width: number; height: number; x2?: number; y2?: number };
  start: { x: number; y: number } | null;
  zoom: number;
}> = ({ type, box, start, zoom }) => {
  const stroke = '#d4923a';
  const fill = 'rgba(212, 146, 58, 0.22)';
  const sw = 1.5 / zoom;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.min(box.width, box.height) / 2;

  if ((type === 'line' || type === 'arrow') && start && box.x2 !== undefined && box.y2 !== undefined) {
    const pts = [start.x, start.y, box.x2, box.y2];
    if (type === 'arrow') {
      return (
        <Arrow
          points={pts}
          stroke={stroke}
          fill={stroke}
          strokeWidth={sw}
          pointerLength={14 / zoom}
          pointerWidth={14 / zoom}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    }
    return (
      <Line
        points={pts}
        stroke={stroke}
        strokeWidth={sw}
        dash={[6 / zoom, 3 / zoom]}
        listening={false}
      />
    );
  }

  switch (type) {
    case 'ellipse':
      return (
        <Ellipse
          x={cx}
          y={cy}
          radiusX={box.width / 2}
          radiusY={box.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'circle':
      return (
        <Circle
          x={cx}
          y={cy}
          radius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'star':
      return (
        <Star
          x={cx}
          y={cy}
          numPoints={5}
          innerRadius={r * 0.45}
          outerRadius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'polygon':
      return (
        <RegularPolygon
          x={cx}
          y={cy}
          sides={6}
          radius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'arc':
      return (
        <Arc
          x={cx}
          y={cy}
          innerRadius={r * 0.5}
          outerRadius={r}
          angle={270}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'ring':
      return (
        <Ring
          x={cx}
          y={cy}
          innerRadius={r * 0.45}
          outerRadius={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    case 'wedge':
      return (
        <Wedge
          x={cx}
          y={cy}
          radius={r}
          angle={60}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          listening={false}
        />
      );
    default:
      return (
        <Rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          dash={[6 / zoom, 3 / zoom]}
          cornerRadius={type === 'callout' ? 8 : 0}
          listening={false}
        />
      );
  }
};
