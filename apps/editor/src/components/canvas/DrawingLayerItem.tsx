import React, { useRef } from 'react';
import { Group, Line as KonvaLine } from 'react-konva';
import Konva from 'konva';
import { DrawingLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

interface DrawingLayerItemProps {
  layer: DrawingLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<DrawingLayer>) => void;
}

export const DrawingLayerItem: React.FC<DrawingLayerItemProps> = ({
  layer,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canMove = activeTool === 'select' && !layer.locked;

  if (!layer.visible) return null;

  return (
    <Group
      ref={groupRef}
      id={layer.id}
      x={layer.x}
      y={layer.y}
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
        const node = groupRef.current;
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
      {layer.strokes.map((stroke, i) => {
        const hardness = stroke.hardness ?? 0.85;
        const soft = 1 - hardness;
        return (
          <KonvaLine
            key={i}
            points={stroke.points}
            stroke={stroke.color}
            strokeWidth={stroke.size}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            opacity={stroke.opacity}
            shadowColor={stroke.isEraser ? undefined : stroke.color}
            shadowBlur={stroke.isEraser ? 0 : soft * stroke.size * 0.55}
            shadowOpacity={stroke.isEraser ? 0 : soft * 0.65}
            globalCompositeOperation={
              stroke.isEraser ? 'destination-out' : 'source-over'
            }
          />
        );
      })}
    </Group>
  );
};
