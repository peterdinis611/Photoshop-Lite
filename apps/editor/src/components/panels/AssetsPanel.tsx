import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FolderArchive, Trash2, Upload } from 'lucide-react';
import { aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { AssetResponseDto } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../store/editorStore';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export const AssetsPanel: React.FC = () => {
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<AssetResponseDto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await aiApiClient.listAssets();
      setAssets(list);
      const next: Record<string, string> = {};
      await Promise.all(
        list.slice(0, 24).map(async (a) => {
          try {
            next[a.id] = await aiApiClient.fetchAssetObjectUrl(a.id);
          } catch {
            /* skip thumb */
          }
        })
      );
      setThumbs((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return next;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Assets unavailable — is the API running?');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, [refresh]);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setError(null);
    try {
      for (const file of list) {
        const dataBase64 = await fileToDataUrl(file);
        await aiApiClient.uploadAsset({
          dataBase64,
          fileName: file.name,
          mimeType: file.type || 'image/png',
        });
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const place = async (asset: AssetResponseDto) => {
    setBusyId(asset.id);
    try {
      const url = thumbs[asset.id] || (await aiApiClient.fetchAssetObjectUrl(asset.id));
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Decode failed'));
        img.src = url;
      });
      addImageLayer(url, asset.fileName, img.naturalWidth, img.naturalHeight);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not place asset');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await aiApiClient.deleteAsset(id);
      if (thumbs[id]) URL.revokeObjectURL(thumbs[id]);
      setThumbs((t) => {
        const next = { ...t };
        delete next[id];
        return next;
      });
      setAssets((a) => a.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <FolderArchive size={13} className="text-[var(--accent)]" />
          <span className="font-display text-[12px] font-bold text-[var(--text-primary)]">
            Assets
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={11} /> Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="py-6 text-center font-mono-ui text-[10px] text-[var(--text-faint)]">
            Loading workspace…
          </p>
        )}
        {error && (
          <p className="mb-2 rounded-[var(--radius-sm)] border border-[rgba(220,80,80,0.3)] px-2 py-1.5 text-[11px] text-[var(--accent-hot)]">
            {error}
          </p>
        )}
        {!loading && assets.length === 0 && !error && (
          <p className="px-2 py-8 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            Workspace library is empty. Upload images here to keep project JSON lean.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {assets.map((a) => (
            <div
              key={a.id}
              className="group overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            >
              <button
                type="button"
                className="block w-full cursor-pointer"
                onClick={() => void place(a)}
                disabled={busyId === a.id}
              >
                <div className="aspect-square bg-[var(--bg-canvas)]">
                  {thumbs[a.id] ? (
                    <img src={thumbs[a.id]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-mono-ui text-[9px] text-[var(--text-faint)]">
                      …
                    </div>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1 px-1.5 py-1">
                <p className="min-w-0 flex-1 truncate text-[10px] text-[var(--text-muted)]">
                  {a.fileName}
                </p>
                <button
                  type="button"
                  className="rounded p-0.5 text-[var(--text-faint)] hover:text-[var(--accent-hot)]"
                  aria-label={`Delete ${a.fileName}`}
                  disabled={busyId === a.id}
                  onClick={() => void remove(a.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--border-subtle)] px-3 py-1.5 font-mono-ui text-[9px] text-[var(--text-faint)]">
        {assets.length} asset{assets.length === 1 ? '' : 's'} · workspace scoped
      </div>
    </div>
  );
};
