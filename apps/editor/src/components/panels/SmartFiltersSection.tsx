import React from 'react';
import { Filter, Eye, EyeOff, Trash2 } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import type { ImageLayer, SmartFilter } from '../../types/editor';

export const SmartFiltersSection: React.FC = () => {
  const layers = useEditorStore((s) => s.layers);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const commitHistory = useEditorStore((s) => s.commitHistory);
  const rebakeSmartFilters = useEditorStore((s) => s.rebakeSmartFilters);

  const layer = layers.find((l) => l.id === selectedLayerId);
  if (!layer || layer.type !== 'image' || !layer.smartObject) return null;

  const filters = layer.smartFilters || [];

  const patch = (next: SmartFilter[]) => {
    commitHistory('Smart Filters');
    updateLayer(layer.id, { smartFilters: next } as Partial<ImageLayer>);
    void rebakeSmartFilters(layer.id);
  };

  return (
    <div className="border-t border-[var(--border-subtle)] p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        <Filter size={11} className="text-[var(--accent-hot)]" />
        Smart Filters
      </div>
      {filters.length === 0 ? (
        <p className="text-[10px] text-[var(--text-faint)]">
          Apply Filter → Classic on this smart object to stack non-destructive filters.
        </p>
      ) : (
        filters.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px]"
          >
            <span className="flex-1 truncate text-[var(--text-muted)]">{f.kind}</span>
            <button
              type="button"
              title={f.enabled ? 'Disable' : 'Enable'}
              className="p-0.5 cursor-pointer text-[var(--text-faint)] hover:text-[var(--text-primary)]"
              onClick={() =>
                patch(
                  filters.map((x) =>
                    x.id === f.id ? { ...x, enabled: !x.enabled } : x
                  )
                )
              }
            >
              {f.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              title="Remove"
              className="p-0.5 cursor-pointer text-[var(--text-faint)] hover:text-[var(--danger,#c45)]"
              onClick={() => patch(filters.filter((x) => x.id !== f.id))}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  );
};
