import React, { useRef, useState, useEffect, useCallback } from 'react';
import { loadKonvaImage } from '@photoshop-lite/editor-konva';
import { useEditorStore } from '../../store/editorStore';
import { GitCompare, X } from 'pulsoicon-react';

interface BeforeAfterSliderProps {
  onClose: () => void;
}

function paintCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  size = 16
) {
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? '#303030' : '#404040';
      ctx.fillRect(x, y, size, size);
    }
  }
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ onClose }) => {
  const { layers, canvasWidth, canvasHeight, backgroundColor } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);
  const sliderXRef = useRef(50);
  const [sliderX, setSliderX] = useState(50);
  const draggingRef = useRef(false);
  const rafRef = useRef(0);

  const renderCanvas = useCallback(
    async (canvas: HTMLCanvasElement, useOriginal: boolean) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else {
        paintCheckerboard(ctx, canvasWidth, canvasHeight);
      }

      // Prefetch all image srcs through the shared cache (deduped).
      const jobs = layers
        .filter((l) => l.visible && l.type === 'image')
        .map(async (layer) => {
          if (layer.type !== 'image') return null;
          const src = useOriginal ? layer.originalSrc || layer.src : layer.src;
          const img = await loadKonvaImage(src);
          return { layer, img };
        });

      const loaded = await Promise.all(jobs);

      for (const item of loaded) {
        if (!item?.img) continue;
        const { layer, img } = item;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
        ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.scale(layer.scaleX, layer.scaleY);
        ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
        ctx.restore();
      }
    },
    [layers, canvasWidth, canvasHeight, backgroundColor]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (beforeCanvasRef.current && !cancelled) {
        await renderCanvas(beforeCanvasRef.current, true);
      }
      if (afterCanvasRef.current && !cancelled) {
        await renderCanvas(afterCanvasRef.current, false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [renderCanvas]);

  const updateSliderFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = (x / rect.width) * 100;
    sliderXRef.current = pct;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setSliderX(sliderXRef.current);
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateSliderFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateSliderFromClientX(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const viewW = Math.min(canvasWidth, 900);
  const viewH = Math.min(canvasHeight * (viewW / canvasWidth), 600);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-2xl"
        style={{ maxWidth: '90vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Before after comparison"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)] px-4 py-3">
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-[var(--text-primary)]">
            <GitCompare size={16} className="text-[var(--accent)]" aria-hidden />
            Before / After
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Close comparison"
          >
            <X size={16} />
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative touch-none select-none overflow-hidden"
          style={{ width: viewW, height: viewH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas
            ref={beforeCanvasRef}
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: 'contain' }}
          />

          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}
          >
            <canvas
              ref={afterCanvasRef}
              className="h-full w-full"
              style={{ objectFit: 'contain' }}
            />
          </div>

          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-[var(--text-primary)] shadow-[0_0_8px_rgba(255,255,255,0.55)]"
            style={{ left: `${sliderX}%` }}
          />

          <div
            className="absolute top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
            style={{ left: `${sliderX}%` }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--text-primary)] shadow-xl">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M5 9H13M5 9L3 7M5 9L3 11M13 9L15 7M13 9L15 11"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="absolute top-3 left-3 z-10 rounded-[var(--radius-sm)] bg-black/60 px-2 py-1 font-mono-ui text-[10px] font-bold tracking-wider text-[var(--text-muted)] backdrop-blur-sm select-none">
            BEFORE
          </div>
          <div className="absolute top-3 right-3 z-10 rounded-[var(--radius-sm)] bg-black/60 px-2 py-1 font-mono-ui text-[10px] font-bold tracking-wider text-[var(--accent)] backdrop-blur-sm select-none">
            AFTER
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-center text-[11px] text-[var(--text-muted)]">
          Drag the divider to compare original vs. edited. Click outside to close.
        </div>
      </div>
    </div>
  );
};
