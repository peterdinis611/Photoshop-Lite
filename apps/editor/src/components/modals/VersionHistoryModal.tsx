import React, { useEffect, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import type { ProjectVersionSummaryDto } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../store/editorStore';

export const VersionHistoryModal: React.FC = () => {
  const isOpen = useEditorStore((s) => s.isVersionHistoryModalOpen);
  const setOpen = useEditorStore((s) => s.setVersionHistoryModalOpen);
  const cloudProjectId = useEditorStore((s) => s.cloudProjectId);
  const listCloudProjectVersions = useEditorStore((s) => s.listCloudProjectVersions);
  const restoreCloudProjectVersion = useEditorStore((s) => s.restoreCloudProjectVersion);

  const [versions, setVersions] = useState<ProjectVersionSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !cloudProjectId) return;
    setLoading(true);
    setError(null);
    listCloudProjectVersions(cloudProjectId)
      .then(setVersions)
      .catch((e: unknown) => {
        setVersions([]);
        setError(e instanceof Error ? e.message : 'Could not load revisions');
      })
      .finally(() => setLoading(false));
  }, [isOpen, cloudProjectId, listCloudProjectVersions]);

  if (!isOpen) return null;

  const restore = async (versionId: string) => {
    if (!cloudProjectId) return;
    if (!window.confirm('Replace the current document with this cloud revision?')) return;
    setRestoringId(versionId);
    try {
      await restoreCloudProjectVersion(cloudProjectId, versionId);
      setOpen(false);
    } catch {
      /* toast via aiStatus */
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="modal-card flex max-h-[80vh] w-[min(520px,92vw)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div>
            <h2 className="font-display text-[15px] font-bold text-[var(--text-primary)]">
              Cloud revisions
            </h2>
            <p className="font-mono-ui text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
              Snapshots on save · restore replaces the open document
            </p>
          </div>
          <button
            type="button"
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!cloudProjectId && (
            <p className="px-2 py-6 text-center text-[12px] text-[var(--text-muted)]">
              Save to Cloud first to keep revisions.
            </p>
          )}
          {cloudProjectId && loading && (
            <p className="px-2 py-6 text-center font-mono-ui text-[11px] text-[var(--text-faint)]">
              Loading plate history…
            </p>
          )}
          {error && (
            <p className="rounded-[var(--radius-sm)] border border-[rgba(220,80,80,0.35)] bg-[rgba(220,80,80,0.08)] px-3 py-2 text-[12px] text-[var(--accent-hot)]">
              {error}
            </p>
          )}
          {cloudProjectId && !loading && versions.length === 0 && !error && (
            <p className="px-2 py-6 text-center text-[12px] text-[var(--text-muted)]">
              No revisions yet — save again to create a snapshot.
            </p>
          )}
          <ul className="space-y-1.5">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2"
              >
                <History size={14} className="shrink-0 text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                    {v.title}
                  </p>
                  <p className="font-mono-ui text-[9px] text-[var(--text-faint)]">
                    {new Date(v.savedAt).toLocaleString()}
                    {v.reason ? ` · ${v.reason}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[rgba(212,146,58,0.4)] bg-[var(--accent-dim)] px-2 py-1 text-[11px] font-medium text-[var(--accent-hot)] hover:brightness-110 disabled:opacity-50"
                  disabled={restoringId === v.id}
                  onClick={() => void restore(v.id)}
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
