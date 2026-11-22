import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDebouncedCallback, useDebouncedValue } from '@tanstack/react-pacer';
import type { GoogleFontItem } from '@photoshop-lite/shared-types';
import { fetchGoogleFonts, loadGoogleFont } from '../../utils/googleFonts';
import { createFastFuse, fuseSearch } from '../../utils/fuzzySearch';

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

const PANEL_W = 272;
const PANEL_H = 320;

export const FontPicker: React.FC<FontPickerProps> = ({ value, onChange }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, { wait: 80 });
  const [fonts, setFonts] = useState<GoogleFontItem[]>([]);
  const [source, setSource] = useState<'google-api' | 'fallback'>('fallback');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGoogleFonts()
      .then((res) => {
        if (cancelled) return;
        setFonts(res.items);
        setSource(res.source);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!value) return;
    void loadGoogleFont(value);
  }, [value]);

  const placePanel = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - PANEL_W - 8
    );
    const below = r.bottom + 6;
    const above = r.top - PANEL_H - 6;
    const top =
      below + PANEL_H > window.innerHeight - 8 && above > 8 ? above : below;
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePanel();
    const onReposition = () => placePanel();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const t = window.setTimeout(() => {
      window.addEventListener('keydown', onKey);
      window.addEventListener('pointerdown', onPointer, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open]);

  const fuse = useMemo(
    () =>
      createFastFuse(fonts, [
        { name: 'family', weight: 0.75 },
        { name: 'category', weight: 0.25 },
      ]),
    [fonts]
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return fonts.slice(0, 80);
    return fuseSearch(fuse, q, 80);
  }, [fonts, fuse, debouncedQuery]);

  const preloadFont = useDebouncedCallback(
    (family: string) => {
      void loadGoogleFont(family);
    },
    { wait: 100 }
  );

  const pick = async (family: string) => {
    await loadGoogleFont(family);
    onChange(family);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="min-w-[9rem] max-w-[12rem] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] outline-none cursor-pointer text-left truncate hover:border-[var(--accent)]"
        style={{ fontFamily: value }}
        title="Font family"
      >
        {value || 'Font'}
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Font family"
            className="font-picker-portal"
            style={{ top: coords.top, left: coords.left, width: PANEL_W }}
          >
            <div className="font-picker-portal__search">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fonts…"
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              <div className="mt-1 text-[9px] font-mono-ui text-[var(--text-faint)]">
                {loading
                  ? 'Loading catalog…'
                  : `${filtered.length} · ${source === 'google-api' ? 'Google Fonts' : 'fallback'}`}
              </div>
            </div>
            <div className="font-picker-portal__list">
              {filtered.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  role="option"
                  aria-selected={f.family === value}
                  onMouseEnter={() => preloadFont(f.family)}
                  onClick={() => void pick(f.family)}
                  className={`font-picker-portal__item ${
                    f.family === value ? 'font-picker-portal__item--on' : ''
                  }`}
                  style={{ fontFamily: f.family }}
                >
                  <span className="truncate">{f.family}</span>
                  <span className="font-picker-portal__cat">{f.category}</span>
                </button>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="px-3 py-4 text-[11px] text-[var(--text-faint)]">
                  No fonts match
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
