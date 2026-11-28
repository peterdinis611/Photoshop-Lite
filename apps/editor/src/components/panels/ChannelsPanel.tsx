import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2, Download, Upload } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';

type ChannelId = 'rgb' | 'red' | 'green' | 'blue' | 'alpha';

export const ChannelsPanel: React.FC = () => {
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const marqueeSelection = useEditorStore((s) => s.marqueeSelection);
  const savedSelections = useEditorStore((s) => s.savedSelections);
  const saveSelectionAsChannel = useEditorStore((s) => s.saveSelectionAsChannel);
  const loadSelectionFromChannel = useEditorStore((s) => s.loadSelectionFromChannel);
  const deleteSavedSelection = useEditorStore((s) => s.deleteSavedSelection);
  const applySelectionToLayerMask = useEditorStore((s) => s.applySelectionToLayerMask);
  const updateLayer = useEditorStore((s) => s.updateLayer);

  const [visible, setVisible] = useState<Record<ChannelId, boolean>>({
    rgb: true,
    red: true,
    green: true,
    blue: true,
    alpha: true,
  });
  const [active, setActive] = useState<ChannelId>('rgb');

  const layer = layers.find((l) => l.id === selectedLayerId);
  const hasAlpha = layer?.type === 'image' && Boolean(layer.hasLayerMask && layer.layerMaskSrc);

  const rows = useMemo(
    () =>
      [
        { id: 'rgb' as const, label: 'RGB', hint: 'Composite' },
        { id: 'red' as const, label: 'Red', hint: 'R' },
        { id: 'green' as const, label: 'Green', hint: 'G' },
        { id: 'blue' as const, label: 'Blue', hint: 'B' },
        { id: 'alpha' as const, label: 'Alpha', hint: hasAlpha ? 'Layer mask' : 'No mask' },
      ] as const,
    [hasAlpha]
  );

  const toggleEye = (id: ChannelId) => {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
    if (layer?.type === 'adjustment') {
      if (id === 'red' || id === 'green' || id === 'blue' || id === 'rgb') {
        updateLayer(layer.id, {
          affectedChannel: id === 'rgb' ? 'rgb' : id,
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] select-none text-xs animate-panel-in">
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)]">
        <div className="font-display font-bold text-[var(--text-primary)] text-[12px]">Channels</div>
        <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
          RGB visibility + Save / Load Selection as alpha.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setActive(row.id)}
            className={`flex items-center gap-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-left cursor-pointer ${
              active === row.id
                ? 'bg-[var(--accent-dim)] border-[var(--accent)]/50 text-[var(--text-primary)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <span
              role="presentation"
              onClick={(e) => {
                e.stopPropagation();
                toggleEye(row.id);
              }}
              className="p-0.5 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
            >
              {visible[row.id] ? <Eye size={12} /> : <EyeOff size={12} />}
            </span>
            <span className="flex-1 font-medium">{row.label}</span>
            <span className="text-[10px] text-[var(--text-faint)]">{row.hint}</span>
          </button>
        ))}

        <div className="mt-3 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Saved selections
            </span>
            <button
              type="button"
              disabled={!marqueeSelection}
              title="Save selection"
              className="p-1 rounded text-[var(--accent-hot)] disabled:opacity-30 cursor-pointer"
              onClick={() => void saveSelectionAsChannel()}
            >
              <Plus size={13} />
            </button>
          </div>
          {savedSelections.length === 0 ? (
            <p className="text-[10px] text-[var(--text-faint)] px-1 py-2">
              Make a selection, then + to save as an alpha channel.
            </p>
          ) : (
            savedSelections.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 mb-1"
              >
                <span className="flex-1 truncate text-[var(--text-muted)]">{ch.name}</span>
                <button
                  type="button"
                  title="Load as selection"
                  className="p-0.5 cursor-pointer text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                  onClick={() => loadSelectionFromChannel(ch.id)}
                >
                  <Upload size={12} />
                </button>
                <button
                  type="button"
                  title="Delete"
                  className="p-0.5 cursor-pointer text-[var(--text-faint)] hover:text-[var(--danger,#c45)]"
                  onClick={() => deleteSavedSelection(ch.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-2 border-t border-[var(--border-subtle)] flex gap-2">
        <button
          type="button"
          disabled={!marqueeSelection || layer?.type !== 'image'}
          onClick={() => void applySelectionToLayerMask()}
          className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1.5 text-[11px] disabled:opacity-40 cursor-pointer hover:border-[var(--accent)]"
        >
          <Download size={12} />
          Selection → Mask
        </button>
      </div>
    </div>
  );
};
