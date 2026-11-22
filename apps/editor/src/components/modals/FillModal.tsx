import React, { useState } from 'react';
import { X, PaintBucket, Sparkles } from 'pulsoicon-react';
import { fillImageRect } from '@photoshop-lite/editor-core';
import { useEditorStore } from '../../store/editorStore';
import { notify } from '../../utils/notify';

type FillContents = 'foreground' | 'background' | 'black' | 'white' | 'content-aware';

export const FillModal: React.FC = () => {
  const open = useEditorStore((s) => s.isFillModalOpen);
  const setOpen = useEditorStore((s) => s.setFillModalOpen);
  const brushColor = useEditorStore((s) => s.brushSettings.color);
  const secondaryColor = useEditorStore((s) => s.secondaryColor);
  const marqueeSelection = useEditorStore((s) => s.marqueeSelection);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const commitHistory = useEditorStore((s) => s.commitHistory);
  const runCloudAiJob = useEditorStore((s) => s.runCloudAiJob);

  const [contents, setContents] = useState<FillContents>('foreground');
  const [opacity, setOpacity] = useState(100);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const layer = layers.find((l) => l.id === selectedLayerId);
  const canFill = layer?.type === 'image' && Boolean(marqueeSelection);

  const resolveColor = (): string => {
    switch (contents) {
      case 'background':
        return secondaryColor;
      case 'black':
        return '#000000';
      case 'white':
        return '#ffffff';
      default:
        return brushColor;
    }
  };

  const apply = async () => {
    if (!layer || layer.type !== 'image' || !marqueeSelection) {
      notify.error('Select an image layer and a selection first');
      return;
    }
    setBusy(true);
    try {
      if (contents === 'content-aware') {
        await runCloudAiJob(layer.id, 'object-remove');
        setOpen(false);
        return;
      }
      const local = {
        x: marqueeSelection.x - layer.x,
        y: marqueeSelection.y - layer.y,
        width: marqueeSelection.width,
        height: marqueeSelection.height,
      };
      const next = await fillImageRect(layer.src, local, resolveColor(), opacity / 100);
      commitHistory('Fill');
      updateLayer(layer.id, { src: next });
      notify.success('Filled selection');
      setOpen(false);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Fill failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-labelledby="fill-title"
        className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 id="fill-title" className="font-display text-sm font-bold text-[var(--text-primary)]">
            Fill
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 text-xs text-[var(--text-muted)]">
          <label className="flex flex-col gap-1">
            <span className="uppercase tracking-wider text-[10px] text-[var(--text-faint)]">
              Contents
            </span>
            <select
              value={contents}
              onChange={(e) => setContents(e.target.value as FillContents)}
              className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[var(--text-primary)]"
            >
              <option value="foreground">Foreground Color</option>
              <option value="background">Background Color</option>
              <option value="black">Black</option>
              <option value="white">White</option>
              <option value="content-aware">Content-Aware</option>
            </select>
          </label>

          {contents === 'content-aware' ? (
            <p className="flex items-start gap-2 text-[11px] text-[var(--text-faint)]">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--accent-hot)]" />
              Uses cloud object-remove on the current selection (same stack as Neural Lab).
            </p>
          ) : (
            <label className="flex items-center justify-between gap-3">
              <span>Opacity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-28 cursor-pointer"
                />
                <span className="font-mono-ui w-8 text-right">{opacity}%</span>
              </div>
            </label>
          )}

          {!canFill && (
            <p className="text-[11px] text-[var(--danger,#c45)]">
              Need an image layer + active selection (marquee / lasso / wand).
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-[var(--border-subtle)] px-3 py-1.5 text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canFill || busy}
            onClick={() => void apply()}
            className="flex items-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#1a1208] disabled:opacity-40 cursor-pointer"
          >
            <PaintBucket size={13} />
            {busy ? 'Working…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
