import React, { useMemo } from 'react';
import { Keyboard, X } from 'lucide-react';
import { formatForDisplay, useHotkeyRegistrations } from '@tanstack/react-hotkeys';
import { useEditorStore } from '../../store/editorStore';

export const ShortcutsModal: React.FC = () => {
  const open = useEditorStore((s) => s.isShortcutsModalOpen);
  const setOpen = useEditorStore((s) => s.setShortcutsModalOpen);
  const { hotkeys } = useHotkeyRegistrations();

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; keys: string; description?: string }[]>();
    for (const reg of hotkeys) {
      const meta = reg.options.meta;
      if (!meta?.name) continue;
      const group = meta.group || 'Other';
      const list = map.get(group) || [];
      const keys = formatForDisplay(reg.hotkey, { useSymbols: true });
      const label = Array.isArray(keys) ? keys.join('') : keys;
      if (list.some((item) => item.name === meta.name && item.keys === label)) continue;
      list.push({
        name: meta.name,
        keys: label,
        description: meta.description,
      });
      map.set(group, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [hotkeys]);

  if (!open) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-2xl max-h-[80vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--accent)]" />
            <span className="font-display font-bold text-sm">Keyboard Shortcuts</span>
            <span className="text-[10px] font-mono-ui text-[var(--text-faint)]">TanStack Hotkeys</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--text-faint)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto grid sm:grid-cols-2 gap-4">
          {groups.map(([group, items]) => (
            <section key={group}>
              <h3 className="text-[10px] font-mono-ui uppercase tracking-[0.08em] text-[var(--text-faint)] mb-2">
                {group}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li
                    key={`${group}-${item.name}-${item.keys}`}
                    className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-elevated)]"
                  >
                    <span className="text-[12px] text-[var(--text-muted)] truncate">{item.name}</span>
                    <kbd className="shrink-0 text-[11px] font-mono-ui text-[var(--accent-hot)] bg-[var(--bg-app)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">
                      {item.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && (
            <p className="text-[12px] text-[var(--text-faint)] col-span-2">No shortcuts registered yet.</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-faint)] font-mono-ui">
          Press <kbd className="text-[var(--accent)]">⌘/</kbd> or <kbd className="text-[var(--accent)]">?</kbd> anytime
        </div>
      </div>
    </div>
  );
};
