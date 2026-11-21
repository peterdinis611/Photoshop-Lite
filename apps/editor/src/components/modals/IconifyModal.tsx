import React, { useCallback, useEffect, useState } from 'react';
import { X, Search, Shapes } from 'pulsoicon-react';
import { useEditorStore } from '../../store/editorStore';

type IconHit = { prefix: string; name: string };

async function searchIcons(query: string): Promise<IconHit[]> {
  const q = query.trim() || 'camera';
  const res = await fetch(
    `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=36`
  );
  if (!res.ok) throw new Error(`Iconify search ${res.status}`);
  const data = (await res.json()) as { icons?: string[] };
  return (data.icons ?? []).map((id) => {
    const [prefix, ...rest] = id.split(':');
    return { prefix, name: rest.join(':') };
  });
}

async function fetchSvgDataUrl(prefix: string, name: string): Promise<string> {
  const res = await fetch(
    `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?height=256`
  );
  if (!res.ok) throw new Error(`Iconify SVG ${res.status}`);
  const svg = await res.text();
  // Tint accents to copper for darkroom feel when stroke is currentColor
  const tinted = svg
    .replace(/currentColor/g, '#d4923a')
    .replace(/fill="black"/gi, 'fill="#d4923a"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
}

export const IconifyModal: React.FC = () => {
  const open = useEditorStore((s) => s.isIconifyModalOpen);
  const setOpen = useEditorStore((s) => s.setIconifyModalOpen);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);

  const [query, setQuery] = useState('camera');
  const [hits, setHits] = useState<IconHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      setHits(await searchIcons(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void runSearch(query), 280);
    return () => clearTimeout(t);
  }, [open, query, runSearch]);

  if (!open) return null;

  const place = async (hit: IconHit) => {
    const id = `${hit.prefix}:${hit.name}`;
    setPlacing(id);
    try {
      const src = await fetchSvgDataUrl(hit.prefix, hit.name);
      addImageLayer(src, `${hit.prefix}-${hit.name}`);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Place failed');
    } finally {
      setPlacing(null);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div
        className="modal-card bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Iconify icons"
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Shapes size={18} className="text-[var(--accent)] shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-[var(--text-primary)]">
                Iconify icons
              </p>
              <p className="font-mono-ui text-[9px] text-[var(--text-faint)] truncate">
                Place SVG as image layer · free sets via Iconify API
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              aria-hidden
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              aria-label="Search icons"
              className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] pl-8 pr-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="text-center text-[12px] text-[var(--text-faint)] py-10">Searching…</p>
          )}
          {error && !loading && (
            <p className="text-center text-[12px] text-[var(--danger)] py-6">{error}</p>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {hits.map((hit) => {
              const id = `${hit.prefix}:${hit.name}`;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={placing === id}
                  onClick={() => void place(hit)}
                  title={id}
                  aria-label={`Place ${id}`}
                  className="aspect-square rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1 p-2 cursor-pointer disabled:opacity-50"
                >
                  <img
                    src={`https://api.iconify.design/${hit.prefix}/${hit.name}.svg?height=40&color=%23d4923a`}
                    alt=""
                    className="w-8 h-8"
                    loading="lazy"
                  />
                  <span className="text-[8px] font-mono-ui text-[var(--text-faint)] truncate w-full text-center">
                    {hit.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
