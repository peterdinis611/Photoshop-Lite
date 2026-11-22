import React, { useRef, useState } from 'react';
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
  Spline,
  SlidersHorizontal,
  ImagePlus,
  Layers,
  WandSparkles,
} from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { FILTER_PRESETS, DEFAULT_ADJUSTMENTS } from '../../utils/filterHelpers';
import { ImageAdjustments } from '../../types/editor';
import type { CurvePoint } from '../../types/editor';
import { DEFAULT_CURVES, DEFAULT_LEVELS } from '@photoshop-lite/editor-core';
import { CurvesEditor } from './CurvesEditor';
import { REVIVE_MODES, type ReviveMode } from '../../utils/photoRevive';
import { CLEANUP_MODES, type CleanupMode } from '../../utils/photoCleanup';
import { IMAGE_ACCEPT, loadImageFiles } from '../../utils/loadImageFiles';
import { PanelEmptyState } from './PanelEmptyState';
import { ToneSection } from './ToneSection';

const SliderRow: React.FC<{
  label: React.ReactNode;
  value: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, value, min = -100, max = 100, format, onChange }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[var(--text-muted)]">
      <span className="flex items-center gap-1">{label}</span>
      <span className="font-mono-ui text-[11px] text-[var(--text-faint)]">
        {format ? format(value) : value}
      </span>
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
    selectLayer,
    updateAdjustments,
    applyPresetToLayer,
    revivePhotoLayer,
    cleanPhotoLayer,
    addImageLayer,
    aiStatus,
  } = useEditorStore();

  const [quickMode, setQuickMode] = useState<ReviveMode>('natural');
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('standard');
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isImage = selectedLayer?.type === 'image';
  const adjustments = isImage ? selectedLayer.adjustments : DEFAULT_ADJUSTMENTS;
  const imageLayers = layers.filter((l) => l.type === 'image');

  const handleSliderChange = (key: keyof ImageAdjustments, value: number) => {
    if (!selectedLayer || !isImage) return;
    updateAdjustments(selectedLayer.id, { [key]: value });
  };

  const levels = { ...DEFAULT_LEVELS, ...(isImage ? selectedLayer.adjustments.levels : undefined) };
  const curves = isImage ? selectedLayer.adjustments.curves : undefined;
  const levelsDirty = (Object.keys(DEFAULT_LEVELS) as (keyof typeof DEFAULT_LEVELS)[]).some(
    (k) => levels[k] !== DEFAULT_LEVELS[k]
  );

  const handleCurvesChange = (rgb: CurvePoint[]) => {
    if (!selectedLayer || !isImage) return;
    updateAdjustments(selectedLayer.id, { curves: { ...DEFAULT_CURVES, ...curves, rgb } });
  };

  const handleLevelsChange = (key: keyof typeof DEFAULT_LEVELS, value: number) => {
    if (!selectedLayer || !isImage) return;
    const next = { ...levels, [key]: value };
    if (key === 'inBlack') next.inBlack = Math.min(value, next.inWhite - 1);
    if (key === 'inWhite') next.inWhite = Math.max(value, next.inBlack + 1);
    updateAdjustments(selectedLayer.id, { levels: next });
  };

  const handleReset = () => {
    if (!selectedLayer || !isImage) return;
    updateAdjustments(selectedLayer.id, { ...DEFAULT_ADJUSTMENTS });
  };

  const openImage = async (files: FileList | null) => {
    if (!files?.length) return;
    const loaded = await loadImageFiles(Array.from(files).slice(0, 1));
    const img = loaded[0];
    if (!img) return;
    addImageLayer(img.src, img.name, img.width, img.height);
  };

  if (!isImage) {
    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void openImage(e.target.files);
            e.target.value = '';
          }}
        />
        <PanelEmptyState
          icon={<Sliders size={26} />}
          title="No image layer"
          description="Open a photo or select an image layer to grade exposure, color, curves, and run Photo Revive."
          features={['Revive & Cleanup', 'Curves · Levels', 'Presets', 'Manual grade']}
          actions={[
            {
              label: 'Open image',
              primary: true,
              icon: <ImagePlus size={13} />,
              onClick: () => fileRef.current?.click(),
            },
            ...(imageLayers[0]
              ? [
                  {
                    label: 'Select top image',
                    icon: <Layers size={13} />,
                    onClick: () => selectLayer(imageLayers[imageLayers.length - 1].id),
                  },
                ]
              : []),
          ]}
        >
          {imageLayers.length > 1 && (
            <div className="panel-empty__layers">
              <p className="panel-empty__layers-label font-mono-ui">Image layers</p>
              <ul>
                {[...imageLayers].reverse().map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => selectLayer(l.id)}>
                      {l.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PanelEmptyState>
      </>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-xs text-[var(--text-muted)] gap-3 select-none animate-panel-in">
      {/* Quick auto strip */}
      <div className="tone-auto flex gap-1.5">
        <button
          type="button"
          disabled={aiStatus.isProcessing}
          onClick={() => revivePhotoLayer(selectedLayer.id, 'natural', 0.75, false)}
          className="tone-auto__btn"
          title="One-click natural revive"
        >
          <WandSparkles size={12} /> Auto tone
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="tone-auto__btn tone-auto__btn--ghost"
          title="Reset all adjustments"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <ToneSection
        id="revive"
        title="Photo Revive"
        icon={<SunMedium size={13} />}
        badge="Oživenie"
        defaultOpen
      >
        <div className="flex flex-wrap gap-1 mb-2">
          {REVIVE_MODES.slice(0, 4).map((m) => (
            <button
              key={m.id}
              type="button"
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
          type="button"
          disabled={aiStatus.isProcessing}
          onClick={() => revivePhotoLayer(selectedLayer.id, quickMode, 0.8, false)}
          className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hot)] text-[#1a1208] font-display font-bold rounded-[var(--radius-md)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Sparkles size={14} />
          {aiStatus.isProcessing && aiStatus.action === 'revive' ? 'Reviving…' : 'Revive'}
        </button>
      </ToneSection>

      <ToneSection
        id="cleanup"
        title="Photo Cleanup"
        icon={<Eraser size={13} />}
        badge="Vyčistenie"
        defaultOpen={false}
      >
        <div className="flex flex-wrap gap-1 mb-2">
          {CLEANUP_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
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
          type="button"
          disabled={aiStatus.isProcessing}
          onClick={() => cleanPhotoLayer(selectedLayer.id, cleanupMode, 0.7, true)}
          className="w-full py-2 bg-[var(--ink-blue)] hover:brightness-110 text-white font-display font-bold rounded-[var(--radius-md)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Eraser size={14} />
          {aiStatus.isProcessing && aiStatus.action === 'cleanup' ? 'Cleaning…' : 'Clean'}
        </button>
      </ToneSection>

      <ToneSection id="presets" title="Presets" icon={<Palette size={13} />} defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          {FILTER_PRESETS.map((preset) => {
            const isCurrent = selectedLayer.preset === preset.name;
            return (
              <button
                key={preset.id}
                type="button"
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
      </ToneSection>

      <ToneSection
        id="curves"
        title="Curves"
        icon={<Spline size={13} />}
        badge="RGB"
        defaultOpen={false}
      >
        <CurvesEditor points={curves?.rgb} onChange={handleCurvesChange} />
      </ToneSection>

      <ToneSection
        id="levels"
        title="Levels"
        icon={<SlidersHorizontal size={13} />}
        defaultOpen={false}
        actions={
          levelsDirty ? (
            <button
              type="button"
              onClick={() => updateAdjustments(selectedLayer.id, { levels: { ...DEFAULT_LEVELS } })}
              className="flex items-center gap-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <RotateCcw size={11} /> Reset
            </button>
          ) : null
        }
      >
        <div className="flex flex-col gap-2.5">
          <SliderRow
            label="Input black"
            value={levels.inBlack}
            min={0}
            max={254}
            onChange={(v) => handleLevelsChange('inBlack', v)}
          />
          <SliderRow
            label="Gamma"
            value={Math.round(levels.inGamma * 100)}
            min={10}
            max={999}
            format={(v) => (v / 100).toFixed(2)}
            onChange={(v) => handleLevelsChange('inGamma', v / 100)}
          />
          <SliderRow
            label="Input white"
            value={levels.inWhite}
            min={1}
            max={255}
            onChange={(v) => handleLevelsChange('inWhite', v)}
          />
          <SliderRow
            label="Output black"
            value={levels.outBlack}
            min={0}
            max={255}
            onChange={(v) => handleLevelsChange('outBlack', v)}
          />
          <SliderRow
            label="Output white"
            value={levels.outWhite}
            min={0}
            max={255}
            onChange={(v) => handleLevelsChange('outWhite', v)}
          />
        </div>
      </ToneSection>

      <ToneSection id="manual" title="Manual grade" icon={<Sliders size={13} />} defaultOpen>
        <div className="flex flex-col gap-2.5">
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
                <Zap size={12} /> Exposure
              </>
            }
            value={adjustments.exposure}
            onChange={(v) => handleSliderChange('exposure', v)}
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
          <SliderRow label="Vibrance" value={adjustments.vibrance} onChange={(v) => handleSliderChange('vibrance', v)} />
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
                <Thermometer size={12} /> Temperature
              </>
            }
            value={adjustments.temperature}
            onChange={(v) => handleSliderChange('temperature', v)}
          />
          <SliderRow label="Tint" value={adjustments.tint} onChange={(v) => handleSliderChange('tint', v)} />
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
                type="button"
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
      </ToneSection>
    </div>
  );
};
