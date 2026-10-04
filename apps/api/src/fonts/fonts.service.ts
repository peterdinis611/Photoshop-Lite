import { Injectable, Logger } from '@nestjs/common';
import { GoogleFontItem, GoogleFontsResponseDto } from '@photoshop-lite/shared-types';
import { FALLBACK_GOOGLE_FONTS } from './fallback-fonts';

interface GoogleApiItem {
  family: string;
  category: string;
  variants: string[];
}

@Injectable()
export class FontsService {
  private readonly logger = new Logger(FontsService.name);
  private cache: GoogleFontsResponseDto | null = null;
  private cacheAt = 0;
  private readonly ttlMs = 1000 * 60 * 60 * 12; // 12h

  async list(query?: string): Promise<GoogleFontsResponseDto> {
    const catalog = await this.getCatalog();
    const q = query?.trim().toLowerCase();
    if (!q) return catalog;
    return {
      ...catalog,
      items: catalog.items.filter(
        (f) => f.family.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
      ),
    };
  }

  private async getCatalog(): Promise<GoogleFontsResponseDto> {
    if (this.cache && Date.now() - this.cacheAt < this.ttlMs) {
      return this.cache;
    }

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
        this.cache = { items, source: 'google-api' };
        this.cacheAt = Date.now();
        this.logger.log(`Loaded ${items.length} fonts from Google Fonts API`);
        return this.cache;
      } catch (err) {
        this.logger.warn(
          `Google Fonts API failed, using fallback: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    this.cache = { items: FALLBACK_GOOGLE_FONTS, source: 'fallback' };
    this.cacheAt = Date.now();
    return this.cache;
  }
}
