import React, { startTransition, useState, ViewTransition } from 'react';
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
  ChevronDown,
  ImageOff,
  Cpu,
  Globe,
  Lightbulb,
  Smile,
  Trash2,
  Aperture,
  Blend,
  Expand,
  Layers2,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { REVIVE_MODES, type ReviveMode } from '../../utils/photoRevive';
import { CLEANUP_MODES, type CleanupMode } from '../../utils/photoCleanup';
import { RELIGHT_MODES, type RelightMode } from '../../utils/photoRelight';
import { PORTRAIT_MODES, type PortraitMode } from '../../utils/photoPortrait';
import { CLARITY_MODES, type ClarityMode } from '../../utils/photoClarity';
import { OUTPAINT_PRESETS, type OutpaintPreset } from '../../utils/photoOutpaint';
import { loadImageFiles } from '../../utils/loadImageFiles';
import type { AiStylePreset } from '@photoshop-lite/shared-types';

const CLOUD_STYLES: { id: AiStylePreset; label: string }[] = [
  { id: 'film', label: 'Film' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'anime', label: 'Anime' },
  { id: 'watercolor', label: 'Water' },
  { id: 'noir', label: 'Noir' },
];

type LabZone = 'local' | 'cloud' | 'extract';

type LocalRecipe = 'revive' | 'cleanup' | 'relight' | 'portrait' | 'clarity' | 'match';

