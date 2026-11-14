import React, { useState } from 'react';
import { Circle, Film, Play, Square, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export const ActionsPanel: React.FC = () => {
  const {
    actions,
    isRecordingAction,
    recordingSteps,
    startRecordingAction,
    stopRecordingAction,
    playAction,
    deleteAction,
  } = useEditorStore();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handleStop = () => {
    const suggested = `Action ${actions.length + 1}`;
    const name = window.prompt('Name this action', suggested);
    // Cancel keeps recording so steps aren't lost by accident.
    if (name === null) return;
    stopRecordingAction(name);
  };

  const handlePlay = async (id: string) => {
    setPlayingId(id);
    try {
      await playAction(id);
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] select-none text-xs animate-panel-in">
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-display font-bold text-[var(--text-primary)] text-[12px]">
          <Film size={14} className="text-[var(--accent-hot)]" />
          <span>Actions</span>
        </div>

        {isRecordingAction ? (
          <button
            type="button"
            data-testid="actions-stop"
            onClick={handleStop}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[#1a1208] font-semibold text-[11px] cursor-pointer"
          >
            <Square size={10} fill="currentColor" /> Stop &amp; Save
          </button>
        ) : (
          <button
            type="button"
            data-testid="actions-record"
            onClick={startRecordingAction}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50 font-medium text-[11px] cursor-pointer"
          >
            <Circle size={10} className="text-[var(--danger)]" fill="currentColor" /> Record
          </button>
        )}
      </div>

      {isRecordingAction && (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/60">
          <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono-ui uppercase tracking-wide text-[var(--accent-hot)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
            Recording · {recordingSteps.length} {recordingSteps.length === 1 ? 'step' : 'steps'}
          </div>
          <ol className="px-3 pb-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {recordingSteps.length === 0 ? (
              <li className="text-[var(--text-faint)] italic">
                Run Revive, Cleanup, filters or Compress on an image…
              </li>
            ) : (
              recordingSteps.map((step, i) => (
                <li
                  key={step.id}
                  className="flex items-center gap-2 text-[var(--text-muted)] truncate"
                >
                  <span className="font-mono-ui text-[10px] text-[var(--text-faint)] w-4 shrink-0">
                    {i + 1}
                  </span>
                  <span className="truncate">{step.label}</span>
                </li>
              ))
            )}
          </ol>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-[var(--text-faint)] text-center px-4">
            No actions yet. Press Record, edit an image, then Stop &amp; Save.
          </div>
        ) : (
          actions.map((action) => (
            <div
              key={action.id}
              data-testid={`action-${action.id}`}
              className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex flex-col">
                <span className="truncate font-medium text-[11px] text-[var(--text-primary)]">
                  {action.name}
                </span>
                <span className="text-[9px] font-mono-ui uppercase tracking-wide text-[var(--text-faint)]">
                  {action.steps.length} {action.steps.length === 1 ? 'step' : 'steps'}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  title="Play on selected image"
                  disabled={isRecordingAction || playingId !== null}
                  onClick={() => void handlePlay(action.id)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--accent-hot)] hover:bg-[var(--bg-app)] disabled:opacity-30 cursor-pointer"
                >
                  <Play size={12} fill={playingId === action.id ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  title="Delete action"
                  disabled={playingId === action.id}
                  onClick={() => deleteAction(action.id)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--bg-app)] disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-faint)] font-mono-ui text-center">
        {actions.length} {actions.length === 1 ? 'action' : 'actions'}
      </div>
    </div>
  );
};
