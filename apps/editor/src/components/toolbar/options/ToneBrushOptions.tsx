import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { OptChip, OptHint, OptLabel, OptSep, SizeOpt } from '../../ui/OptionControls';

interface ToneBrushOptionsProps {
  tool: 'dodge' | 'burn' | 'sharpenTool';
}

/** Dodge / burn / sharpen brush. */
export const ToneBrushOptions: React.FC<ToneBrushOptionsProps> = ({ tool }) => {
  const toneBrushSettings = useEditorStore((s) => s.toneBrushSettings);
  const updateToneBrushSettings = useEditorStore((s) => s.updateToneBrushSettings);

  return (
    <div className="flex items-center gap-3">
      <SizeOpt
        label="Size"
        value={toneBrushSettings.size}
        min={4}
        max={200}
        unit="px"
        onCommit={(size) => updateToneBrushSettings({ size })}
        widthClass="w-24"
      />
      <SizeOpt
        label="Hardness"
        value={toneBrushSettings.hardness}
        min={0}
        max={1}
        step={0.05}
        onCommit={(hardness) => updateToneBrushSettings({ hardness })}
      />
      <SizeOpt
        label="Exposure"
        value={toneBrushSettings.exposure}
        min={1}
        max={100}
        unit="%"
        onCommit={(exposure) => updateToneBrushSettings({ exposure })}
      />
      {tool !== 'sharpenTool' && (
        <>
          <OptSep />
          <OptLabel>Range</OptLabel>
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
            {(['shadows', 'midtones', 'highlights'] as const).map((range) => (
              <OptChip
                key={range}
                active={toneBrushSettings.range === range}
                onClick={() => updateToneBrushSettings({ range })}
              >
                {range}
              </OptChip>
            ))}
          </div>
        </>
      )}
      <OptHint>
        {tool === 'dodge'
          ? 'Paint to lighten'
          : tool === 'burn'
            ? 'Paint to darken'
            : 'Paint to add local detail'}
      </OptHint>
    </div>
  );
};
