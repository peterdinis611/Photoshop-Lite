import React from 'react';
import { History, Undo2, Redo2, Paintbrush } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';
import { notify } from '../../utils/notify';

export const HistoryPanel: React.FC = () => {
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const jumpToHistoryStep = useEditorStore((s) => s.jumpToHistoryStep);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const historyBrushSourceId = useEditorStore((s) => s.historyBrushSourceId);
  const setHistoryBrushSourceId = useEditorStore((s) => s.setHistoryBrushSourceId);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] select-none text-xs animate-panel-in">
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)] flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-display font-bold text-[var(--text-primary)] text-[12px]">
          <History size={14} className="text-[var(--accent-hot)]" />
          <span>History</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={past.length === 0}
            onClick={undo}
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 cursor-pointer"
            title="Undo"
          >
            <Undo2 size={13} />
          </button>
          <button
            disabled={future.length === 0}
            onClick={redo}
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo2 size={13} />
          </button>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-faint)]">
        Brush icon = History Brush source. Default is the latest step.
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {past.length === 0 && future.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-[var(--text-faint)] text-center px-4">
            Edits will appear here as you work.
          </div>
        ) : (
          <>
            {past.map((step, idx) => {
              const isLatest = idx === past.length - 1;
              const isBrushSrc =
                historyBrushSourceId === step.id ||
                (!historyBrushSourceId && isLatest);
              const date = new Date(step.timestamp);
              const timeStr = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={step.id}
                  className={`w-full p-2 rounded-[var(--radius-md)] border transition-all flex items-center justify-between gap-1 ${
                    isLatest
                      ? 'bg-[var(--accent-dim)] border-[var(--accent)]/50 text-[var(--text-primary)] font-medium'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => jumpToHistoryStep(step.id)}
                    className="flex items-center gap-2 truncate min-w-0 flex-1 text-left cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    <span className="text-[10px] font-mono-ui text-[var(--text-faint)] w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="truncate">{step.name}</span>
                  </button>
                  <span className="text-[10px] font-mono-ui text-[var(--text-faint)] shrink-0">
                    {timeStr}
                  </span>
                  <button
                    type="button"
                    title="Use as History Brush source"
                    onClick={() => {
                      setHistoryBrushSourceId(step.id);
                      setActiveTool('historyBrush');
                      notify.success(`History Brush ← ${step.name}`);
                    }}
                    className={`p-1 rounded cursor-pointer shrink-0 ${
                      isBrushSrc
                        ? 'text-[var(--accent-hot)] bg-[var(--accent-dim)]'
                        : 'text-[var(--text-faint)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Paintbrush size={12} />
                  </button>
                </div>
              );
            })}

            {future.map((step, idx) => (
              <div
                key={step.id}
                className="w-full text-left p-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-app)]/40 text-[var(--text-faint)] flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[10px] font-mono-ui">+{idx + 1}</span>
                  <span className="truncate italic">{step.name}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="p-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-faint)] font-mono-ui text-center">
        {past.length} steps · {future.length} redo
      </div>
    </div>
  );
};
