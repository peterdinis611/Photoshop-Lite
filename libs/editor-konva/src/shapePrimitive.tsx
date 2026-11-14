import React from 'react';
import {
  Rect,
  Circle,
  Ellipse,
  Line,
  Arrow,
  Star,
  RegularPolygon,
  Arc,
  Ring,
  Wedge,
} from 'react-konva';
import type { ShapeType } from '@photoshop-lite/shared-types';

export interface ShapePrimitiveProps {
  shapeType: ShapeType;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  sides?: number;
  starInnerRadius?: number;
  points?: number[];
  angle?: number;
  innerRadius?: number;
  listening?: boolean;
}

/** Single renderer for shape preview + committed shape layers. */
export function ShapePrimitive(props: ShapePrimitiveProps): React.ReactElement | null {
  const {
    shapeType,
    width,
    height,
    fill = '#d4923a',
    stroke = '#ece8e1',
    strokeWidth = 2,
    cornerRadius = 0,
    sides = 5,
    starInnerRadius,
    points,
    angle = 270,
    innerRadius,
    listening = true,
  } = props;

  const common = { fill, stroke, strokeWidth, listening };

  switch (shapeType) {
    case 'rectangle':
      return <Rect width={width} height={height} cornerRadius={cornerRadius} {...common} />;
    case 'circle':
      return <Circle radius={Math.min(width, height) / 2} x={width / 2} y={height / 2} {...common} />;
    case 'ellipse':
      return (
        <Ellipse radiusX={width / 2} radiusY={height / 2} x={width / 2} y={height / 2} {...common} />
      );
    case 'line':
      return (
        <Line
          points={points?.length ? points : [0, height / 2, width, height / 2]}
          {...common}
          fill={undefined}
        />
      );
    case 'arrow':
      return (
        <Arrow
          points={points?.length ? points : [0, height / 2, width, height / 2]}
          pointerLength={12}
          pointerWidth={12}
          {...common}
        />
      );
    case 'star':
      return (
        <Star
          numPoints={sides || 5}
          innerRadius={starInnerRadius ?? Math.min(width, height) * 0.25}
          outerRadius={Math.min(width, height) / 2}
          x={width / 2}
          y={height / 2}
          {...common}
        />
      );
    case 'polygon':
      return (
        <RegularPolygon
          sides={sides || 6}
          radius={Math.min(width, height) / 2}
          x={width / 2}
          y={height / 2}
          {...common}
        />
      );
    case 'arc':
      return (
        <Arc
          innerRadius={0}
          outerRadius={Math.min(width, height) / 2}
          angle={angle}
          x={width / 2}
          y={height / 2}
          {...common}
        />
      );
    case 'ring':
      return (
        <Ring
          innerRadius={(Math.min(width, height) / 2) * (innerRadius ?? 0.5)}
          outerRadius={Math.min(width, height) / 2}
          x={width / 2}
          y={height / 2}
          {...common}
        />
      );
    case 'wedge':
      return (
        <Wedge
          radius={Math.min(width, height) / 2}
          angle={angle || 60}
          x={width / 2}
          y={height / 2}
          {...common}
        />
      );
    case 'callout':
      // Callouts use Label/Tag in ShapeLayerItem — preview falls back to rounded rect
      return <Rect width={width} height={height} cornerRadius={6} {...common} />;
    default:
      return <Rect width={width} height={height} {...common} />;
  }
}
