import React, { useState } from 'react';
import { X, Scissors } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { notify } from '../../utils/notify';

export const SelectAndMaskModal: React.FC = () => {
  const open = useEditorStore((s) => s.isSelectAndMaskModalOpen);
  const setOpen = useEditorStore((s) => s.setSelectAndMaskModalOpen);
  const marqueeSelection = useEditorStore((s) => s.marqueeSelection);
  const modifyMarqueeSelection = useEditorStore((s) => s.modifyMarqueeSelection);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const updateBrushSettings = useEditorStore((s) => s.updateBrushSettings);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);

  const [radius, setRadius] = useState(2);
  const [contrast, setContrast] = useState(0);
  const [shiftEdge, setShiftEdge] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const layer = layers.find((l) => l.id === selectedLayerId);
  const hasSel = Boolean(marqueeSelection);

  const apply = async () => {
    if (!marqueeSelection) {
      notify.error('Make a selection first');
      return;
    }
    setBusy(true);
    try {
      // Shift edge: expand (+) or contract (−)
      if (shiftEdge > 0) await modifyMarqueeSelection('expand', shiftEdge);
      else if (shiftEdge < 0) await modifyMarqueeSelection('contract', Math.abs(shiftEdge));

      // Radius / contrast → feather soft edge into layer mask
      const featherPx = Math.max(0, radius + Math.round(contrast / 25));
      if (featherPx > 0) await modifyMarqueeSelection('feather', featherPx);

      setActiveTool('refineBrush');
      updateBrushSettings({ refineMode: 'restore', size: Math.max(8, radius * 4) });
      notify.success('Select & Mask applied — refine with brush');
      setOpen(false);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Select & Mask failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-labelledby="sam-title"
        className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 id="sam-title" className="font-display text-sm font-bold text-[var(--text-primary)]">
            Select and Mask
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 text-xs text-[var(--text-muted)]">
          <p className="text-[11px] text-[var(--text-faint)]">
            Refine edge on {layer?.name || 'selection'} — radius softens, shift edge grows/shrinks,
            then opens Refine Brush.
          </p>
          {(
            [
              ['Radius', radius, setRadius, 0, 20],
              ['Contrast', contrast, setContrast, 0, 100],
              ['Shift Edge', shiftEdge, setShiftEdge, -50, 50],
            ] as const
          ).map(([label, value, setter, min, max]) => (
            <label key={label} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="w-28 cursor-pointer"
                />
                <span className="font-mono-ui w-8 text-right">{value}</span>
              </div>
            </label>
          ))}
          {!hasSel && (
            <p className="text-[11px] text-[var(--danger,#c45)]">No active selection.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-[var(--border-subtle)] px-3 py-1.5 text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasSel || busy}
            onClick={() => void apply()}
            className="flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#1a1208] disabled:opacity-40 cursor-pointer"
          >
            <Scissors size={13} />
            {busy ? 'Working…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
