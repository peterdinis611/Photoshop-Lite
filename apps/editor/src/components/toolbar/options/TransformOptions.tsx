import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import type { TransformMode } from '../../../types/editor';
import { OptChip, OptHint, OptLabel } from '../../ui/OptionControls';

const TRANSFORM_MODES: TransformMode[] = ['free', 'skew', 'distort', 'perspective', 'warp'];

export const TransformOptions: React.FC = () => {
  const transformMode = useEditorStore((s) => s.transformMode);
  const setTransformMode = useEditorStore((s) => s.setTransformMode);
  const hasSelectedLayer = useEditorStore((s) =>
    s.layers.some((l) => l.id === s.selectedLayerId)
  );

  return (
    <div className="flex items-center gap-2">
      <OptLabel>Mode</OptLabel>
      <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
        {TRANSFORM_MODES.map((mode) => (
          <OptChip
            key={mode}
            active={transformMode === mode}
            onClick={() => setTransformMode(mode)}
          >
            {mode}
          </OptChip>
        ))}
      </div>
      {!hasSelectedLayer && <OptHint>Select a layer to transform</OptHint>}
    </div>
  );
};
