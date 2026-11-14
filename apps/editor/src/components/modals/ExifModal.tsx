import React from 'react';
import { X, Info } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export const ExifModal: React.FC = () => {
  const open = useEditorStore((s) => s.isExifModalOpen);
  const setOpen = useEditorStore((s) => s.setExifModalOpen);
  const exif = useEditorStore((s) => s.lastExif);

  if (!open || !exif) return null;

  const rows: [string, string][] = [
    ['File', exif.fileName || '—'],
    ['Size', `${exif.width} × ${exif.height} · ${exif.aspectLabel}`],
    ['Megapixels', String(exif.megapixels)],
    ['MIME', exif.mimeType || '—'],
    [
      'Bytes',
      exif.approxBytes != null ? `~${Math.round(exif.approxBytes / 1024)} KB` : '—',
    ],
    ['EXIF present', exif.hasExif ? 'Yes' : 'No (or non-JPEG)'],
    ['Make', exif.make || '—'],
    ['Model', exif.model || '—'],
    ['Date', exif.dateTime || '—'],
    ['Orientation', exif.orientation != null ? String(exif.orientation) : '—'],
    ['Software', exif.software || '—'],
  ];

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-[var(--ink-blue)]" />
            <span className="font-display font-bold text-sm text-[var(--text-primary)]">
              Image info · EXIF
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-1.5">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-3 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-elevated)]"
            >
              <span className="text-[10px] font-mono-ui uppercase tracking-wider text-[var(--text-faint)]">
                {k}
              </span>
              <span className="text-[12px] text-[var(--text-primary)] text-right break-all">
                {v}
              </span>
            </div>
          ))}
          <p className="mt-2 px-2 text-[10px] text-[var(--text-faint)]">
            Client-only parse — no upload. JPEG EXIF tags when present; PNG/WebP show dimensions.
          </p>
        </div>
      </div>
    </div>
  );
};
