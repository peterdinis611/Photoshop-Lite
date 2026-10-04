import React, { useRef } from 'react';
import {
  Rect as KonvaRect,
  Circle as KonvaCircle,
  Ellipse as KonvaEllipse,
  Line as KonvaLine,
  Arrow as KonvaArrow,
  Star as KonvaStar,
  RegularPolygon as KonvaPolygon,
  Arc as KonvaArc,
  Ring as KonvaRing,
  Wedge as KonvaWedge,
  Label as KonvaLabel,
  Tag as KonvaTag,
  Text as KonvaText,
  Group,
} from 'react-konva';
import Konva from 'konva';
import { ShapeLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

interface ShapeLayerItemProps {
  layer: ShapeLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<ShapeLayer>) => void;
}

export const ShapeLayerItem: React.FC<ShapeLayerItemProps> = ({
  layer,
  onSelect,
  onChange,
}) => {
  const shapeRef = useRef<Konva.Group>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canMove = activeTool === 'select' && !layer.locked;

  if (!layer.visible) return null;

  const styles = layer.styles || {};
  const useGlow = (styles.outerGlowBlur || 0) > 0;
  const shadowProps = useGlow
    ? {
        shadowColor: styles.outerGlowColor || '#e8a84a',
        shadowBlur: styles.outerGlowBlur || 0,
        shadowOffset: { x: 0, y: 0 },
        shadowOpacity: 0.85,
      }
    : {
        shadowColor: styles.shadowColor,
        shadowBlur: styles.shadowBlur || 0,
        shadowOffset: {
          x: styles.shadowOffsetX || 0,
          y: styles.shadowOffsetY || 0,
        },
        shadowOpacity: styles.shadowOpacity || 0,
      };

  const commonProps = {
    fill: layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    ...shadowProps,
  };

  const outerR = Math.min(layer.width, layer.height) / 2;
  const cx = layer.width / 2;
  const cy = layer.height / 2;

  const renderShape = () => {
    switch (layer.shapeType) {
      case 'rectangle':
        return (
          <KonvaRect
            width={layer.width}
            height={layer.height}
            cornerRadius={layer.cornerRadius || 0}
            {...commonProps}
          />
        );
      case 'circle':
        return <KonvaCircle x={cx} y={cy} radius={outerR} {...commonProps} />;
      case 'ellipse':
        return (
          <KonvaEllipse
            x={cx}
            y={cy}
            radiusX={Math.abs(layer.width) / 2}
            radiusY={Math.abs(layer.height) / 2}
            {...commonProps}
          />
        );
      case 'arrow':
        return (
          <KonvaArrow
            points={layer.points || [0, layer.height / 2, layer.width, layer.height / 2]}
            pointerLength={18}
            pointerWidth={18}
            {...commonProps}
          />
        );
      case 'line':
        return (
          <KonvaLine
            points={layer.points || [0, 0, layer.width, layer.height]}
            {...commonProps}
          />
        );
      case 'star': {
        const innerFrac = layer.innerRadius ?? layer.starInnerRadius ?? 0.45;
        return (
          <KonvaStar
            x={cx}
            y={cy}
            numPoints={layer.sides || 5}
            innerRadius={outerR * Math.min(0.95, Math.max(0.1, innerFrac))}
            outerRadius={outerR}
            {...commonProps}
          />
        );
      }
      case 'polygon':
        return (
          <KonvaPolygon
            x={cx}
            y={cy}
            sides={layer.sides || 6}
            radius={outerR}
            {...commonProps}
          />
        );
      case 'arc':
        return (
          <KonvaArc
            x={cx}
            y={cy}
            innerRadius={outerR * (layer.innerRadius ?? 0.55)}
            outerRadius={outerR}
            angle={layer.angle ?? 270}
            {...commonProps}
          />
        );
      case 'ring':
        return (
          <KonvaRing
            x={cx}
            y={cy}
            innerRadius={outerR * (layer.innerRadius ?? 0.45)}
            outerRadius={outerR}
            {...commonProps}
          />
        );
      case 'wedge':
        return (
          <KonvaWedge
            x={cx}
            y={cy}
            radius={outerR}
            angle={layer.angle ?? 60}
            {...commonProps}
          />
        );
      case 'callout':
        return (
          <KonvaLabel x={0} y={0} {...shadowProps}>
            <KonvaTag
              fill={layer.fill}
              stroke={layer.stroke}
              strokeWidth={layer.strokeWidth}
              pointerDirection="down"
              pointerWidth={Math.min(28, layer.width * 0.25)}
              pointerHeight={Math.min(22, layer.height * 0.35)}
              cornerRadius={layer.cornerRadius ?? 8}
            />
            <KonvaText
              text="Callout"
              fontFamily="Source Sans 3"
              fontSize={Math.max(12, Math.min(22, layer.height * 0.35))}
              padding={10}
              fill={layer.stroke || '#ece8e1'}
              width={layer.width}
              align="center"
            />
          </KonvaLabel>
        );
      default:
        return <KonvaRect width={layer.width} height={layer.height} {...commonProps} />;
    }
  };

  return (
    <Group
      ref={shapeRef}
      id={layer.id}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      rotation={layer.rotation}
      opacity={layer.opacity}
      draggable={canMove}
      listening={canMove}
      globalCompositeOperation={layer.blendMode}
      onClick={canMove ? onSelect : undefined}
      onTap={canMove ? onSelect : undefined}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation: Math.round(node.rotation()),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        });
      }}
    >
      {renderShape()}
    </Group>
  );
};
