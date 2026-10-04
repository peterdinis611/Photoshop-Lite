import React, { useEffect, useMemo, useState } from 'react';
import { X, Scaling, Minimize2, Link2, Unlink2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { formatBytes, type ResizeFormat } from '../../utils/resizeImage';

const PRESETS = [
  { id: '100', label: '100%', scale: 1 },
  { id: '75', label: '75%', scale: 0.75 },
  { id: '50', label: '50%', scale: 0.5 },
  { id: '25', label: '25%', scale: 0.25 },
] as const;

export const ImageSizeModal: React.FC = () => {
  const open = useEditorStore((s) => s.isImageSizeModalOpen);
  const setOpen = useEditorStore((s) => s.setImageSizeModalOpen);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const resizeImageLayer = useEditorStore((s) => s.resizeImageLayer);
  const aiStatus = useEditorStore((s) => s.aiStatus);

  const layer = layers.find((l) => l.id === selectedLayerId && l.type === 'image');

  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [lockAspect, setLockAspect] = useState(true);
  const [quality, setQuality] = useState(0.85);
  const [format, setFormat] = useState<ResizeFormat>('image/jpeg');
  const [fitCanvas, setFitCanvas] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspect = layer ? layer.width / Math.max(1, layer.height) : 1;

  useEffect(() => {
    if (!open || !layer) return;
    setWidth(Math.round(layer.width));
    setHeight(Math.round(layer.height));
    setError(null);
  }, [open, layer?.id, layer?.width, layer?.height]);

  const estimate = useMemo(() => {
    const px = width * height;
    const bpp = format === 'image/png' ? 3.2 : format === 'image/webp' ? 0.55 : 0.9 * quality;
    return Math.round(px * bpp);
  }, [width, height, format, quality]);

  if (!open) return null;

  const onWidth = (next: number) => {
    const w = Math.max(1, Math.round(next || 1));
    setWidth(w);
    if (lockAspect) setHeight(Math.max(1, Math.round(w / aspect)));
  };

  const onHeight = (next: number) => {
    const h = Math.max(1, Math.round(next || 1));
    setHeight(h);
    if (lockAspect) setWidth(Math.max(1, Math.round(h * aspect)));
  };

  const applyPreset = (scale: number) => {
    if (!layer) return;
    setWidth(Math.max(1, Math.round(layer.width * scale)));
    setHeight(Math.max(1, Math.round(layer.height * scale)));
  };

  const handleApply = async () => {
    if (!layer) return;
    setBusy(true);
    setError(null);
    try {
      await resizeImageLayer(layer.id, {
        width,
        height,
        format,
        quality,
        resizeCanvas: fitCanvas,
      });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resize failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scaling size={18} className="text-[var(--accent-hot)]" />
            <div>
              <p className="font-display font-bold text-sm text-[var(--text-primary)]">
                Image Size
              </p>
              <p className="font-mono-ui text-[10px] text-[var(--text-faint)]">
                Resize · optimize · shrink
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--text-faint)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs text-[var(--text-muted)]">
          {!layer ? (
            <p className="text-[var(--danger)]">Select an image layer first.</p>
          ) : (
            <>
              <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
                    {layer.name}
                  </p>
                  <p className="font-mono-ui text-[10px] text-[var(--text-faint)] mt-0.5">
                    Current {Math.round(layer.width)} × {Math.round(layer.height)} · canvas{' '}
                    {canvasWidth} × {canvasHeight}
                  </p>
                </div>
                <Minimize2 size={16} className="text-[var(--accent)] shrink-0 mt-0.5" />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-[var(--text-faint)]">Quick scale</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.scale)}
                      className="py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-app)] font-mono-ui text-[11px] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-[var(--text-faint)]">Width</span>
                  <input
                    type="number"
                    min={1}
                    max={8192}
                    value={width}
                    onChange={(e) => onWidth(Number(e.target.value))}
                    className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <button
                  type="button"
                  title={lockAspect ? 'Unlock aspect' : 'Lock aspect'}
                  onClick={() => setLockAspect((v) => !v)}
                  className={`mb-0.5 h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius-sm)] border cursor-pointer ${
                    lockAspect
                      ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)] text-[var(--accent-hot)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-faint)]'
                  }`}
                >
                  {lockAspect ? <Link2 size={14} /> : <Unlink2 size={14} />}
                </button>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-[var(--text-faint)]">Height</span>
                  <input
                    type="number"
                    min={1}
                    max={8192}
                    value={height}
                    onChange={(e) => onHeight(Number(e.target.value))}
                    className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-[var(--text-faint)]">Optimize format</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['image/jpeg', 'JPEG'],
                      ['image/webp', 'WEBP'],
                      ['image/png', 'PNG'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormat(id)}
                      className={`py-1.5 rounded-[var(--radius-sm)] border text-[11px] font-semibold cursor-pointer ${
                        format === id
                          ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-app)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {format !== 'image/png' && (
                <label className="flex flex-col gap-1.5">
                  <span className="flex justify-between font-medium text-[var(--text-faint)]">
                    Quality
                    <em className="not-italic font-mono-ui text-[var(--accent-hot)]">
                      {Math.round(quality * 100)}%
                    </em>
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full cursor-pointer"
                  />
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fitCanvas}
                  onChange={(e) => setFitCanvas(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Also resize canvas to match
              </label>

              <p className="font-mono-ui text-[10px] text-[var(--text-faint)]">
                Est. ~{formatBytes(estimate)} · {width} × {height}px
              </p>

              {error && <p className="text-[var(--danger)]">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!layer || busy || aiStatus.isProcessing}
            onClick={() => void handleApply()}
            className="dock-export !min-h-[34px] disabled:opacity-40"
          >
            <Scaling size={14} />
            {busy ? 'Optimizing…' : 'Apply size'}
          </button>
        </div>
      </div>
    </div>
  );
};
