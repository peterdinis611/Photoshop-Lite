import React, { useRef } from 'react';
import { Rect } from 'react-konva';
import Konva from 'konva';
import type { GradientLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

interface GradientLayerItemProps {
  layer: GradientLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<GradientLayer>) => void;
}

/** Editable gradient fill — drawn natively with Konva gradient fills (no baked bitmap). */
export const GradientLayerItem: React.FC<GradientLayerItemProps> = ({
  layer,
  onSelect,
  onChange,
}) => {
  const rectRef = useRef<Konva.Rect>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canMove = activeTool === 'select' && !layer.locked;

  if (!layer.visible) return null;

  const stops = [...layer.colorStops]
    .sort((a, b) => a.offset - b.offset)
    .flatMap((s) => [Math.min(1, Math.max(0, s.offset)), s.color]);

  const gradientProps =
    layer.gradientType === 'radial'
      ? {
          fillPriority: 'radial-gradient' as const,
          fillRadialGradientStartPoint: layer.start,
          fillRadialGradientEndPoint: layer.start,
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndRadius: Math.max(
            1,
            Math.hypot(layer.end.x - layer.start.x, layer.end.y - layer.start.y)
          ),
          fillRadialGradientColorStops: stops,
        }
      : {
          fillPriority: 'linear-gradient' as const,
          fillLinearGradientStartPoint: layer.start,
          fillLinearGradientEndPoint: layer.end,
          fillLinearGradientColorStops: stops,
        };

  return (
    <Rect
      ref={rectRef}
      id={layer.id}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      rotation={layer.rotation}
      opacity={layer.opacity}
      globalCompositeOperation={layer.blendMode}
      draggable={canMove}
      listening={canMove}
      onClick={canMove ? onSelect : undefined}
      onTap={canMove ? onSelect : undefined}
      onDragEnd={(e) => onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
      onTransformEnd={() => {
        const node = rectRef.current;
        if (!node) return;
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation: Math.round(node.rotation()),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        });
      }}
      {...gradientProps}
    />
  );
};
