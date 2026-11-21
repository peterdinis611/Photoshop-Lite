import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderArchive,
  Image as ImageIcon,
  Shapes,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { AssetResponseDto, CatalogItem, CatalogKind } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../store/editorStore';
import { notify } from '../../utils/notify';

type Tab = 'workspace' | CatalogKind;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

const TABS: { id: Tab; label: string; Icon: typeof FolderArchive }[] = [
  { id: 'workspace', label: 'Library', Icon: FolderArchive },
  { id: 'textures', label: 'Textures', Icon: ImageIcon },
  { id: 'placeholders', label: 'Plates', Icon: Sparkles },
  { id: 'avatars', label: 'Marks', Icon: Shapes },
];

export const AssetsPanel: React.FC = () => {
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('workspace');
  const [assets, setAssets] = useState<AssetResponseDto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogSource, setCatalogSource] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async () => {
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

  const refreshCatalog = useCallback(
    async (kind: CatalogKind, q?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await aiApiClient.listCatalog(kind, { q, page: 1 });
        setCatalog(res.items);
        setCatalogSource(res.source);
        if (res.source === 'error') {
          setError('Catalog upstream failed — try again later');
        }
      } catch (e: unknown) {
        setCatalog([]);
        setError(e instanceof Error ? e.message : 'Catalog unavailable — is the API running?');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (tab === 'workspace') {
      void refreshWorkspace();
    } else {
      void refreshCatalog(tab, query);
    }
  }, [tab, refreshWorkspace, refreshCatalog]); // eslint-disable-line react-hooks/exhaustive-deps -- query via Search

  useEffect(() => {
    return () => {
      Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [thumbs]);

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
      notify.success('Uploaded to library', `${list.length} file${list.length === 1 ? '' : 's'}`);
      await refreshWorkspace();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg);
      notify.error('Upload failed', msg);
    }
  };

  const placeWorkspace = async (asset: AssetResponseDto) => {
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
      notify.success('Placed asset', asset.fileName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not place asset';
      setError(msg);
      notify.error('Place failed', msg);
    } finally {
      setBusyId(null);
    }
  };

  const placeCatalog = async (item: CatalogItem) => {
    setBusyId(item.id);
    try {
      // fullUrl is upstream CDN — always proxied through Nest /stock/fetch
      const { dataUrl } = await aiApiClient.fetchCatalogImage(item.fullUrl);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Decode failed'));
        img.src = dataUrl;
      });
      addImageLayer(
        dataUrl,
        item.title,
        img.naturalWidth || item.width || 1024,
        img.naturalHeight || item.height || 1024
      );
      notify.success('Placed from catalog', item.title);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not fetch catalog image';
      setError(msg);
      notify.error('Catalog place failed', msg);
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
      notify.success('Asset removed');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      setError(msg);
      notify.error('Delete failed', msg);
    } finally {
      setBusyId(null);
    }
  };

  const runSearch = () => {
    if (tab === 'workspace') return;
    void refreshCatalog(tab, query);
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
        {tab === 'workspace' && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={11} /> Upload
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="flex gap-1 border-b border-[var(--border-subtle)] px-2 py-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-1 font-mono-ui text-[9px] uppercase tracking-[0.08em] transition-colors ${
                active
                  ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'text-[var(--text-faint)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-muted)]'
              }`}
            >
              <Icon size={11} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {tab !== 'workspace' && (
        <div className="flex gap-1 border-b border-[var(--border-subtle)] px-2 py-1.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch();
            }}
            placeholder={
              tab === 'textures'
                ? 'Search wood, metal, fabric…'
                : tab === 'avatars'
                  ? 'Seed name…'
                  : 'Page via API · Enter to reload'
            }
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={runSearch}
            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            Go
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="py-6 text-center font-mono-ui text-[10px] text-[var(--text-faint)]">
            Loading…
          </p>
        )}
        {error && (
          <p className="mb-2 rounded-[var(--radius-sm)] border border-[rgba(220,80,80,0.3)] px-2 py-1.5 text-[11px] text-[var(--accent-hot)]">
            {error}
          </p>
        )}

        {tab === 'workspace' && !loading && assets.length === 0 && !error && (
          <p className="px-2 py-8 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            Workspace library is empty. Upload here, or browse free Textures / Plates / Marks.
          </p>
        )}

        {tab === 'workspace' && (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((a) => (
              <div
                key={a.id}
                className="group overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
              >
                <button
                  type="button"
                  className="block w-full cursor-pointer"
                  onClick={() => void placeWorkspace(a)}
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
        )}

        {tab !== 'workspace' && !loading && catalog.length === 0 && !error && (
          <p className="px-2 py-8 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            Nothing matched. Try another search.
          </p>
        )}

        {tab !== 'workspace' && (
          <div className="grid grid-cols-2 gap-2">
            {catalog.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busyId === item.id}
                onClick={() => void placeCatalog(item)}
                className="group overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-left transition-colors hover:border-[var(--accent)]/40 disabled:opacity-60"
              >
                <div className="aspect-square bg-[var(--bg-canvas)]">
                  <img
                    src={aiApiClient.catalogMediaUrl(item.thumbUrl)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-1.5 py-1">
                  <p className="truncate text-[10px] text-[var(--text-muted)]">{item.title}</p>
                  {item.author && (
                    <p className="truncate font-mono-ui text-[8px] text-[var(--text-faint)]">
                      {item.author}
                      {item.license ? ` · ${item.license}` : ''}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] px-3 py-1.5 font-mono-ui text-[9px] text-[var(--text-faint)]">
        {tab === 'workspace'
          ? `${assets.length} asset${assets.length === 1 ? '' : 's'} · workspace scoped`
          : `${catalog.length} · ${catalogSource || tab} · via API proxy · click to place`}
      </div>
    </div>
  );
};
