import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import {
  ImagePlus,
  Upload,
  Layers,
  Aperture,
  Type,
  Square,
  ClipboardPaste,
  Images,
} from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { findSampleImage, loadSampleImages, type SampleImage } from '../../assets/loadSampleImages';
import {
  collectImageFiles,
  dragEventHasFiles,
  IMAGE_ACCEPT,
  loadImageFiles,
  type LoadImageProgress,
} from '../../utils/loadImageFiles';

interface CanvasDropZoneProps {
  onImagesAdded?: () => void;
}

const PHASE_LABEL: Record<LoadImageProgress['phase'], string> = {
  read: 'Reading negative',
  decode: 'Exposing plate',
  optimize: 'Reducing grain',
  done: 'Fixed',
  error: 'Skipped frame',
};

const FORMAT_CHIPS = ['PNG', 'JPEG', 'WEBP', 'GIF', 'AVIF', 'HEIC'];

export const CanvasDropZone: React.FC<CanvasDropZoneProps> = ({ onImagesAdded }) => {
  const layersCount = useEditorStore((s) => s.layers.length);
  const isDocumentOpen = useEditorStore((s) => s.isDocumentOpen);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const addTextLayer = useEditorStore((s) => s.addTextLayer);
  const addShapeLayer = useEditorStore((s) => s.addShapeLayer);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setNewCanvasModalOpen = useEditorStore((s) => s.setNewCanvasModalOpen);
  const setStockModalOpen = useEditorStore((s) => s.setStockModalOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<LoadImageProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleImage[]>([]);
  // Blank New Document keeps 0 layers but must hide this overlay
  const isEmpty = !isDocumentOpen && layersCount === 0;

  useEffect(() => {
    if (!isEmpty) return;
    void loadSampleImages().then(setSamples);
  }, [isEmpty]);

  const importFiles = useCallback(
    async (files: File[]) => {
      const images = collectImageFiles(files);
      if (images.length === 0) {
        setError('Drop PNG, JPEG, WEBP, GIF, or AVIF files');
        window.setTimeout(() => setError(null), 2800);
        return;
      }

      setIsImporting(true);
      setError(null);
      setProgress({
        fileName: images[0].name,
        index: 0,
        total: images.length,
        phase: 'read',
        percent: 2,
      });

      try {
        const loaded = await loadImageFiles(images, setProgress);
        if (loaded.length === 0) {
          setError('Could not read those images — try JPEG/PNG/WEBP');
          window.setTimeout(() => setError(null), 3200);
          return;
        }

        startTransition(() => {
          for (const img of loaded) {
            addImageLayer(img.src, img.name, img.width, img.height);
          }
        });
        window.setTimeout(() => onImagesAdded?.(), 140);

        if (loaded.some((img) => img.downscaled)) {
          setError('Very large photo was optimized to fit the browser safely');
          window.setTimeout(() => setError(null), 3600);
        }
      } finally {
        setIsImporting(false);
        setIsDragging(false);
        setProgress(null);
        dragDepthRef.current = 0;
      }
    },
    [addImageLayer, onImagesAdded]
  );

  const pasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const file = new File([blob], `pasted.${type.split('/')[1] || 'png'}`, { type });
        await importFiles([file]);
        return;
      }
      setError('Clipboard has no image — copy a screenshot first');
      window.setTimeout(() => setError(null), 2800);
    } catch {
      setError('Clipboard paste needs permission — use Browse instead');
      window.setTimeout(() => setError(null), 3200);
    }
  }, [importFiles]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!dragEventHasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      if (!dragEventHasFiles(e)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragging(false);
    };

    const onDragOver = (e: DragEvent) => {
      if (!dragEventHasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (e: DragEvent) => {
      if (!dragEventHasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (files?.length) void importFiles(Array.from(files));
    };

    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        void importFiles(files);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [importFiles]);

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) void importFiles(Array.from(files));
    e.target.value = '';
  };

  const loadSample = (id: string) => {
    void findSampleImage(id).then((sample) => {
      if (!sample) return;
      addImageLayer(sample.dataUrl, sample.name, sample.width, sample.height);
      window.setTimeout(() => onImagesAdded?.(), 140);
    });
  };

  const showEmpty = isEmpty && !isDragging && !isImporting;
  const showOverlay = isDragging || isImporting;

  if (!showEmpty && !showOverlay && !error) return null;

  const percent = progress?.percent ?? (isImporting ? 8 : 0);

  return (
    <div
      className={`canvas-drop-root absolute inset-0 z-30 flex items-center justify-center ${
        showEmpty || showOverlay ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      data-testid="canvas-drop-zone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={onBrowse}
      />

      {showEmpty && (
        <div className="drop-empty drop-empty--wide relative select-none">
          <div className="drop-empty-orbit" aria-hidden />
          <div className="drop-empty-frame" aria-hidden />
          <div className="drop-empty-marks" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="relative px-8 py-9 text-center">
            <div className="drop-empty-icon mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent)] shadow-[0_0_28px_var(--accent-glow)]">
              <ImagePlus size={26} strokeWidth={1.8} />
            </div>

            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--accent-hot)]">
              Empty stage
            </p>
            <h2 className="mt-2 font-display text-[1.55rem] font-extrabold tracking-tight text-[var(--text-primary)]">
              Drop images here
            </h2>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
              Large photos welcome — the document sizes to your image. Or start blank and build
              layers.
            </p>

            <div className="drop-format-row">
              {FORMAT_CHIPS.map((f) => (
                <span key={f} className="drop-format-chip">
                  {f}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="dock-export !min-h-[36px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} strokeWidth={2.4} />
                Browse files
              </button>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-toolbar)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
                onClick={() => setNewCanvasModalOpen(true)}
              >
                <Layers size={14} />
                New canvas
              </button>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-toolbar)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
                onClick={() => void pasteFromClipboard()}
              >
                <ClipboardPaste size={14} />
                Paste
              </button>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] border border-[rgba(212,146,58,0.4)] bg-[var(--accent-dim)] px-3 text-[12px] font-medium text-[var(--accent-hot)] hover:brightness-110 cursor-pointer"
                onClick={() => setStockModalOpen(true)}
              >
                <Images size={14} />
                Stock & CC
              </button>
            </div>

            <div className="drop-quick-row">
              <button
                type="button"
                className="drop-quick-btn"
                onClick={() => {
                  addTextLayer();
                  setActiveTool('text');
                }}
              >
                <Type size={13} /> Add text
              </button>
              <button
                type="button"
                className="drop-quick-btn"
                onClick={() => {
                  addShapeLayer('rectangle');
                  setActiveTool('shape');
                }}
              >
                <Square size={13} /> Add shape
              </button>
            </div>

            <div className="drop-samples">
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="drop-sample-card"
                  onClick={() => loadSample(s.id)}
                  title={s.description}
                >
                  <img src={s.dataUrl} alt="" draggable={false} />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>

            <p className="mt-5 font-mono-ui text-[10px] text-[var(--text-faint)]">
              Tip · File → Open Image · paste screenshot · up to ~8K edge
            </p>
          </div>
        </div>
      )}

      {showOverlay && (
        <div
          className={`drop-active-veil absolute inset-0 flex items-center justify-center ${
            isImporting ? 'drop-active-veil--busy' : 'drop-active-veil--armed'
          }`}
        >
          <div className={`drop-active-card ${isImporting ? 'drop-active-card--developing' : ''}`}>
            <div className="drop-active-ring" aria-hidden />
            {isImporting && <div className="drop-scanline" aria-hidden />}
            {isImporting && <div className="drop-grain" aria-hidden />}

            <div className={`drop-active-icon ${isImporting ? 'drop-active-icon--spin' : ''}`}>
              {isImporting ? (
                <Aperture size={28} strokeWidth={1.7} className="text-[var(--accent)]" />
              ) : (
                <Upload size={28} strokeWidth={1.8} className="text-[var(--accent)]" />
              )}
            </div>

            <p className="mt-3 font-display text-lg font-bold text-[var(--text-primary)]">
              {isImporting ? 'Developing…' : 'Release to add layers'}
            </p>
            <p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-[var(--accent-hot)]">
              {isImporting
                ? progress
                  ? PHASE_LABEL[progress.phase]
                  : 'Importing plates'
                : 'Darkroom intake'}
            </p>

            {isImporting && (
              <div className="drop-progress mt-4 w-full">
                <div className="drop-progress-meta">
                  <span className="truncate">
                    {progress
                      ? `${progress.index + 1}/${progress.total} · ${progress.fileName}`
                      : 'Preparing…'}
                  </span>
                  <span className="font-mono-ui tabular-nums">{percent}%</span>
                </div>
                <div className="drop-progress-track">
                  <div
                    className="drop-progress-fill"
                    style={{ width: `${Math.max(4, percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="drop-toast absolute bottom-6 left-1/2 z-40 -translate-x-1/2">
          {error}
        </div>
      )}
    </div>
  );
};
