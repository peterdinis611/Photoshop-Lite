import React, { useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  Sliders,
  Sun,
  Contrast,
  Palette,
  Thermometer,
  Zap,
  Eye,
  SunMedium,
  Eraser,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { FILTER_PRESETS, DEFAULT_ADJUSTMENTS } from '../../utils/filterHelpers';
import { ImageAdjustments } from '../../types/editor';
import { REVIVE_MODES, type ReviveMode } from '../../utils/photoRevive';
import { CLEANUP_MODES, type CleanupMode } from '../../utils/photoCleanup';

const SliderRow: React.FC<{
  label: React.ReactNode;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min = -100, max = 100, onChange }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[var(--text-muted)]">
      <span className="flex items-center gap-1">{label}</span>
      <span className="font-mono-ui text-[11px] text-[var(--text-faint)]">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="cursor-pointer w-full"
    />
  </div>
);

export const AdjustmentsPanel: React.FC = () => {
  const {
    layers,
    selectedLayerId,
    updateAdjustments,
    applyPresetToLayer,
    revivePhotoLayer,
    cleanPhotoLayer,
    aiStatus,
  } = useEditorStore();

  const [quickMode, setQuickMode] = useState<ReviveMode>('natural');
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('standard');

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isImage = selectedLayer?.type === 'image';
  const adjustments = isImage ? selectedLayer.adjustments : DEFAULT_ADJUSTMENTS;

  const handleSliderChange = (key: keyof ImageAdjustments, value: number) => {
    if (!selectedLayer || !isImage) return;
    updateAdjustments(selectedLayer.id, { [key]: value });
  };

  const handleReset = () => {
    if (!selectedLayer || !isImage) return;
    updateAdjustments(selectedLayer.id, { ...DEFAULT_ADJUSTMENTS });
  };

  if (!isImage) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center text-[var(--text-faint)] text-xs h-full gap-2 select-none">
        <Sliders size={28} className="text-[var(--border-strong)]" />
        <p className="font-medium text-[var(--text-muted)]">No image layer</p>
        <p className="text-[11px] max-w-[200px]">
          Select an image to adjust exposure, color, or run Photo Revive.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-xs text-[var(--text-muted)] gap-4 select-none animate-panel-in">
      <div className="rounded-[var(--radius-lg)] border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-display font-bold text-[var(--accent-hot)] text-[12px]">
            <SunMedium size={14} />
            Photo Revive
          </div>
          <span className="px-chip text-[var(--text-faint)]">Oživenie</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {REVIVE_MODES.slice(0, 4).map((m) => (
            <button
              key={m.id}
              onClick={() => setQuickMode(m.id)}
              className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer border ${
                quickMode === m.id
                  ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)]/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          disabled={aiStatus.isProcessing}
          onClick={() => revivePhotoLayer(selectedLayer.id, quickMode, 0.8, false)}
          className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hot)] text-[#1a1208] font-display font-bold rounded-[var(--radius-md)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Sparkles size={14} />
          {aiStatus.isProcessing && aiStatus.action === 'revive' ? 'Reviving…' : 'Revive'}
        </button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-display font-bold text-[var(--ink-blue)] text-[12px]">
            <Eraser size={14} />
            Photo Cleanup
          </div>
          <span className="px-chip text-[var(--text-faint)]">Vyčistenie</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {CLEANUP_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setCleanupMode(m.id)}
              className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer border ${
                cleanupMode === m.id
                  ? 'bg-[var(--ink-blue)] text-white border-transparent'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--ink-blue)]/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          disabled={aiStatus.isProcessing}
          onClick={() => cleanPhotoLayer(selectedLayer.id, cleanupMode, 0.7, true)}
          className="w-full py-2 bg-[var(--ink-blue)] hover:brightness-110 text-white font-display font-bold rounded-[var(--radius-md)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Eraser size={14} />
          {aiStatus.isProcessing && aiStatus.action === 'cleanup' ? 'Cleaning…' : 'Clean'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
            Presets
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {FILTER_PRESETS.map((preset) => {
            const isCurrent = selectedLayer.preset === preset.name;
            return (
              <button
                key={preset.id}
                onClick={() => applyPresetToLayer(selectedLayer.id, preset.id)}
                className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-left cursor-pointer ${
                  isCurrent
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)]/50 text-[var(--accent-hot)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                }`}
              >
                <span className="text-[11px] font-medium truncate">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-1 border-t border-[var(--border-subtle)]">
        <span className="font-semibold text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
          Manual
        </span>
        <SliderRow
          label={
            <>
              <Sun size={12} /> Brightness
            </>
          }
          value={adjustments.brightness}
          onChange={(v) => handleSliderChange('brightness', v)}
        />
        <SliderRow
          label={
            <>
              <Contrast size={12} /> Contrast
            </>
          }
          value={adjustments.contrast}
          onChange={(v) => handleSliderChange('contrast', v)}
        />
        <SliderRow
          label={
            <>
              <Palette size={12} /> Saturation
            </>
          }
          value={adjustments.saturation}
          onChange={(v) => handleSliderChange('saturation', v)}
        />
        <SliderRow
          label="Hue"
          value={adjustments.hue}
          min={-180}
          max={180}
          onChange={(v) => handleSliderChange('hue', v)}
        />
        <SliderRow
          label={
            <>
              <Zap size={12} /> Exposure
            </>
          }
          value={adjustments.exposure}
          onChange={(v) => handleSliderChange('exposure', v)}
        />
        <SliderRow
          label={
            <>
              <Eye size={12} /> Sharpness
            </>
          }
          value={adjustments.sharpness}
          min={0}
          max={100}
          onChange={(v) => handleSliderChange('sharpness', v)}
        />
        <SliderRow label="Vibrance" value={adjustments.vibrance} onChange={(v) => handleSliderChange('vibrance', v)} />
        <SliderRow
          label={
            <>
              <Thermometer size={12} /> Temperature
            </>
          }
          value={adjustments.temperature}
          onChange={(v) => handleSliderChange('temperature', v)}
        />
        <SliderRow label="Tint" value={adjustments.tint} onChange={(v) => handleSliderChange('tint', v)} />
        <SliderRow
          label="Blur"
          value={adjustments.blur}
          min={0}
          max={30}
          onChange={(v) => handleSliderChange('blur', v)}
        />

        <div className="flex flex-wrap gap-1.5 pt-1">
          {(
            [
              ['grayscale', 'B&W', adjustments.grayscale],
              ['sepia', 'Sepia', adjustments.sepia],
              ['invert', 'Invert', adjustments.invert],
            ] as const
          ).map(([key, label, on]) => (
            <button
              key={key}
              onClick={() =>
                updateAdjustments(selectedLayer.id, { [key]: !on } as Partial<ImageAdjustments>)
              }
              className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-semibold border cursor-pointer ${
                on
                  ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)]/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
