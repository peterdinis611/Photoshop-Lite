import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { X, Search, Image as ImageIcon, ExternalLink } from 'pulsoicon-react';
import { aiApiClient } from '@photoshop-lite/editor-ai-client';
import type { StockPhotoItem, StockSearchResponseDto } from '@photoshop-lite/shared-types';
import { useEditorStore } from '../../store/editorStore';
import { createFastFuse, fuseSearch } from '../../utils/fuzzySearch';

const QUICK = ['portrait', 'landscape', 'product', 'city', 'nature', 'abstract'];
const CACHE_CAP = 240;

export const StockPickerModal: React.FC = () => {
  const isOpen = useEditorStore((s) => s.isStockModalOpen);
  const setOpen = useEditorStore((s) => s.setStockModalOpen);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);

  const [query, setQuery] = useState('nature');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StockSearchResponseDto | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  /** Session corpus — Fuse searches this instantly while API is in flight. */
  const cacheRef = useRef<Map<string, StockPhotoItem>>(new Map());
  const [cacheTick, setCacheTick] = useState(0);

  const mergeCache = (items: StockPhotoItem[]) => {
    const map = cacheRef.current;
    for (const item of items) {
      map.set(item.id, item);
    }
    while (map.size > CACHE_CAP) {
      const first = map.keys().next().value;
      if (first == null) break;
      map.delete(first);
    }
    setCacheTick((n) => n + 1);
  };

  const runSearch = useDebouncedCallback(
    (q: string) => {
      setLoading(true);
      setError(null);
      aiApiClient
        .searchStock(q, 1)
        .then((res) => {
          setResult(res);
          mergeCache(res.items);
        })
        .catch((e: unknown) => {
          setResult(null);
          setError(e instanceof Error ? e.message : 'Stock search failed');
        })
        .finally(() => setLoading(false));
    },
    { wait: 380 }
  );

  useEffect(() => {
    if (!isOpen) return;
    runSearch(query);
  }, [isOpen, query, runSearch]);

  const cachedItems = useMemo(() => {
    void cacheTick;
    return Array.from(cacheRef.current.values());
  }, [cacheTick]);

  const fuse = useMemo(
    () =>
      createFastFuse(cachedItems, [
        { name: 'title', weight: 0.55 },
        { name: 'author', weight: 0.2 },
        { name: 'provider', weight: 0.15 },
        { name: 'license', weight: 0.1 },
      ]),
    [cachedItems]
  );

  const apiQuery = result?.query?.trim().toLowerCase() ?? '';
  const qNorm = query.trim().toLowerCase();

  /** Instant Fuse hits from session cache; fall back to latest API page. */
  const displayItems = useMemo(() => {
    if (!qNorm) return result?.items ?? [];
    if (qNorm === apiQuery && result?.items.length) return result.items;
    if (cachedItems.length === 0) return result?.items ?? [];
    const local = fuseSearch(fuse, query, 48);
    if (local.length > 0) return local;
    return result?.items ?? [];
  }, [qNorm, apiQuery, result, cachedItems.length, fuse, query]);

  if (!isOpen) return null;

  const place = async (item: StockPhotoItem) => {
    setPlacingId(item.id);
    setError(null);
    try {
      let dataUrl: string;
      try {
        const proxied = await aiApiClient.fetchStockImage(item.fullUrl);
        dataUrl = proxied.dataUrl;
      } catch {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Could not load remote image'));
          img.src = item.fullUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0);
        dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      }

      const probe = new Image();
      await new Promise<void>((resolve, reject) => {
        probe.onload = () => resolve();
        probe.onerror = () => reject(new Error('Invalid image data'));
        probe.src = dataUrl;
      });

      addImageLayer(
        dataUrl,
        `${item.title} · ${item.author}`,
        probe.naturalWidth || item.width,
        probe.naturalHeight || item.height
      );
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to place image');
    } finally {
      setPlacingId(null);
    }
  };

  const sourceHints = result
    ? Object.entries(result.sources)
        .map(([p, s]) => `${p}:${s}`)
        .join(' · ')
    : '';

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon size={18} className="text-[var(--accent)] shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-[var(--text-primary)]">
                Stock & CC photos
              </p>
              <p className="font-mono-ui text-[9px] text-[var(--text-faint)] truncate">
                Unsplash · Pexels · Openverse · Pixabay
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search photos…"
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] pl-8 pr-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className={`px-2 py-0.5 rounded-full text-[10px] border cursor-pointer capitalize ${
                  query === q
                    ? 'bg-[var(--accent)] text-[#1a1208] border-transparent'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="font-mono-ui text-[9px] text-[var(--text-faint)]">
            {loading ? 'API… · ' : ''}
            {displayItems.length} shown
            {cachedItems.length > 0 ? ` · Fuse cache ${cachedItems.length}` : ''}
            {sourceHints ? ` · ${sourceHints}` : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && displayItems.length === 0 && (
            <p className="text-center text-[12px] text-[var(--text-faint)] py-10">Searching…</p>
          )}
          {error && !loading && displayItems.length === 0 && (
            <p className="text-center text-[12px] text-[var(--danger)] py-6">{error}</p>
          )}
          {!loading && displayItems.length === 0 && !error && (
            <p className="text-center text-[12px] text-[var(--text-faint)] py-10">
              No results — try another query, or set UNSPLASH / PEXELS / PIXABAY keys for more
              sources. Openverse works without a key.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {displayItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={placingId === item.id}
                onClick={() => void place(item)}
                className="group relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-left cursor-pointer hover:border-[var(--accent)] transition-colors disabled:opacity-60"
              >
                <img
                  src={item.thumbUrl}
                  alt=""
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <div className="p-2">
                  <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {item.title}
                  </p>
                  <p className="text-[9px] font-mono-ui text-[var(--text-faint)] truncate">
                    {item.provider} · {item.author}
                    {item.license ? ` · ${item.license}` : ''}
                  </p>
                </div>
                {item.sourcePageUrl && (
                  <a
                    href={item.sourcePageUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100"
                    title="Source"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                {placingId === item.id && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-[11px] text-white">
                    Placing…
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
