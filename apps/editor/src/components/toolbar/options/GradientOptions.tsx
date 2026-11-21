import React from 'react';
import { ArrowLeftRight } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { ColorOpt, OptChip, OptHint, OptSep, SizeOpt } from '../../ui/OptionControls';

export const GradientOptions: React.FC = () => {
  const gradientSettings = useEditorStore((s) => s.gradientSettings);
  const updateGradientSettings = useEditorStore((s) => s.updateGradientSettings);

  const stops = gradientSettings.colorStops;
  const stopStart = stops[0]?.color ?? '#000000';
  const stopEnd = stops[stops.length - 1]?.color ?? '#ffffff';
  const setEndStop = (which: 'start' | 'end', color: string) => {
    const next = stops.map((st, i) =>
      (which === 'start' && i === 0) || (which === 'end' && i === stops.length - 1)
        ? { ...st, color }
        : st
    );
    updateGradientSettings({ colorStops: next });
  };
  const gradientCss = `linear-gradient(90deg, ${[...stops]
    .sort((a, b) => a.offset - b.offset)
    .map((st) => `${st.color} ${Math.round(st.offset * 100)}%`)
    .join(', ')})`;

  return (
    <div className="flex items-center gap-3">
      <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
        <OptChip
          active={gradientSettings.gradientType === 'linear'}
          onClick={() => updateGradientSettings({ gradientType: 'linear' })}
        >
          Linear
        </OptChip>
        <OptChip
          active={gradientSettings.gradientType === 'radial'}
          onClick={() => updateGradientSettings({ gradientType: 'radial' })}
        >
          Radial
        </OptChip>
      </div>
      <OptSep />
      <ColorOpt label="From" value={stopStart} onChange={(c) => setEndStop('start', c)} />
      <div
        title="Gradient preview"
        className="h-4 w-24 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)] shadow-inner"
        style={{ background: gradientCss }}
      />
      <ColorOpt label="To" value={stopEnd} onChange={(c) => setEndStop('end', c)} />
      <button
        type="button"
        title="Reverse stops"
        onClick={() =>
          updateGradientSettings({
            colorStops: stops.map((st) => ({ ...st, offset: 1 - st.offset })).reverse(),
          })
        }
        className="p-1 rounded cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeftRight size={12} />
      </button>
      <SizeOpt
        label="Opacity"
        value={gradientSettings.opacity}
        min={0.05}
        max={1}
        step={0.05}
        onCommit={(opacity) => updateGradientSettings({ opacity })}
      />
      <OptHint>Drag on canvas to set direction</OptHint>
    </div>
  );
};
