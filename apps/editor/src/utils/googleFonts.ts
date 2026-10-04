import type { GoogleFontItem, GoogleFontsResponseDto } from '@photoshop-lite/shared-types';

const loaded = new Set<string>();

/** Inject a Google Fonts stylesheet and wait until the face is usable. */
export async function loadGoogleFont(family: string, weights = '400;500;600;700'): Promise<void> {
  if (!family || loaded.has(family)) {
    await document.fonts.load(`16px "${family}"`).catch(() => undefined);
    return;
  }

  const id = `gfont-${family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const familyParam = family.replace(/ /g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weights}&display=swap`;
    document.head.appendChild(link);
  }

  loaded.add(family);
  try {
    await document.fonts.load(`16px "${family}"`);
    await document.fonts.ready;
  } catch {
    /* font may still render once CSS loads */
  }
}

export async function fetchGoogleFonts(query?: string): Promise<GoogleFontsResponseDto> {
  const params = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  try {
    const res = await fetch(`/api/fonts${params}`);
    if (!res.ok) throw new Error(`fonts ${res.status}`);
    return (await res.json()) as GoogleFontsResponseDto;
  } catch {
    // Offline / API down — minimal local list
    const items: GoogleFontItem[] = [
      { family: 'Bricolage Grotesque', category: 'sans-serif', variants: ['700'] },
      { family: 'Source Sans 3', category: 'sans-serif', variants: ['400', '700'] },
      { family: 'JetBrains Mono', category: 'monospace', variants: ['400'] },
      { family: 'Georgia', category: 'serif', variants: ['400'] },
      { family: 'Impact', category: 'display', variants: ['400'] },
    ];
    const q = query?.trim().toLowerCase();
    return {
      source: 'fallback',
      items: q
        ? items.filter((f) => f.family.toLowerCase().includes(q))
        : items,
    };
  }
}
