import React, { useRef } from 'react';
import { Group, Path as KonvaPath, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { PathLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';
import { anchorsToSvgPath } from '../../utils/pathHelpers';

interface PathLayerItemProps {
  layer: PathLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<PathLayer>) => void;
}

export const PathLayerItem: React.FC<PathLayerItemProps> = ({
  layer,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const canMove = activeTool === 'select' && !layer.locked;
  const data = anchorsToSvgPath(layer.anchors, layer.closed);

  if (!layer.visible || !data) return null;

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
      <KonvaPath
        data={data}
        fill={layer.fill === 'transparent' ? undefined : layer.fill}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
        lineCap="round"
        lineJoin="round"
        shadowColor={layer.styles?.shadowColor}
        shadowBlur={layer.styles?.shadowBlur}
        shadowOffsetX={layer.styles?.shadowOffsetX}
        shadowOffsetY={layer.styles?.shadowOffsetY}
        shadowOpacity={layer.styles?.shadowOpacity}
      />

      {isSelected &&
        canMove &&
        layer.anchors.map((a, i) => (
          <React.Fragment key={i}>
            {(a.handleOutX || a.handleOutY) && (
              <Line
                points={[a.x, a.y, a.x + (a.handleOutX ?? 0), a.y + (a.handleOutY ?? 0)]}
                stroke="#5b8def"
                strokeWidth={1}
                listening={false}
              />
            )}
            {(a.handleInX || a.handleInY) && (
              <Line
                points={[a.x, a.y, a.x + (a.handleInX ?? 0), a.y + (a.handleInY ?? 0)]}
                stroke="#5b8def"
                strokeWidth={1}
                listening={false}
              />
            )}
            <Circle
              x={a.x}
              y={a.y}
              radius={4}
              fill="#ece8e1"
              stroke="#d4923a"
              strokeWidth={1.5}
              listening={false}
            />
          </React.Fragment>
        ))}
    </Group>
  );
};
