import type { GoogleFontItem, GoogleFontsResponseDto } from '@photoshop-lite/shared-types';
import { aiApiClient } from '@photoshop-lite/editor-ai-client';

const loaded = new Set<string>();

/** Curated list when API is offline — mirrors API fallback (no Inter/Roboto as defaults in UI prefs). */
const CLIENT_FALLBACK_FONTS: GoogleFontItem[] = [
  { family: 'Bricolage Grotesque', category: 'sans-serif', variants: ['500', '600', '700', '800'] },
  { family: 'Source Sans 3', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'JetBrains Mono', category: 'monospace', variants: ['400', '500'] },
  { family: 'DM Sans', category: 'sans-serif', variants: ['400', '500', '700'] },
  { family: 'Manrope', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Outfit', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Sora', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Archivo', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Barlow', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Montserrat', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Poppins', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Nunito', category: 'sans-serif', variants: ['400', '600', '700'] },
  { family: 'Raleway', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Oswald', category: 'sans-serif', variants: ['400', '500', '600', '700'] },
  { family: 'Playfair Display', category: 'serif', variants: ['400', '600', '700'] },
  { family: 'Merriweather', category: 'serif', variants: ['400', '700'] },
  { family: 'Lora', category: 'serif', variants: ['400', '600', '700'] },
  { family: 'Source Serif 4', category: 'serif', variants: ['400', '600', '700'] },
  { family: 'Cormorant Garamond', category: 'serif', variants: ['400', '600', '700'] },
  { family: 'Bebas Neue', category: 'display', variants: ['400'] },
  { family: 'Abril Fatface', category: 'display', variants: ['400'] },
  { family: 'Anton', category: 'sans-serif', variants: ['400'] },
  { family: 'Pacifico', category: 'handwriting', variants: ['400'] },
  { family: 'Dancing Script', category: 'handwriting', variants: ['400', '600', '700'] },
  { family: 'Caveat', category: 'handwriting', variants: ['400', '600', '700'] },
  { family: 'Inconsolata', category: 'monospace', variants: ['400', '500', '700'] },
  { family: 'Source Code Pro', category: 'monospace', variants: ['400', '500', '600', '700'] },
  { family: 'Georgia', category: 'serif', variants: ['400'] },
];

function filterFallback(query?: string): GoogleFontsResponseDto {
  const q = query?.trim().toLowerCase();
  return {
    source: 'fallback',
    items: q
      ? CLIENT_FALLBACK_FONTS.filter(
          (f) => f.family.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
        )
      : CLIENT_FALLBACK_FONTS,
  };
}

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

/** Catalog via Nest `/api/fonts` (Google Web Fonts API or server fallback). */
export async function fetchGoogleFonts(query?: string): Promise<GoogleFontsResponseDto> {
  try {
    const res = await aiApiClient.listFonts(query);
    if (res?.items?.length) return res;
    return filterFallback(query);
  } catch {
    return filterFallback(query);
  }
}
