import React, { useState } from 'react';
import { X, Pipette } from 'pulsoicon-react';
import { colorRangeSelect } from '@photoshop-lite/editor-core';
import { useEditorStore } from '../../store/editorStore';
import { notify } from '../../utils/notify';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const ColorRangeModal: React.FC = () => {
  const open = useEditorStore((s) => s.isColorRangeModalOpen);
  const setOpen = useEditorStore((s) => s.setColorRangeModalOpen);
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const brushColor = useEditorStore((s) => s.brushSettings.color);
  const setMarqueeSelection = useEditorStore((s) => s.setMarqueeSelection);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const commitHistory = useEditorStore((s) => s.commitHistory);

  const [sample, setSample] = useState(brushColor);
  const [fuzziness, setFuzziness] = useState(40);
  const [invert, setInvert] = useState(false);
  const [asMask, setAsMask] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const layer = layers.find((l) => l.id === selectedLayerId);
  const canRun = layer?.type === 'image';

  const apply = async () => {
    if (!layer || layer.type !== 'image') {
      notify.error('Select an image layer');
      return;
    }
    setBusy(true);
    try {
      const result = await colorRangeSelect(layer.src, {
        sample: hexToRgb(sample),
        fuzziness,
        invert,
      });
      if (!result.bounds || result.selectedPixelCount === 0) {
        notify.error('No pixels matched — raise Fuzziness');
        return;
      }
      setMarqueeSelection({
        x: layer.x + result.bounds.x,
        y: layer.y + result.bounds.y,
        width: result.bounds.width,
        height: result.bounds.height,
        mode: 'rect',
      });
      if (asMask) {
        commitHistory('Color Range → Mask');
        updateLayer(layer.id, {
          hasLayerMask: true,
          layerMaskSrc: result.maskDataUrl,
        });
      }
      notify.success(`Color Range · ${result.selectedPixelCount} px`);
      setOpen(false);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Color Range failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-labelledby="color-range-title"
        className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h2
            id="color-range-title"
            className="font-display text-sm font-bold text-[var(--text-primary)]"
          >
            Color Range
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
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Pipette size={12} /> Sample
            </span>
            <input
              type="color"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-[var(--border-subtle)] bg-transparent"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Fuzziness</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={200}
                value={fuzziness}
                onChange={(e) => setFuzziness(Number(e.target.value))}
                className="w-28 cursor-pointer"
              />
              <span className="font-mono-ui w-8 text-right">{fuzziness}</span>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
            Invert
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={asMask}
              onChange={(e) => setAsMask(e.target.checked)}
            />
            Also apply as layer mask
          </label>
          {!canRun && (
            <p className="text-[11px] text-[var(--danger,#c45)]">Select an image layer first.</p>
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
            disabled={!canRun || busy}
            onClick={() => void apply()}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#1a1208] disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Selecting…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
