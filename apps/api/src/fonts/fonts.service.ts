import { Injectable, Logger } from '@nestjs/common';
import { GoogleFontItem, GoogleFontsResponseDto } from '@photoshop-lite/shared-types';
import { FALLBACK_GOOGLE_FONTS } from './fallback-fonts';
import { CacheKeys, CacheService } from '../cache/cache.service';

interface GoogleApiItem {
  family: string;
  category: string;
  variants: string[];
}

const FONTS_TTL_MS = 1000 * 60 * 60 * 12; // 12h

@Injectable()
export class FontsService {
  private readonly logger = new Logger(FontsService.name);

  constructor(private readonly cache: CacheService) {}

  async list(query?: string): Promise<GoogleFontsResponseDto> {
    const catalog = await this.getCatalog();
    const q = query?.trim().toLowerCase();
    if (!q) return catalog;

    return this.cache.wrap(
      CacheKeys.fontsQuery(q),
      () => ({
        ...catalog,
        items: catalog.items.filter(
          (f) => f.family.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
        ),
      }),
      5 * 60_000
    );
  }

  private async getCatalog(): Promise<GoogleFontsResponseDto> {
    return this.cache.wrap(CacheKeys.fontsCatalog(), () => this.loadCatalog(), FONTS_TTL_MS);
  }

  private async loadCatalog(): Promise<GoogleFontsResponseDto> {
    const key = process.env.GOOGLE_FONTS_API_KEY?.trim();
    if (key) {
      try {
        const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(key)}&sort=popularity`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Google Fonts API ${res.status}`);
        }
        const data = (await res.json()) as { items?: GoogleApiItem[] };
        const items: GoogleFontItem[] = (data.items || []).slice(0, 400).map((f) => ({
          family: f.family,
          category: f.category || 'sans-serif',
          variants: f.variants || ['regular'],
        }));
        this.logger.log(`Loaded ${items.length} fonts from Google Fonts API`);
        return { items, source: 'google-api' };
      } catch (err) {
        this.logger.warn(
          `Google Fonts API failed, using fallback: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    return { items: FALLBACK_GOOGLE_FONTS, source: 'fallback' };
  }
}
