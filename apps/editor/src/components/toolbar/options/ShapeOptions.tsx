import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { ColorOpt, OptChip, OptSep, SizeOpt } from '../../ui/OptionControls';

const SHAPE_TYPES = [
  'rectangle',
  'ellipse',
  'circle',
  'line',
  'arrow',
  'star',
  'polygon',
  'arc',
  'ring',
  'wedge',
  'callout',
] as const;

export const ShapeOptions: React.FC = () => {
  const activeShapeType = useEditorStore((s) => s.activeShapeType);
  const setActiveShapeType = useEditorStore((s) => s.setActiveShapeType);
  const shapeSettings = useEditorStore((s) => s.shapeSettings);
  const updateShapeSettings = useEditorStore((s) => s.updateShapeSettings);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 flex-wrap">
        {SHAPE_TYPES.map((type) => (
          <OptChip
            key={type}
            active={activeShapeType === type}
            onClick={() => setActiveShapeType(type)}
          >
            {type}
          </OptChip>
        ))}
      </div>
      <OptSep />
      <ColorOpt
        label="Fill"
        value={
          selectedLayer?.type === 'shape' ? selectedLayer.fill : shapeSettings.fill
        }
        onChange={(fill) => {
          updateShapeSettings({ fill });
          if (selectedLayer?.type === 'shape') updateLayer(selectedLayer.id, { fill });
        }}
        allowNone
        isNone={
          (selectedLayer?.type === 'shape' ? selectedLayer.fill : shapeSettings.fill) ===
          'transparent'
        }
        onNone={() => {
          updateShapeSettings({ fill: 'transparent' });
          if (selectedLayer?.type === 'shape') {
            updateLayer(selectedLayer.id, { fill: 'transparent' });
          }
        }}
      />
      <ColorOpt
        label="Stroke"
        value={
          selectedLayer?.type === 'shape' ? selectedLayer.stroke : shapeSettings.stroke
        }
        onChange={(stroke) => {
          updateShapeSettings({ stroke });
          if (selectedLayer?.type === 'shape') updateLayer(selectedLayer.id, { stroke });
        }}
      />
      <SizeOpt
        label="Weight"
        value={
          selectedLayer?.type === 'shape'
            ? selectedLayer.strokeWidth
            : shapeSettings.strokeWidth
        }
        min={0}
        max={40}
        unit="px"
        onCommit={(strokeWidth) => {
          updateShapeSettings({ strokeWidth });
          if (selectedLayer?.type === 'shape') {
            updateLayer(selectedLayer.id, { strokeWidth });
          }
        }}
      />
      <SizeOpt
        label="Opacity"
        value={
          selectedLayer?.type === 'shape' ? selectedLayer.opacity : shapeSettings.opacity
        }
        min={0.05}
        max={1}
        step={0.05}
        onCommit={(opacity) => {
          updateShapeSettings({ opacity });
          if (selectedLayer?.type === 'shape') {
            updateLayer(selectedLayer.id, { opacity });
          }
        }}
      />
      {(activeShapeType === 'rectangle' ||
        activeShapeType === 'callout' ||
        (selectedLayer?.type === 'shape' &&
          (selectedLayer.shapeType === 'rectangle' ||
            selectedLayer.shapeType === 'callout'))) && (
        <SizeOpt
          label="Radius"
          value={
            selectedLayer?.type === 'shape'
              ? selectedLayer.cornerRadius ?? 0
              : shapeSettings.cornerRadius
          }
          min={0}
          max={80}
          onCommit={(cornerRadius) => {
            updateShapeSettings({ cornerRadius });
            if (selectedLayer?.type === 'shape') {
              updateLayer(selectedLayer.id, { cornerRadius });
            }
          }}
        />
      )}
      {selectedLayer?.type === 'shape' &&
        (selectedLayer.shapeType === 'polygon' || selectedLayer.shapeType === 'star') && (
          <SizeOpt
            label={selectedLayer.shapeType === 'star' ? 'Points' : 'Sides'}
            value={selectedLayer.sides || 5}
            min={3}
            max={12}
            onCommit={(sides) => updateLayer(selectedLayer.id, { sides })}
          />
        )}
      {selectedLayer?.type === 'shape' &&
        (selectedLayer.shapeType === 'arc' || selectedLayer.shapeType === 'wedge') && (
          <SizeOpt
            label="Angle"
            value={selectedLayer.angle || 60}
            min={15}
            max={360}
            unit="°"
            onCommit={(angle) => updateLayer(selectedLayer.id, { angle })}
          />
        )}
      {selectedLayer?.type === 'shape' &&
        (selectedLayer.shapeType === 'ring' || selectedLayer.shapeType === 'star') && (
          <SizeOpt
            label="Inner"
            value={selectedLayer.innerRadius ?? 0.45}
            min={0.15}
            max={0.9}
            step={0.05}
            onCommit={(innerRadius) => updateLayer(selectedLayer.id, { innerRadius })}
          />
        )}
    </div>
  );
};