export const AISuitePanel: React.FC = () => {
  const {
    layers,
    selectedLayerId,
    removeBackground,
    upscaleLayer,
    revivePhotoLayer,
    cleanPhotoLayer,
    relightPhotoLayer,
    polishPortraitLayer,
    clarityPhotoLayer,
    colorMatchLayer,
    outpaintDocument,
    runBatchLab,
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

  const [zone, setZone] = useState<LabZone>('local');
  const [localRecipe, setLocalRecipe] = useState<LocalRecipe>('revive');
  const [provider, setProvider] = useState<'client' | 'remove.bg'>('client');
  const [upscaleFactor, setUpscaleFactor] = useState<number>(2);
  const [showKeyInputs, setShowKeyInputs] = useState(false);
  const [reviveMode, setReviveMode] = useState<ReviveMode>('natural');
  const [intensity, setIntensity] = useState(0.75);
  const [bakeLayer, setBakeLayer] = useState(false);
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('standard');
  const [cleanupIntensity, setCleanupIntensity] = useState(0.7);
  const [cleanupBake, setCleanupBake] = useState(true);
  const [relightMode, setRelightMode] = useState<RelightMode>('softbox');
  const [relightIntensity, setRelightIntensity] = useState(0.7);
  const [relightBake, setRelightBake] = useState(true);
  const [portraitMode, setPortraitMode] = useState<PortraitMode>('natural');
  const [portraitIntensity, setPortraitIntensity] = useState(0.65);
  const [portraitBake, setPortraitBake] = useState(true);
  const [clarityMode, setClarityMode] = useState<ClarityMode>('clarity');
  const [clarityIntensity, setClarityIntensity] = useState(0.7);
  const [clarityBake, setClarityBake] = useState(true);
  const [matchIntensity, setMatchIntensity] = useState(0.8);
  const [matchBake, setMatchBake] = useState(true);
  const [matchRefSrc, setMatchRefSrc] = useState<string | null>(null);
  const [matchRefName, setMatchRefName] = useState('');
  const [outpaintPreset, setOutpaintPreset] = useState<OutpaintPreset>('expand');
  const [outpaintCloud, setOutpaintCloud] = useState(false);
  const [batchRevive, setBatchRevive] = useState(true);
  const [batchCleanup, setBatchCleanup] = useState(false);
  const [batchCutout, setBatchCutout] = useState(false);
  const [cloudStyle, setCloudStyle] = useState<AiStylePreset>('film');
  const [inpaintPrompt, setInpaintPrompt] = useState('');

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isImage = selectedLayer?.type === 'image';
  const hasImage = layers.some((l) => l.type === 'image');
  const imageLayerCount = layers.filter((l) => l.type === 'image').length;
  const activeMode = REVIVE_MODES.find((m) => m.id === reviveMode);
  const activeCleanup = CLEANUP_MODES.find((m) => m.id === cleanupMode);
  const activeRelight = RELIGHT_MODES.find((m) => m.id === relightMode);
  const activePortrait = PORTRAIT_MODES.find((m) => m.id === portraitMode);
  const activeClarity = CLARITY_MODES.find((m) => m.id === clarityMode);
  const busy = aiStatus.isProcessing;
  const keysReady = Boolean(removeBgApiKey || replicateApiKey);

  const resolveImageId = () =>
    isImage
      ? selectedLayer.id
      : layers.slice().reverse().find((l) => l.type === 'image')?.id;

  const selectZone = (next: LabZone) => {
    startTransition(() => setZone(next));
  };

  const selectRecipe = (next: LocalRecipe) => {
    startTransition(() => setLocalRecipe(next));
  };

  return (
    <div className="lab-panel flex flex-col h-full overflow-y-auto select-none animate-panel-in">
      {/* Header */}
      <header className="lab-header sticky top-0 z-10 px-3 pt-3 pb-2.5 bg-[var(--bg-panel)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lab-mark shrink-0">
              <Wand2 size={14} />
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-[13px] text-[var(--text-primary)] leading-tight tracking-tight">
                Neural Lab
              </p>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)] truncate">
                {hasImage
                  ? isImage
                    ? selectedLayer.name
                    : 'Using top image layer'
                  : 'No image on stage'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyInputs((v) => !v)}
            className={`lab-keys-btn ${showKeyInputs || keysReady ? 'lab-keys-btn--live' : ''}`}
            title="API keys"
          >
            <Key size={11} />
            <span>Keys</span>
          </button>
        </div>

        {showKeyInputs && (
          <div className="lab-keys mt-2.5">
            <label className="lab-field">
              <span>remove.bg</span>
              <input
                type="password"
                placeholder="api key…"
                value={removeBgApiKey}
                onChange={(e) => setApiKeys({ removeBgApiKey: e.target.value })}
              />
            </label>
            <label className="lab-field">
              <span>Replicate</span>
              <input
                type="password"
                placeholder="r8_…"
                value={replicateApiKey}
                onChange={(e) => setApiKeys({ replicateApiKey: e.target.value })}
              />
            </label>
          </div>
        )}

        <div className="lab-zones mt-2.5" role="tablist" aria-label="Lab workspace">
          {(
            [
              ['local', 'Local', Cpu],
              ['cloud', 'Cloud', Globe],
              ['extract', 'Extract', Scissors],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={zone === id}
              onClick={() => selectZone(id)}
              className={`lab-zone ${zone === id ? 'lab-zone--on' : ''}`}
            >
              <Icon size={12} strokeWidth={2.2} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-3 py-3 flex flex-col gap-3">
        {!hasImage && (
          <div className="lab-empty">
            <ImageOff size={18} className="text-[var(--accent)]" />
            <p className="font-display font-bold text-[13px] text-[var(--text-primary)]">
              Drop an image first
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Lab tools need a photo on the canvas. Drag one in, or use File → Open Image.
            </p>
          </div>
        )}

        <ViewTransition name="lab-zone" update="auto">
          {zone === 'local' && (
            <div key="local" className="lab-zone-body flex flex-col gap-3">
              <div className="lab-recipe-switch lab-recipe-switch--wrap">
                {(
                  [
                    ['revive', 'Revive', SunMedium],
                    ['cleanup', 'Cleanup', Eraser],
                    ['relight', 'Relight', Lightbulb],
                    ['portrait', 'Portrait', Smile],
                    ['clarity', 'Clarity', Aperture],
                    ['match', 'Match', Blend],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={localRecipe === id ? 'on' : ''}
                    onClick={() => selectRecipe(id)}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {localRecipe === 'revive' && (
                <section className="lab-card lab-card--hero">
                  <div className="lab-card-head">
                    <div>
                      <h3>Photo Revive</h3>
                      <p>Tone, color cast, shadow lift & clarity — one pass.</p>
                    </div>
                    <span className="lab-badge lab-badge--accent">Local</span>
                  </div>

                  <div className="lab-seg lab-seg--3">
                    {REVIVE_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.blurb}
                        onClick={() => setReviveMode(m.id)}
                        className={reviveMode === m.id ? 'on' : ''}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {activeMode && <p className="lab-hint">{activeMode.blurb}</p>}

                  <label className="lab-slider">
                    <span>
                      Intensity
                      <em>{Math.round(intensity * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min={0.25}
                      max={1}
                      step={0.05}
                      value={intensity}
                      onChange={(e) => setIntensity(Number(e.target.value))}
                    />
                  </label>

                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={bakeLayer}
                      onChange={(e) => setBakeLayer(e.target.checked)}
                    />
                    <Layers size={12} />
                    Bake as new layer
                  </label>

                  <button
                    type="button"
                    disabled={busy || !hasImage}
                    className="lab-cta"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) revivePhotoLayer(id, reviveMode, intensity, bakeLayer);
                    }}
                  >
                    <Sparkles size={15} />
                    {busy && aiStatus.action === 'revive' ? 'Reviving…' : 'Revive photo'}
                  </button>
                </section>
              )}

              {localRecipe === 'cleanup' && (
                <section className="lab-card">
                  <div className="lab-card-head">
                    <div>
                      <h3>Photo Cleanup</h3>
                      <p>Denoise, speckles, and soft edge restore.</p>
                    </div>
                    <span className="lab-badge">Local</span>
                  </div>

                  <div className="lab-seg lab-seg--3">
                    {CLEANUP_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.blurb}
                        onClick={() => setCleanupMode(m.id)}
                        className={cleanupMode === m.id ? 'on' : ''}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {activeCleanup && <p className="lab-hint">{activeCleanup.blurb}</p>}

                  <label className="lab-slider">
                    <span>
                      Intensity
                      <em>{Math.round(cleanupIntensity * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min={0.25}
                      max={1}
                      step={0.05}
                      value={cleanupIntensity}
                      onChange={(e) => setCleanupIntensity(Number(e.target.value))}
                    />
                  </label>

                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={cleanupBake}
                      onChange={(e) => setCleanupBake(e.target.checked)}
                    />
                    <Layers size={12} />
                    Bake as new layer
                  </label>

                  <button
                    type="button"
                    disabled={busy || !hasImage}
                    className="lab-cta lab-cta--quiet"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) {
                        cleanPhotoLayer(id, cleanupMode, cleanupIntensity, cleanupBake);
                      }
                    }}
                  >
                    <Eraser size={15} />
                    {busy && aiStatus.action === 'cleanup' ? 'Cleaning…' : 'Clean photo'}
                  </button>
                </section>
              )}

              {localRecipe === 'relight' && (
                <section className="lab-card lab-card--hero">
                  <div className="lab-card-head">
                    <div>
                      <h3>Studio Relight</h3>
                      <p>Softbox, rim, or golden hour — local light map bake.</p>
                    </div>
                    <span className="lab-badge lab-badge--accent">Local</span>
                  </div>

                  <div className="lab-seg lab-seg--3">
                    {RELIGHT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.blurb}
                        onClick={() => setRelightMode(m.id)}
                        className={relightMode === m.id ? 'on' : ''}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {activeRelight && <p className="lab-hint">{activeRelight.blurb}</p>}

                  <label className="lab-slider">
                    <span>
                      Intensity
                      <em>{Math.round(relightIntensity * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min={0.25}
                      max={1}
                      step={0.05}
                      value={relightIntensity}
                      onChange={(e) => setRelightIntensity(Number(e.target.value))}
                    />
                  </label>

                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={relightBake}
                      onChange={(e) => setRelightBake(e.target.checked)}
                    />
                    <Layers size={12} />
                    Bake as new layer
                  </label>

                  <button
                    type="button"
                    disabled={busy || !hasImage}
                    className="lab-cta"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) relightPhotoLayer(id, relightMode, relightIntensity, relightBake);
                    }}
                  >
                    <Lightbulb size={15} />
                    {busy && aiStatus.action === 'relight' ? 'Relighting…' : 'Apply relight'}
                  </button>

                  <button
                    type="button"
                    disabled={busy || !hasImage}
                    className="lab-ghost-btn"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) {
                        runCloudAiJob(id, 'relight', {
                          relight: relightMode,
                          intensity: relightIntensity,
                        });
                      }
                    }}
                  >
                    <Cloud size={13} />
                    Cloud relight (Replicate)
                  </button>
                </section>
              )}

              {localRecipe === 'portrait' && (
                <section className="lab-card">
                  <div className="lab-card-head">
                    <div>
                      <h3>Portrait Polish</h3>
                      <p>Skin smooth with texture kept — not plastic.</p>
                    </div>
                    <span className="lab-badge">Local</span>
                  </div>

                  <div className="lab-seg lab-seg--3">
                    {PORTRAIT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.blurb}
                        onClick={() => setPortraitMode(m.id)}
                        className={portraitMode === m.id ? 'on' : ''}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {activePortrait && <p className="lab-hint">{activePortrait.blurb}</p>}

                  <label className="lab-slider">
                    <span>
                      Intensity
                      <em>{Math.round(portraitIntensity * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min={0.25}
                      max={1}
                      step={0.05}
                      value={portraitIntensity}
                      onChange={(e) => setPortraitIntensity(Number(e.target.value))}
                    />
                  </label>

                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={portraitBake}
                      onChange={(e) => setPortraitBake(e.target.checked)}
                    />
                    <Layers size={12} />
                    Bake as new layer
                  </label>

                  <button
                    type="button"
                    disabled={busy || !hasImage}
                    className="lab-cta lab-cta--quiet"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) {
                        polishPortraitLayer(id, portraitMode, portraitIntensity, portraitBake);
                      }
                    }}
                  >
                    <Smile size={15} />
                    {busy && aiStatus.action === 'portrait-polish'
                      ? 'Polishing…'
                      : 'Polish portrait'}
                  </button>
                </section>
              )}

              {localRecipe === 'clarity' && (
                <section className="lab-card lab-card--hero">
                  <div className="lab-card-head">
                    <div>
                      <h3>Clarity / Dehaze</h3>
                      <p>Local midtone snap for haze and flat phone shots.</p>
                    </div>
                    <span className="lab-badge lab-badge--accent">Local</span>
                  </div>
                  <div className="lab-seg lab-seg--3">
                    {CLARITY_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.blurb}
                        onClick={() => setClarityMode(m.id)}
                        className={clarityMode === m.id ? 'on' : ''}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {activeClarity && <p className="lab-hint">{activeClarity.blurb}</p>}
                  <label className="lab-slider">
                    <span>
                      Intensity
                      <em>{Math.round(clarityIntensity * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min={0.25}
                      max={1}
                      step={0.05}
                      value={clarityIntensity}
                      onChange={(e) => setClarityIntensity(Number(e.target.value))}
                    />
                  </label>
                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={clarityBake}
                      onChange={(e) => setClarityBake(e.target.checked)}
                    />
                    <Layers size={12} />
                    Bake as new layer
                  </label>
                  <button
                    type="button"
                    disabled={busy || !hasImage}
                    className="lab-cta"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) clarityPhotoLayer(id, clarityMode, clarityIntensity, clarityBake);
                    }}
                  >
                    <Aperture size={15} />
                    {busy && aiStatus.action === 'clarity' ? 'Working…' : `Apply ${activeClarity?.label ?? 'Clarity'}`}
                  </button>
                </section>
              )}

              {localRecipe === 'match' && (
                <section className="lab-card">
                  <div className="lab-card-head">
                    <div>
                      <h3>Color Match</h3>
                      <p>Transfer tone / grade from a reference photo.</p>
                    </div>
                    <span className="lab-badge">Local</span>
                  </div>
                  <label className="lab-ghost-btn" style={{ cursor: 'pointer' }}>
                    <Blend size={13} />
                    {matchRefName ? matchRefName : 'Upload reference…'}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute opacity-0 w-0 h-0 overflow-hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const loaded = await loadImageFiles([file]);
                        if (loaded[0]) {
                          setMatchRefSrc(loaded[0].src);
                          setMatchRefName(loaded[0].name);
                        }
                      }}
                    />
                  </label>
                  {matchRefSrc && (
                    <img
                      src={matchRefSrc}
                      alt="Reference"
                      className="w-full h-20 object-cover rounded-[var(--radius-sm)] border border-[var(--border-subtle)]"
                    />
                  )}
                  <label className="lab-slider">
                    <span>
                      Strength
                      <em>{Math.round(matchIntensity * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={matchIntensity}
                      onChange={(e) => setMatchIntensity(Number(e.target.value))}
                    />
                  </label>
                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={matchBake}
                      onChange={(e) => setMatchBake(e.target.checked)}
                    />
                    <Layers size={12} />
                    Bake as new layer
                  </label>
                  <button
                    type="button"
                    disabled={busy || !hasImage || !matchRefSrc}
                    className="lab-cta lab-cta--quiet"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id && matchRefSrc) {
                        colorMatchLayer(id, matchRefSrc, matchIntensity, matchBake);
                      }
                    }}
                  >
                    <Blend size={15} />
                    {busy && aiStatus.action === 'color-match' ? 'Matching…' : 'Match grade'}
                  </button>
                </section>
              )}

              <section className="lab-card lab-card--compact">
                <div className="lab-card-head">
                  <div>
                    <h3 className="flex items-center gap-1.5">
                      <Layers2 size={14} className="text-[var(--accent-hot)]" />
                      Batch Lab
                    </h3>
                    <p>Run recipes on all {imageLayerCount} image layer{imageLayerCount === 1 ? '' : 's'}.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={batchRevive}
                      onChange={(e) => setBatchRevive(e.target.checked)}
                    />
                    Revive
                  </label>
                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={batchCleanup}
                      onChange={(e) => setBatchCleanup(e.target.checked)}
                    />
                    Cleanup
                  </label>
                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={batchCutout}
                      onChange={(e) => setBatchCutout(e.target.checked)}
                    />
                    Cutout
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || imageLayerCount === 0 || (!batchRevive && !batchCleanup && !batchCutout)}
                  className="lab-ghost-btn"
                  onClick={() =>
                    void runBatchLab({
                      revive: batchRevive,
                      cleanup: batchCleanup,
                      cutout: batchCutout,
                      reviveMode,
                      cleanupMode,
                      cutoutProvider: provider,
                    })
                  }
                >
                  <Layers2 size={13} />
                  {busy && aiStatus.action === 'batch'
                    ? 'Batch running…'
                    : `Run on ${imageLayerCount || 0} layers`}
                </button>
              </section>
            </div>
          )}

          {zone === 'cloud' && (
            <div key="cloud" className="lab-zone-body flex flex-col gap-3">
              <section className="lab-card lab-card--hero">
                <div className="lab-card-head">
                  <div>
                    <h3 className="flex items-center gap-1.5">
                      <Trash2 size={14} className="text-[var(--accent-hot)]" />
                      Object Remove
                    </h3>
                    <p>Select tourists, logos, cables — AI fills the hole. No prompt.</p>
                  </div>
                  <span className="lab-badge lab-badge--accent">API</span>
                </div>
                <p className="lab-hint">
                  {marqueeSelection
                    ? 'Selection ready — remove fills that region.'
                    : 'Draw a marquee or lasso over the object first.'}
                </p>
                <button
                  type="button"
                  disabled={busy || !hasImage || !marqueeSelection}
                  className="lab-cta"
                  onClick={() => {
                    const id = resolveImageId();
                    if (id) runCloudAiJob(id, 'object-remove');
                  }}
                >
                  <Trash2 size={15} />
                  {busy && aiStatus.action === 'object-remove'
                    ? 'Removing…'
                    : 'Remove object'}
                </button>
              </section>

              <section className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <h3 className="flex items-center gap-1.5">
                      <Cloud size={14} className="text-[var(--accent-hot)]" />
                      Cloud jobs
                    </h3>
                    <p>Replicate via local API — set token in Keys or env.</p>
                  </div>
                  <span className="lab-badge lab-badge--accent">API</span>
                </div>

                <div className="lab-job-grid">
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
                      type="button"
                      disabled={busy || !hasImage}
                      onClick={() => {
                        const id = resolveImageId();
                        if (id) runCloudAiJob(id, kind, { intensity: 0.7 });
                      }}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <h3>Style transfer</h3>
                    <p>Push the look — Film, Sketch, Anime, and more.</p>
                  </div>
                </div>
                <div className="lab-chips">
                  {CLOUD_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCloudStyle(s.id)}
                      className={cloudStyle === s.id ? 'on' : ''}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || !hasImage}
                  className="lab-cta"
                  onClick={() => {
                    const id = resolveImageId();
                    if (id) {
                      runCloudAiJob(id, 'style', { style: cloudStyle, intensity: 0.65 });
                    }
                  }}
                >
                  <Paintbrush size={14} />
                  Apply {CLOUD_STYLES.find((s) => s.id === cloudStyle)?.label ?? 'style'}
                </button>
              </section>

              <details className="lab-details" open={Boolean(marqueeSelection)}>
                <summary>
                  <span className="flex items-center gap-1.5">
                    <Wand2 size={12} />
                    Inpaint
                  </span>
                  <span className="lab-details-meta">
                    {marqueeSelection ? 'Selection ready' : 'Needs selection'}
                    <ChevronDown size={12} className="lab-chevron" />
                  </span>
                </summary>
                <div className="lab-details-body">
                  <input
                    type="text"
                    placeholder="Optional prompt…"
                    value={inpaintPrompt}
                    onChange={(e) => setInpaintPrompt(e.target.value)}
                    className="lab-input"
                  />
                  <button
                    type="button"
                    disabled={busy || !hasImage || !marqueeSelection}
                    className="lab-cta lab-cta--quiet"
                    onClick={() => {
                      const id = resolveImageId();
                      if (id) {
                        runCloudAiJob(id, 'inpaint', {
                          prompt: inpaintPrompt || undefined,
                        });
                      }
                    }}
                  >
                    Generative fill
                  </button>
                </div>
              </details>

              <section className="lab-card lab-card--compact">
                <button
                  type="button"
                  disabled={busy || !hasImage}
                  className="lab-ghost-btn"
                  onClick={() => {
                    const id = resolveImageId();
                    if (id) runCloudAiJob(id, 'caption');
                  }}
                >
                  <MessageSquareText size={13} />
                  Auto caption
                </button>
                {lastCaption && <p className="lab-caption">{lastCaption}</p>}
              </section>
            </div>
          )}

          {zone === 'extract' && (
            <div key="extract" className="lab-zone-body flex flex-col gap-3">
              <section className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <h3 className="flex items-center gap-1.5">
                      <Scissors size={14} className="text-[var(--accent-hot)]" />
                      Cutout
                    </h3>
                    <p>Subject extract → new transparent layer.</p>
                  </div>
                  <span className="lab-badge">Alpha</span>
                </div>

                <div className="lab-seg lab-seg--2">
                  {(['client', 'remove.bg'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProvider(p)}
                      className={provider === p ? 'on' : ''}
                    >
                      {p === 'client' ? 'WASM' : 'remove.bg'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={busy || !hasImage}
                  className="lab-cta"
                  onClick={() => {
                    const id = resolveImageId();
                    if (id) removeBackground(id, provider);
                  }}
                >
                  <Scissors size={14} />
                  {busy && aiStatus.action === 'remove-bg'
                    ? 'Cutting…'
                    : 'Remove background'}
                </button>

                <div className="lab-refine">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
                      <Brush size={12} className="text-[var(--accent)]" />
                      Edge refine
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTool(activeTool === 'refineBrush' ? 'select' : 'refineBrush')
                      }
                      className={`lab-toggle ${activeTool === 'refineBrush' ? 'on' : ''}`}
                    >
                      {activeTool === 'refineBrush' ? 'On' : 'Off'}
                    </button>
                  </div>
                  {activeTool === 'refineBrush' && (
                    <div className="lab-seg lab-seg--2 mt-2">
                      {(['erase', 'restore'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => updateBrushSettings({ refineMode: mode })}
                          className={`${brushSettings.refineMode === mode ? 'on' : ''} ${
                            brushSettings.refineMode === mode && mode === 'erase'
                              ? 'lab-seg-danger'
                              : ''
                          } ${
                            brushSettings.refineMode === mode && mode === 'restore'
                              ? 'lab-seg-ok'
                              : ''
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <h3 className="flex items-center gap-1.5">
                      <Maximize size={14} className="text-[var(--accent-hot)]" />
                      Super-res
                    </h3>
                    <p>Upscale the selected image layer.</p>
                  </div>
                  <span className="lab-badge">ESRGAN</span>
                </div>

                <div className="lab-seg lab-seg--2">
                  {[2, 4].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setUpscaleFactor(scale)}
                      className={upscaleFactor === scale ? 'on' : ''}
                    >
                      {scale}×
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!isImage || busy}
                  className="lab-cta lab-cta--quiet"
                  onClick={() => {
                    if (selectedLayer) upscaleLayer(selectedLayer.id, upscaleFactor);
                  }}
                >
                  <Sparkles size={14} />
                  Upscale {upscaleFactor}×
                </button>
              </section>

              <section className="lab-card lab-card--hero">
                <div className="lab-card-head">
                  <div>
                    <h3 className="flex items-center gap-1.5">
                      <Expand size={14} className="text-[var(--accent-hot)]" />
                      Outpaint
                    </h3>
                    <p>Expand canvas & fill edges — great after Crop.</p>
                  </div>
                  <span className="lab-badge">Extend</span>
                </div>
                <div className="lab-seg lab-seg--3">
                  {OUTPAINT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.blurb}
                      onClick={() => setOutpaintPreset(p.id)}
                      className={outpaintPreset === p.id ? 'on' : ''}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="lab-check">
                  <input
                    type="checkbox"
                    checked={outpaintCloud}
                    onChange={(e) => setOutpaintCloud(e.target.checked)}
                  />
                  <Cloud size={12} />
                  Cloud generative fill
                </label>
                <button
                  type="button"
                  disabled={busy || !hasImage}
                  className="lab-cta"
                  onClick={() =>
                    void outpaintDocument({
                      preset: outpaintPreset,
                      useCloud: outpaintCloud,
                    })
                  }
                >
                  <Expand size={15} />
                  {busy && aiStatus.action === 'outpaint' ? 'Outpainting…' : 'Expand & fill'}
                </button>
              </section>
            </div>
          )}
        </ViewTransition>

        {busy && (
          <div className="lab-progress">
            <div className="flex justify-between gap-2 text-[11px] font-semibold text-[var(--accent-hot)]">
              <span className="truncate">{aiStatus.statusText}</span>
              <span className="font-mono-ui shrink-0">{aiStatus.progress}%</span>
            </div>
            <div className="lab-progress-track">
              <div
                className="progress-shimmer h-full transition-all duration-300"
                style={{ width: `${aiStatus.progress}%` }}
              />
            </div>
          </div>
        )}

        {aiStatus.error && (
          <div className="lab-error">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{aiStatus.error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
