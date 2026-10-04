import React, { useEffect, useMemo, useState } from 'react';
import { useDebouncedCallback, useDebouncedValue } from '@tanstack/react-pacer';
import type { GoogleFontItem } from '@photoshop-lite/shared-types';
import { fetchGoogleFonts, loadGoogleFont } from '../../utils/googleFonts';

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export const FontPicker: React.FC<FontPickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, { wait: 180 });
  const [fonts, setFonts] = useState<GoogleFontItem[]>([]);
  const [source, setSource] = useState<'google-api' | 'fallback'>('fallback');
  const [loading, setLoading] = useState(false);

  const searchRemote = useDebouncedCallback(
    (q: string) => {
      setLoading(true);
      fetchGoogleFonts(q)
        .then((res) => {
          setFonts(res.items);
          setSource(res.source);
        })
        .finally(() => setLoading(false));
    },
    { wait: 280 }
  );

  useEffect(() => {
    searchRemote('');
  }, [searchRemote]);

  useEffect(() => {
    if (!open) return;
    searchRemote(debouncedQuery.trim());
  }, [debouncedQuery, open, searchRemote]);

  useEffect(() => {
    if (!value) return;
    void loadGoogleFont(value);
  }, [value]);

  const preloadFont = useDebouncedCallback(
    (family: string) => {
      void loadGoogleFont(family);
    },
    { wait: 100 }
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return fonts.slice(0, 80);
    return fonts.filter((f) => f.family.toLowerCase().includes(q)).slice(0, 80);
  }, [fonts, debouncedQuery]);

  const pick = async (family: string) => {
    await loadGoogleFont(family);
    onChange(family);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-w-[9rem] max-w-[12rem] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] outline-none cursor-pointer text-left truncate hover:border-[var(--accent)]"
        style={{ fontFamily: value }}
        title="Font family"
      >
        {value || 'Font'}
      </button>

      {open && (
        <div className="menu-flyout absolute top-full left-0 mt-1 w-64 max-h-72 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Google Fonts…"
              className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-1 text-[9px] font-mono-ui text-[var(--text-faint)]">
              {loading
                ? 'Searching…'
                : `${filtered.length} fonts · ${source === 'google-api' ? 'Google API' : 'fallback'} · Pacer`}
            </div>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {filtered.map((f) => (
              <button
                key={f.family}
                type="button"
                onMouseEnter={() => preloadFont(f.family)}
                onClick={() => pick(f.family)}
                className={`w-full text-left px-3 py-1.5 text-[12px] cursor-pointer flex items-center justify-between gap-2 ${
                  f.family === value
                    ? 'bg-[var(--accent)] text-[#1a1208]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
                style={{ fontFamily: f.family }}
              >
                <span className="truncate">{f.family}</span>
                <span className="text-[9px] font-mono-ui opacity-60 shrink-0">{f.category}</span>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-[var(--text-faint)]">No fonts match</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
