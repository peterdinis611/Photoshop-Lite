import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { ColorOpt, OptHint, SizeOpt } from '../../ui/OptionControls';

export const PenOptions: React.FC = () => {
  const penSettings = useEditorStore((s) => s.penSettings);
  const updatePenSettings = useEditorStore((s) => s.updatePenSettings);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  return (
    <div className="flex items-center gap-3">
      <ColorOpt
        label="Stroke"
        value={
          selectedLayer?.type === 'path' ? selectedLayer.stroke : penSettings.stroke
        }
        onChange={(stroke) => {
          updatePenSettings({ stroke });
          if (selectedLayer?.type === 'path') updateLayer(selectedLayer.id, { stroke });
        }}
      />
      <SizeOpt
        label="Weight"
        value={
          selectedLayer?.type === 'path'
            ? selectedLayer.strokeWidth
            : penSettings.strokeWidth
        }
        min={1}
        max={40}
        unit="px"
        onCommit={(strokeWidth) => {
          updatePenSettings({ strokeWidth });
          if (selectedLayer?.type === 'path') {
            updateLayer(selectedLayer.id, { strokeWidth });
          }
        }}
      />
      <ColorOpt
        label="Fill"
        value={
          (selectedLayer?.type === 'path' ? selectedLayer.fill : penSettings.fill) ===
          'transparent'
            ? '#000000'
            : selectedLayer?.type === 'path'
              ? selectedLayer.fill
              : penSettings.fill
        }
        onChange={(fill) => {
          updatePenSettings({ fill });
          if (selectedLayer?.type === 'path') updateLayer(selectedLayer.id, { fill });
        }}
        allowNone
        isNone={
          (selectedLayer?.type === 'path' ? selectedLayer.fill : penSettings.fill) ===
          'transparent'
        }
        onNone={() => {
          updatePenSettings({ fill: 'transparent' });
          if (selectedLayer?.type === 'path') {
            updateLayer(selectedLayer.id, { fill: 'transparent' });
          }
        }}
      />
      <SizeOpt
        label="Snap"
        value={penSettings.closeThreshold}
        min={4}
        max={32}
        unit="px"
        onCommit={(closeThreshold) => updatePenSettings({ closeThreshold })}
      />
      <OptHint>
        Click · drag curves · first closes · <kbd className="text-[var(--accent-hot)]">Enter</kbd>{' '}
        · <kbd className="text-[var(--accent-hot)]">Esc</kbd>
      </OptHint>
    </div>
  );
};
