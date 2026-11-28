import React, { useState } from 'react';
import { Sparkles } from 'pulsoicon-react';
import { useEditorStore } from '../../../store/editorStore';
import { ColorOpt, OptChip, OptHint, SizeOpt } from '../../ui/OptionControls';

interface BrushOptionsProps {
  tool:
    | 'brush'
    | 'eraser'
    | 'clone'
    | 'spotHealing'
    | 'fill'
    | 'blur'
    | 'refineBrush'
    | 'historyBrush';
}

/** Brush / eraser / clone / spot healing, plus paint-bucket, blur, refine-edge, history brush. */
export const BrushOptions: React.FC<BrushOptionsProps> = ({ tool }) => {
  const brushSettings = useEditorStore((s) => s.brushSettings);
  const updateBrushSettings = useEditorStore((s) => s.updateBrushSettings);
  const brushPresets = useEditorStore((s) => s.brushPresets);
  const applyBrushPreset = useEditorStore((s) => s.applyBrushPreset);
  const saveBrushPreset = useEditorStore((s) => s.saveBrushPreset);
  const wandTolerance = useEditorStore((s) => s.wandTolerance);
  const setWandTolerance = useEditorStore((s) => s.setWandTolerance);
  const [presetPick, setPresetPick] = useState('');
  const [saveName, setSaveName] = useState('');

  if (tool === 'fill') {
    return (
      <div className="flex items-center gap-3">
        <ColorOpt
          label="Fill"
          value={brushSettings.color}
          onChange={(color) => updateBrushSettings({ color })}
        />
        <SizeOpt
          label="Tolerance"
          value={wandTolerance}
          min={0}
          max={96}
          onCommit={setWandTolerance}
        />
        <SizeOpt
          label="Opacity"
          value={brushSettings.opacity}
          min={0.05}
          max={1}
          step={0.05}
          onCommit={(opacity) => updateBrushSettings({ opacity })}
        />
        <OptHint>Click image region to flood-fill</OptHint>
      </div>
    );
  }

  if (tool === 'blur') {
    return (
      <div className="flex items-center gap-3">
        <SizeOpt
          label="Radius"
          value={brushSettings.size}
          min={6}
          max={80}
          unit="px"
          onCommit={(size) => updateBrushSettings({ size })}
          widthClass="w-24"
        />
        <SizeOpt
          label="Strength"
          value={brushSettings.opacity}
          min={0.2}
          max={1}
          step={0.05}
          onCommit={(opacity) => updateBrushSettings({ opacity })}
        />
        <SizeOpt
          label="Hardness"
          value={brushSettings.hardness}
          min={0}
          max={1}
          step={0.05}
          onCommit={(hardness) => updateBrushSettings({ hardness })}
        />
        <OptHint>Click / drag to soften areas</OptHint>
      </div>
    );
  }

  if (tool === 'refineBrush') {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[var(--accent-hot)] font-semibold">
          <Sparkles size={12} /> Edge
        </span>
        <div className="flex bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-0.5 gap-0.5">
          <OptChip
            active={brushSettings.refineMode === 'erase'}
            onClick={() => updateBrushSettings({ refineMode: 'erase' })}
          >
            Erase
          </OptChip>
          <OptChip
            active={brushSettings.refineMode === 'restore'}
            onClick={() => updateBrushSettings({ refineMode: 'restore' })}
          >
            Restore
          </OptChip>
        </div>
        <SizeOpt
          label="Radius"
          value={brushSettings.size}
          min={4}
          max={80}
          unit="px"
          onCommit={(size) => updateBrushSettings({ size })}
          widthClass="w-24"
        />
        <SizeOpt
          label="Hardness"
          value={brushSettings.hardness}
          min={0}
          max={1}
          step={0.05}
          onCommit={(hardness) => updateBrushSettings({ hardness })}
        />
        <SizeOpt
          label="Opacity"
          value={brushSettings.opacity}
          min={0.05}
          max={1}
          step={0.05}
          onCommit={(opacity) => updateBrushSettings({ opacity })}
        />
      </div>
    );
  }

  const jitterSliders = tool === 'brush' && (
    <>
      <SizeOpt
        label="Sz jitter"
        value={brushSettings.sizeJitter ?? 0}
        min={0}
        max={1}
        step={0.05}
        onCommit={(sizeJitter) => updateBrushSettings({ sizeJitter })}
      />
      <SizeOpt
        label="Op jitter"
        value={brushSettings.opacityJitter ?? 0}
        min={0}
        max={1}
        step={0.05}
        onCommit={(opacityJitter) => updateBrushSettings({ opacityJitter })}
      />
      <SizeOpt
        label="Spacing"
        value={brushSettings.spacing ?? 0.25}
        min={0.05}
        max={1.5}
        step={0.05}
        onCommit={(spacing) => updateBrushSettings({ spacing })}
      />
    </>
  );

  const presetRow = tool === 'brush' && (
    <div className="flex items-center gap-2 border-l border-[var(--border-subtle)] pl-3">
      <select
        value={presetPick}
        onChange={(e) => {
          const id = e.target.value;
          setPresetPick(id);
          if (id) applyBrushPreset(id);
        }}
        className="max-w-[7rem] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] cursor-pointer"
        aria-label="Brush preset"
      >
        <option value="">Preset…</option>
        {brushPresets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
        placeholder="Name"
        className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1 py-0.5 text-[10px]"
      />
      <button
        type="button"
        onClick={() => {
          if (!saveName.trim()) return;
          saveBrushPreset(saveName);
          setSaveName('');
        }}
        className="text-[10px] font-semibold text-[var(--accent-hot)] cursor-pointer hover:underline"
      >
        Save
      </button>
    </div>
  );

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {presetRow}
      <SizeOpt
        label="Size"
        value={brushSettings.size}
        min={2}
        max={150}
        unit="px"
        onCommit={(size) => updateBrushSettings({ size })}
        widthClass="w-24"
      />
      <SizeOpt
        label="Hardness"
        value={brushSettings.hardness}
        min={0}
        max={1}
        step={0.05}
        onCommit={(hardness) => updateBrushSettings({ hardness })}
      />
      <SizeOpt
        label="Opacity"
        value={brushSettings.opacity}
        min={0.05}
        max={1}
        step={0.05}
        onCommit={(opacity) => updateBrushSettings({ opacity })}
      />
      {(tool === 'brush' || tool === 'eraser') && brushSettings.flow !== undefined && (
        <SizeOpt
          label="Flow"
          value={brushSettings.flow}
          min={0.05}
          max={1}
          step={0.05}
          onCommit={(flow) => updateBrushSettings({ flow })}
        />
      )}
      {jitterSliders}
      {tool === 'brush' && (
        <ColorOpt
          label="Color"
          value={brushSettings.color}
          onChange={(color) => updateBrushSettings({ color })}
        />
      )}
      {tool === 'brush' && (
        <OptHint>
          <kbd>[</kbd>/<kbd>]</kbd> size · <kbd>X</kbd> swap
        </OptHint>
      )}
      {tool === 'eraser' && <OptHint>Erase strokes / pixels on active layer</OptHint>}
      {tool === 'clone' && <OptHint>Alt+click source · drag to paint</OptHint>}
      {tool === 'spotHealing' && <OptHint>Drag over blemishes on image layer</OptHint>}
    </div>
  );
};