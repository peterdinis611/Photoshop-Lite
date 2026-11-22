import React from 'react';
import { Check, X, RotateCw, RotateCcw } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { OptChip, OptLabel, OptSep } from '../../ui/OptionControls';

const CROP_RATIOS = ['free', '1:1', '16:9', '4:3', '3:2', '9:16'] as const;

export const CropOptions: React.FC = () => {
  const cropSettings = useEditorStore((s) => s.cropSettings);
  const setCropSettings = useEditorStore((s) => s.setCropSettings);
  const applyCrop = useEditorStore((s) => s.applyCrop);
  const cancelCrop = useEditorStore((s) => s.cancelCrop);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  const rotateBy = (delta: number) => {
    if (!selectedLayer) return;
    const next = (((selectedLayer.rotation + delta) % 360) + 360) % 360;
    updateLayer(selectedLayer.id, { rotation: next });
    setCropSettings({ rotation: next });
  };

  return (
    <div className="flex items-center gap-2">
      <OptLabel>Mode</OptLabel>
      <OptChip
        active={(cropSettings.mode || 'rect') === 'rect'}
        onClick={() => setCropSettings({ mode: 'rect' })}
      >
        Rect
      </OptChip>
      <OptChip
        active={cropSettings.mode === 'perspective'}
        onClick={() => {
          setCropSettings({ mode: 'perspective' });
          // Perspective crop → Transform perspective handles
          const store = useEditorStore.getState();
          store.setActiveTool('transform');
          store.setTransformMode('perspective');
        }}
      >
        Perspective
      </OptChip>
      <OptSep />
      <OptLabel>Ratio</OptLabel>
      {CROP_RATIOS.map((ratio) => (
        <OptChip
          key={ratio}
          active={cropSettings.aspect === ratio}
          onClick={() => {
            let w = cropSettings.width;
            let h = cropSettings.height;
            if (ratio === '1:1') {
              const s = Math.min(w, h);
              w = s;
              h = s;
            } else if (ratio === '16:9') h = Math.round((w * 9) / 16);
            else if (ratio === '4:3') h = Math.round((w * 3) / 4);
            else if (ratio === '3:2') h = Math.round((w * 2) / 3);
            else if (ratio === '9:16') w = Math.round((h * 9) / 16);
            setCropSettings({ aspect: ratio, width: w, height: h });
          }}
        >
          {ratio === 'free' ? 'Free' : ratio}
        </OptChip>
      ))}
      <OptSep />
      <OptLabel>Rotate</OptLabel>
      <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
        <button
          type="button"
          title="Rotate 90° CCW"
          disabled={!selectedLayer}
          onClick={() => rotateBy(-90)}
          className="p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          <RotateCcw size={13} />
        </button>
        <button
          type="button"
          title="Rotate 90° CW"
          disabled={!selectedLayer}
          onClick={() => rotateBy(90)}
          className="p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          <RotateCw size={13} />
        </button>
      </div>
      <OptSep />
      <button
        onClick={() => void applyCrop()}
        className="flex items-center gap-1 px-2 py-0.5 bg-[var(--success)] text-[#0b0c0f] rounded-[var(--radius-sm)] font-semibold cursor-pointer"
      >
        <Check size={11} /> Apply
      </button>
      <button
        onClick={cancelCrop}
        className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] cursor-pointer"
      >
        <X size={11} /> Cancel
      </button>
    </div>
  );
};
