import React, { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import { ImagePlus, Upload, Layers } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import {
  collectImageFiles,
  dragEventHasFiles,
  loadImageFiles,
} from '../../utils/loadImageFiles';

interface CanvasDropZoneProps {
  onImagesAdded?: () => void;
}

export const CanvasDropZone: React.FC<CanvasDropZoneProps> = ({ onImagesAdded }) => {
  const layersCount = useEditorStore((s) => s.layers.length);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = layersCount === 0;

  const importFiles = useEffectEvent(async (files: File[]) => {
    const images = collectImageFiles(files);
    if (images.length === 0) {
      setError('Drop PNG, JPEG, WEBP, or GIF files');
      window.setTimeout(() => setError(null), 2800);
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const loaded = await loadImageFiles(images);
      if (loaded.length === 0) {
        setError('Could not read those images');
        window.setTimeout(() => setError(null), 2800);
        return;
      }

      startTransition(() => {
        for (const img of loaded) {
          addImageLayer(img.src, img.name, img.width, img.height);
        }
      });
      window.setTimeout(() => onImagesAdded?.(), 120);
    } finally {
      setIsImporting(false);
      setIsDragging(false);
      dragDepthRef.current = 0;
    }
  });

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

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) void importFiles(Array.from(files));
    e.target.value = '';
  };

  const showEmpty = isEmpty && !isDragging;
  const showOverlay = isDragging || isImporting;

  if (!showEmpty && !showOverlay && !error) return null;

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
        accept="image/*"
        multiple
        className="hidden"
        onChange={onBrowse}
      />

      {showEmpty && (
        <div className="drop-empty relative w-[min(420px,88%)] select-none">
          <div className="drop-empty-frame" aria-hidden />
          <div className="drop-empty-marks" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="relative px-8 py-10 text-center">
            <div className="drop-empty-icon mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent)] shadow-[0_0_28px_var(--accent-glow)]">
              <ImagePlus size={26} strokeWidth={1.8} />
            </div>

            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--accent-hot)]">
              Empty stage
            </p>
            <h2 className="mt-2 font-display text-[1.55rem] font-extrabold tracking-tight text-[var(--text-primary)]">
              Drop images here
            </h2>
            <p className="mx-auto mt-2 max-w-[28ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
              Drag photos onto the canvas, or browse from disk. PNG, JPEG, WEBP, GIF — multiple at once.
            </p>

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
                onClick={() => useEditorStore.getState().setNewCanvasModalOpen(true)}
              >
                <Layers size={14} />
                New canvas
              </button>
            </div>

            <p className="mt-5 font-mono-ui text-[10px] text-[var(--text-faint)]">
              Tip · File → Open Image · samples still in the menu
            </p>
          </div>
        </div>
      )}

      {showOverlay && (
        <div
          className={`drop-active-veil absolute inset-0 flex items-center justify-center ${
            isImporting ? 'drop-active-veil--busy' : ''
          }`}
        >
          <div className="drop-active-card">
            <div className="drop-active-ring" aria-hidden />
            <Upload
              size={28}
              strokeWidth={1.8}
              className={`text-[var(--accent)] ${isImporting ? 'animate-pulse' : ''}`}
            />
            <p className="mt-3 font-display text-lg font-bold text-[var(--text-primary)]">
              {isImporting ? 'Developing…' : 'Release to add layers'}
            </p>
            <p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-[var(--accent-hot)]">
              {isImporting ? 'Importing plates' : 'Darkroom intake'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-[var(--radius-sm)] border border-[var(--danger)]/50 bg-red-950/90 px-3 py-2 text-[12px] text-red-100 shadow-xl">
          {error}
        </div>
      )}
    </div>
  );
};
