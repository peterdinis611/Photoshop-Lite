import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { ColorOpt, OptChip, OptHint, SizeOpt } from '../../ui/OptionControls';

interface SelectionOptionsProps {
  tool: 'marquee' | 'lasso' | 'polyLasso' | 'magneticLasso' | 'quickSelect' | 'wand';
}

/** Marquee / lasso family / quick select / magic wand. */
export const SelectionOptions: React.FC<SelectionOptionsProps> = ({ tool }) => {
  const marqueeSelection = useEditorStore((s) => s.marqueeSelection);
  const setMarqueeSelection = useEditorStore((s) => s.setMarqueeSelection);
  const marqueeMode = useEditorStore((s) => s.marqueeMode);
  const setMarqueeMode = useEditorStore((s) => s.setMarqueeMode);
  const wandTolerance = useEditorStore((s) => s.wandTolerance);
  const setWandTolerance = useEditorStore((s) => s.setWandTolerance);
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const updateBrushSettings = useEditorStore((s) => s.updateBrushSettings);

  const deselect = marqueeSelection ? (
    <OptChip onClick={() => setMarqueeSelection(null)}>Deselect</OptChip>
  ) : null;

  switch (tool) {
    case 'marquee':
      return (
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5">
            <OptChip active={marqueeMode === 'rect'} onClick={() => setMarqueeMode('rect')}>
              Rect
            </OptChip>
            <OptChip active={marqueeMode === 'ellipse'} onClick={() => setMarqueeMode('ellipse')}>
              Ellipse
            </OptChip>
          </div>
          <OptHint>
            Drag to select · <kbd className="text-[var(--accent-hot)]">Del</kbd> clears ·{' '}
            <kbd className="text-[var(--accent-hot)]">Esc</kbd> deselects
          </OptHint>
          {deselect}
        </div>
      );
    case 'lasso':
      return (
        <div className="flex items-center gap-3">
          <OptHint>
            Drag freehand · release to close · <kbd className="text-[var(--accent-hot)]">Del</kbd>{' '}
            clears
          </OptHint>
          {deselect}
        </div>
      );
    case 'polyLasso':
      return (
        <div className="flex items-center gap-3">
          <OptHint>
            Click to add points · double-click or{' '}
            <kbd className="text-[var(--accent-hot)]">Enter</kbd> to close ·{' '}
            <kbd className="text-[var(--accent-hot)]">Esc</kbd> cancels
          </OptHint>
          {deselect}
        </div>
      );
    case 'magneticLasso':
      return (
        <div className="flex items-center gap-3">
          <OptHint>Trace along an edge — the path snaps to contrast · click to close</OptHint>
          {deselect}
        </div>
      );
    case 'quickSelect':
      return (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Tolerance"
            value={wandTolerance}
            min={0}
            max={96}
            onCommit={setWandTolerance}
          />
          <OptHint>Paint over the subject — selection grows to similar edges</OptHint>
          {deselect}
        </div>
      );
    case 'wand':
      return (
        <div className="flex items-center gap-3">
          <SizeOpt
            label="Tolerance"
            value={wandTolerance}
            min={0}
            max={96}
            onCommit={setWandTolerance}
          />
          <ColorOpt
            label="Sample"
            value={brushSettings.color}
            onChange={(color) => updateBrushSettings({ color })}
          />
          <OptHint>Click similar color region on an image layer</OptHint>
        </div>
      );
  }
};
