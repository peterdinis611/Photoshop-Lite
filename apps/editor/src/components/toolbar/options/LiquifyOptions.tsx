import React from 'react';
import type { LiquifyMode } from '@photoshop-lite/editor-core';
import { useEditorStore } from '../../../store/editorStore';
import { OptChip, OptHint, OptLabel, OptSep, SizeOpt } from '../../ui/OptionControls';

const MODES: { id: LiquifyMode; label: string; hint: string }[] = [
  { id: 'push', label: 'Push', hint: 'Drag to push pixels along the stroke' },
  { id: 'twirl', label: 'Twirl', hint: 'Drag to spin pixels around the brush centre' },
  {
    id: 'reconstruct',
    label: 'Reconstruct',
    hint: 'Paint to melt warped areas back toward the original',
  },
];

export const LiquifyOptions: React.FC = () => {
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const updateBrushSettings = useEditorStore((s) => s.updateBrushSettings);
  const liquifySettings = useEditorStore((s) => s.liquifySettings);
  const updateLiquifySettings = useEditorStore((s) => s.updateLiquifySettings);

  return (
    <div className="flex items-center gap-3">
      <OptLabel>Mode</OptLabel>
      <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
        {MODES.map((mode) => (
          <OptChip
            key={mode.id}
            title={mode.hint}
            active={liquifySettings.mode === mode.id}
            onClick={() => updateLiquifySettings({ mode: mode.id })}
          >
            {mode.label}
          </OptChip>
        ))}
      </div>
      <OptSep />
      <SizeOpt
        label="Size"
        value={brushSettings.size}
        min={10}
        max={200}
        unit="px"
        onCommit={(size) => updateBrushSettings({ size })}
        widthClass="w-24"
      />
      <SizeOpt
        label="Strength"
        value={Math.round(liquifySettings.strength * 100)}
        min={5}
        max={100}
        unit="%"
        onCommit={(pct) => updateLiquifySettings({ strength: pct / 100 })}
        widthClass="w-24"
      />
      <OptHint>{MODES.find((m) => m.id === liquifySettings.mode)?.hint}</OptHint>
    </div>
  );
};
