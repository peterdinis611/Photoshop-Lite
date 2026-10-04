import React, { useState } from 'react';
import {
  Scissors,
  Sparkles,
  Maximize,
  Key,
  Wand2,
  Brush,
  AlertCircle,
  SunMedium,
  Layers,
  Eraser,
  Cloud,
  ScanFace,
  Paintbrush,
  VenetianMask,
  MessageSquareText,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { REVIVE_MODES, type ReviveMode } from '../../utils/photoRevive';
import { CLEANUP_MODES, type CleanupMode } from '../../utils/photoCleanup';
import type { AiStylePreset } from '@photoshop-lite/shared-types';

const CLOUD_STYLES: { id: AiStylePreset; label: string }[] = [
  { id: 'film', label: 'Film' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'anime', label: 'Anime' },
  { id: 'watercolor', label: 'Water' },
  { id: 'noir', label: 'Noir' },
];

export const AISuitePanel: React.FC = () => {
  const {
    layers,
    selectedLayerId,
    removeBackground,
    upscaleLayer,
    revivePhotoLayer,
    cleanPhotoLayer,
    runCloudAiJob,
    aiStatus,
    lastCaption,
    removeBgApiKey,
    replicateApiKey,
    setApiKeys,
    activeTool,
    setActiveTool,
    brushSettings,
    updateBrushSettings,
    marqueeSelection,
  } = useEditorStore();

  const [provider, setProvider] = useState<'client' | 'remove.bg'>('client');
  const [upscaleFactor, setUpscaleFactor] = useState<number>(2);
  const [showKeyInputs, setShowKeyInputs] = useState(false);
  const [reviveMode, setReviveMode] = useState<ReviveMode>('natural');
  const [intensity, setIntensity] = useState(0.75);
  const [bakeLayer, setBakeLayer] = useState(false);
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('standard');
  const [cleanupIntensity, setCleanupIntensity] = useState(0.7);
  const [cleanupBake, setCleanupBake] = useState(true);
  const [cloudStyle, setCloudStyle] = useState<AiStylePreset>('film');
  const [inpaintPrompt, setInpaintPrompt] = useState('');

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isImage = selectedLayer?.type === 'image';
  const activeMode = REVIVE_MODES.find((m) => m.id === reviveMode);
  const activeCleanup = CLEANUP_MODES.find((m) => m.id === cleanupMode);

  const resolveImageId = () =>
    isImage
      ? selectedLayer.id
      : layers.slice().reverse().find((l) => l.type === 'image')?.id;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-xs gap-4 select-none animate-panel-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] border border-[var(--accent)]/40 flex items-center justify-center">
            <Wand2 size={14} className="text-[var(--accent-hot)]" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-[var(--text-primary)] leading-tight">
              Neural Lab
            </p>
            <p className="px-chip text-[var(--text-faint)]">Client · Cloud</p>
          </div>
        </div>
        <button
          onClick={() => setShowKeyInputs(!showKeyInputs)}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer border ${
            showKeyInputs || removeBgApiKey || replicateApiKey
              ? 'bg-[var(--accent-dim)] text-[var(--accent-hot)] border-[var(--accent)]/40'
              : 'text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)]'
          }`}
        >
          <Key size={11} /> Keys
        </button>
      </div>

      {showKeyInputs && (
        <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] flex flex-col gap-2.5">
          <span className="font-semibold text-[var(--text-muted)] text-[11px]">Cloud tokens</span>
          <div>
            <label className="text-[10px] text-[var(--text-faint)] block mb-1">remove.bg</label>
            <input
              type="password"
              placeholder="api key…"
              value={removeBgApiKey}
              onChange={(e) => setApiKeys({ removeBgApiKey: e.target.value })}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-faint)] block mb-1">Replicate</label>
            <input
              type="password"
              placeholder="r8_…"
              value={replicateApiKey}
              onChange={(e) => setApiKeys({ replicateApiKey: e.target.value })}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      )}

      {/* PHOTO REVIVE — hero feature */}
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--accent)]/35 bg-[var(--bg-elevated)] p-3.5 flex flex-col gap-3 shadow-[0_0_40px_-12px_var(--accent-glow)]">
        <div
          className="pointer-events-none absolute -right-8 -top-10 w-36 h-36 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--accent-hot) 0%, transparent 70%)',
          }}
        />
        <div className="relative flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <SunMedium size={15} className="text-[var(--accent-hot)]" />
              <span className="font-display font-bold text-[13px] text-[var(--text-primary)] tracking-tight">
                Photo Revive
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed max-w-[220px]">
              Oživenie fotky — histogram, color cast, shadow lift a clarity v jednom ťahu.
            </p>
          </div>
          <span className="px-chip shrink-0 px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent-hot)] border border-[var(--accent)]/30">
            New
          </span>
        </div>

        <div className="relative grid grid-cols-3 gap-1">
          {REVIVE_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setReviveMode(m.id)}
              title={m.blurb}
              className={`py-1.5 px-1 rounded-[var(--radius-sm)] text-[10px] font-semibold transition-all cursor-pointer border ${
                reviveMode === m.id
                  ? 'bg-[var(--accent)] text-[#1a1208] border-[var(--accent-hot)]'
                  : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {activeMode && (
          <p className="relative text-[10px] text-[var(--text-faint)] leading-snug -mt-1">
            {activeMode.blurb}
          </p>
        )}

        <div className="relative flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-medium">
            <span>Intensity</span>
            <span className="font-mono-ui text-[var(--accent-hot)]">{Math.round(intensity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={1}
            step={0.05}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>

        <label className="relative flex items-center gap-2 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={bakeLayer}
            onChange={(e) => setBakeLayer(e.target.checked)}
            className="accent-[var(--accent)] rounded"
          />
          <Layers size={12} className="text-[var(--accent)]" />
          Bake as new layer (pixel levels + unsharp)
        </label>

        <button
          disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
          onClick={() => {
            const targetId = resolveImageId();
            if (targetId) revivePhotoLayer(targetId, reviveMode, intensity, bakeLayer);
          }}
          className="relative w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hot)] disabled:opacity-40 text-[#1a1208] font-display font-bold text-[12px] rounded-[var(--radius-md)] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] animate-safelight"
        >
          <Sparkles size={15} />
          {aiStatus.isProcessing && aiStatus.action === 'revive'
            ? 'Reviving…'
            : 'Revive Photo'}
        </button>
      </section>

      {/* PHOTO CLEANUP */}
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 flex flex-col gap-3">
        <div className="relative flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Eraser size={15} className="text-[var(--ink-blue)]" />
              <span className="font-display font-bold text-[13px] text-[var(--text-primary)] tracking-tight">
                Photo Cleanup
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed max-w-[220px]">
              Vyčistenie fotky — denoise, speckles a jemný edge restore.
            </p>
          </div>
          <span className="px-chip shrink-0 px-1.5 py-0.5 rounded bg-[var(--bg-app)] text-[var(--ink-blue)] border border-[var(--border-subtle)]">
            Local
          </span>
        </div>

        <div className="relative grid grid-cols-2 gap-1">
          {CLEANUP_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setCleanupMode(m.id)}
              title={m.blurb}
              className={`py-1.5 px-1 rounded-[var(--radius-sm)] text-[10px] font-semibold transition-all cursor-pointer border ${
                cleanupMode === m.id
                  ? 'bg-[var(--ink-blue)] text-white border-transparent'
                  : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--ink-blue)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {activeCleanup && (
          <p className="relative text-[10px] text-[var(--text-faint)] leading-snug -mt-1">
            {activeCleanup.blurb}
          </p>
        )}

        <div className="relative flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-medium">
            <span>Intensity</span>
            <span className="font-mono-ui text-[var(--ink-blue)]">
              {Math.round(cleanupIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.25}
            max={1}
            step={0.05}
            value={cleanupIntensity}
            onChange={(e) => setCleanupIntensity(Number(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>

        <label className="relative flex items-center gap-2 text-[11px] text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={cleanupBake}
            onChange={(e) => setCleanupBake(e.target.checked)}
            className="accent-[var(--ink-blue)] rounded"
          />
          <Layers size={12} className="text-[var(--ink-blue)]" />
          Bake as new layer
        </label>

        <button
          disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
          onClick={() => {
            const targetId = resolveImageId();
            if (targetId) {
              cleanPhotoLayer(targetId, cleanupMode, cleanupIntensity, cleanupBake);
            }
          }}
          className="relative w-full py-2.5 bg-[var(--ink-blue)] hover:brightness-110 disabled:opacity-40 text-white font-display font-bold text-[12px] rounded-[var(--radius-md)] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
        >
          <Eraser size={15} />
          {aiStatus.isProcessing && aiStatus.action === 'cleanup'
            ? 'Cleaning…'
            : 'Clean Photo'}
        </button>
      </section>

      {/* CLOUD AI PROXY */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--accent)]/30 bg-[var(--bg-elevated)] p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-display font-bold text-[13px] text-[var(--text-primary)]">
            <Cloud size={15} className="text-[var(--accent-hot)]" />
            Cloud Lab
          </div>
          <span className="px-chip text-[var(--accent-hot)]">API</span>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] leading-snug">
          Server-side Replicate jobs. Set <code className="text-[var(--accent-hot)]">REPLICATE_API_TOKEN</code> on the API.
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ['cleanup', 'Denoise', Eraser],
              ['revive', 'Colorize', SunMedium],
              ['face-restore', 'Face', ScanFace],
              ['segment', 'Segment', VenetianMask],
            ] as const
          ).map(([kind, label, Icon]) => (
            <button
              key={kind}
              disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
              onClick={() => {
                const targetId = resolveImageId();
                if (targetId) runCloudAiJob(targetId, kind, { intensity: 0.7 });
              }}
              className="py-2 px-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[11px] font-semibold text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
            Style
          </span>
          <div className="flex flex-wrap gap-1">
            {CLOUD_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setCloudStyle(s.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer border ${
                  cloudStyle === s.id
                    ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
            onClick={() => {
              const targetId = resolveImageId();
              if (targetId) runCloudAiJob(targetId, 'style', { style: cloudStyle, intensity: 0.65 });
            }}
            className="w-full py-2 rounded-[var(--radius-md)] bg-[var(--accent-dim)] border border-[var(--accent)]/40 text-[var(--accent-hot)] font-display font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Paintbrush size={13} /> Apply style
          </button>
        </div>

        <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
            Inpaint · needs selection
          </span>
          <input
            type="text"
            placeholder="Optional prompt…"
            value={inpaintPrompt}
            onChange={(e) => setInpaintPrompt(e.target.value)}
            className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <button
            disabled={
              aiStatus.isProcessing ||
              !layers.some((l) => l.type === 'image') ||
              !marqueeSelection
            }
            onClick={() => {
              const targetId = resolveImageId();
              if (targetId) {
                runCloudAiJob(targetId, 'inpaint', { prompt: inpaintPrompt || undefined });
              }
            }}
            className="w-full py-2 rounded-[var(--radius-md)] bg-[var(--ink-blue)] text-white font-display font-bold text-[11px] cursor-pointer disabled:opacity-40"
          >
            Generative fill
          </button>
        </div>

        <button
          disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
          onClick={() => {
            const targetId = resolveImageId();
            if (targetId) runCloudAiJob(targetId, 'caption');
          }}
          className="w-full py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-muted)] font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 hover:text-[var(--text-primary)]"
        >
          <MessageSquareText size={13} /> Auto caption
        </button>
        {lastCaption && (
          <p className="text-[10px] text-[var(--text-muted)] leading-snug bg-[var(--bg-app)] rounded p-2 border border-[var(--border-subtle)]">
            {lastCaption}
          </p>
        )}
      </section>

      {/* Background Removal */}
      <section className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-blue)]">
            <Scissors size={14} />
            <span>Cutout</span>
          </div>
          <span className="px-chip px-1.5 py-0.5 rounded bg-[var(--bg-app)] text-[var(--text-faint)] border border-[var(--border-subtle)]">
            Alpha
          </span>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Semantic subject extract — new transparent layer.
        </p>
        <div className="flex items-center gap-1 bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
          {(['client', 'remove.bg'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                provider === p
                  ? 'bg-[var(--ink-blue)] text-white'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              {p === 'client' ? 'WASM' : 'remove.bg'}
            </button>
          ))}
        </div>
        <button
          disabled={aiStatus.isProcessing || !layers.some((l) => l.type === 'image')}
          onClick={() => {
            const targetId = resolveImageId();
            if (targetId) removeBackground(targetId, provider);
          }}
          className="w-full py-2 bg-[var(--ink-blue)] hover:brightness-110 disabled:opacity-40 text-white font-semibold rounded-[var(--radius-md)] flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Scissors size={14} />
          Remove Background
        </button>

        <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1">
              <Brush size={12} className="text-[var(--accent)]" /> Edge refine
            </span>
            <button
              onClick={() => setActiveTool(activeTool === 'refineBrush' ? 'select' : 'refineBrush')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                activeTool === 'refineBrush'
                  ? 'bg-[var(--accent)] text-[#1a1208]'
                  : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
              }`}
            >
              {activeTool === 'refineBrush' ? 'On' : 'Off'}
            </button>
          </div>
          {activeTool === 'refineBrush' && (
            <div className="flex gap-1">
              {(['erase', 'restore'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateBrushSettings({ refineMode: mode })}
                  className={`flex-1 py-0.5 rounded text-[10px] font-medium cursor-pointer capitalize ${
                    brushSettings.refineMode === mode
                      ? mode === 'erase'
                        ? 'bg-[var(--danger)] text-white'
                        : 'bg-[var(--success)] text-[#0b0c0f]'
                      : 'text-[var(--text-muted)] bg-[var(--bg-app)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Upscale */}
      <section className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
            <Maximize size={14} className="text-[var(--success)]" />
            Super-res
          </div>
          <span className="px-chip px-1.5 py-0.5 rounded bg-[var(--bg-app)] text-[var(--text-faint)] border border-[var(--border-subtle)]">
            ESRGAN
          </span>
        </div>
        <div className="flex gap-1">
          {[2, 4].map((scale) => (
            <button
              key={scale}
              onClick={() => setUpscaleFactor(scale)}
              className={`flex-1 py-1 rounded text-xs font-semibold cursor-pointer ${
                upscaleFactor === scale
                  ? 'bg-[var(--success)] text-[#0b0c0f]'
                  : 'bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
              }`}
            >
              {scale}×
            </button>
          ))}
        </div>
        <button
          disabled={!isImage || aiStatus.isProcessing}
          onClick={() => {
            if (selectedLayer) upscaleLayer(selectedLayer.id, upscaleFactor);
          }}
          className="w-full py-2 bg-[var(--bg-subtle)] hover:bg-[var(--border-strong)] disabled:opacity-40 text-[var(--text-primary)] font-semibold rounded-[var(--radius-md)] border border-[var(--border-subtle)] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles size={14} className="text-[var(--success)]" />
          Upscale {upscaleFactor}×
        </button>
      </section>

      {aiStatus.isProcessing && (
        <div className="p-3 bg-[var(--accent-dim)] border border-[var(--accent)]/40 rounded-[var(--radius-md)] flex flex-col gap-2">
          <div className="flex justify-between text-[var(--accent-hot)] font-semibold text-[11px]">
            <span className="truncate">{aiStatus.statusText}</span>
            <span className="font-mono-ui">{aiStatus.progress}%</span>
          </div>
          <div className="w-full bg-[var(--bg-app)] h-1 rounded-full overflow-hidden">
            <div
              className="bg-[var(--accent)] h-full transition-all duration-300"
              style={{ width: `${aiStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {aiStatus.error && (
        <div className="p-2.5 bg-red-950/40 border border-[var(--danger)]/40 rounded-[var(--radius-md)] text-[var(--danger)] text-[11px] flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{aiStatus.error}</span>
        </div>
      )}
    </div>
  );
};
