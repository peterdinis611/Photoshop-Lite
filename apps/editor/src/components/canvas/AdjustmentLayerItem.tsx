import React from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import type { AdjustmentLayer } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';

const KIND_LABEL: Record<AdjustmentLayer['kind'], string> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  levels: 'Levels',
  curves: 'Curves',
  hueSaturation: 'Hue/Saturation',
  invert: 'Invert',
  grayscale: 'Black & White',
  gradientMap: 'Gradient Map',
  photoFilter: 'Photo Filter',
};

interface AdjustmentLayerItemProps {
  layer: AdjustmentLayer;
  /** Position among visible adjustment layers (stacks the badges downward) */
  slot: number;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Adjustment layers have no pixels of their own. Their effect is folded into the filters of
 * the image layers below (see adjustmentComposite.ts); on the canvas they show up as a small
 * labelled badge so they stay visible and selectable. Edit values in the Tone / Adjustments panel.
 */
export const AdjustmentLayerItem: React.FC<AdjustmentLayerItemProps> = ({
  layer,
  slot,
  zoom,
  isSelected,
  onSelect,
}) => {
  const activeTool = useEditorStore((s) => s.activeTool);
  if (!layer.visible) return null;

  const label = KIND_LABEL[layer.kind] ?? layer.kind;
  const width = 30 + label.length * 7;
  const height = 22;
  const clickable = activeTool === 'select';

  return (
    <Group
      name="adjustment-badge"
      x={layer.x + 12 / zoom}
      y={layer.y + (12 + slot * (height + 6)) / zoom}
      scaleX={1 / zoom}
      scaleY={1 / zoom}
      opacity={0.88}
      listening={clickable}
      onClick={clickable ? onSelect : undefined}
      onTap={clickable ? onSelect : undefined}
    >
      <Rect
        width={width}
        height={height}
        cornerRadius={11}
        fill="rgba(26, 18, 8, 0.82)"
        stroke={isSelected ? '#d4923a' : 'rgba(236, 232, 225, 0.35)'}
        strokeWidth={isSelected ? 1.5 : 1}
      />
      <Circle x={12} y={height / 2} radius={4} fill={isSelected ? '#d4923a' : '#ece8e1'} />
      <Text
        x={22}
        y={0}
        height={height}
        verticalAlign="middle"
        text={label}
        fontSize={11}
        fontStyle="bold"
        fill="#ece8e1"
        listening={false}
      />
    </Group>
  );
};
