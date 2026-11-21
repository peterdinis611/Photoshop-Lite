import { Injectable, Logger } from '@nestjs/common';
import type { PaletteHarmonyResponseDto } from '@photoshop-lite/shared-types';
import { CacheService } from '../cache/cache.service';

const TTL_MS = 1000 * 60 * 60; // 1h

const FALLBACK: string[] = ['#d4923a', '#e8a84a', '#5ecfc0', '#7eb0ff', '#ece8e1'];

@Injectable()
export class PaletteService {
  private readonly logger = new Logger(PaletteService.name);

  constructor(private readonly cache: CacheService) {}

  async harmony(seedHex?: string): Promise<PaletteHarmonyResponseDto> {
    const seed = (seedHex || 'd4923a').replace(/^#/, '').toLowerCase();
    const key = `palette:harmony:v2:${seed}`;
    return this.cache.wrap(key, () => this.resolveHarmony(seed), TTL_MS);
  }

  private async resolveHarmony(seed: string): Promise<PaletteHarmonyResponseDto> {
    const fromColormind = await this.fetchColormind(seed);
    if (fromColormind) return fromColormind;

    const fromColorApi = await this.fetchTheColorApi(seed);
    if (fromColorApi) return fromColorApi;

    return { colors: FALLBACK, source: 'fallback' };
  }

  private async fetchColormind(seed: string): Promise<PaletteHarmonyResponseDto | null> {
    try {
      const rgb = hexToRgb(seed) ?? [212, 146, 58];
      const res = await fetch('http://colormind.io/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'default',
          input: [rgb, 'N', 'N', 'N', 'N'],
        }),
      });
      if (!res.ok) throw new Error(`Colormind HTTP ${res.status}`);
      const data = (await res.json()) as { result?: number[][] };
      const colors = (data.result ?? [])
        .filter((c) => Array.isArray(c) && c.length >= 3)
        .map((c) => rgbToHex(c[0], c[1], c[2]));
      if (colors.length >= 3) {
        return { colors, source: 'colormind' };
      }
    } catch (err) {
      this.logger.warn(
        `Colormind failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return null;
  }

  /** Free HTTPS fallback — The Color API scheme endpoint (no key). */
  private async fetchTheColorApi(seed: string): Promise<PaletteHarmonyResponseDto | null> {
    try {
      const hex = (hexToRgb(seed) ? seed : 'd4923a').toUpperCase();
      const url =
        `https://www.thecolorapi.com/scheme?hex=${encodeURIComponent(hex)}` +
        `&mode=analogic&count=5`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'PhotoshopLite/1.0' },
      });
      if (!res.ok) throw new Error(`TheColorAPI HTTP ${res.status}`);
      const data = (await res.json()) as {
        colors?: Array<{ hex?: { value?: string } }>;
      };
      const colors = (data.colors ?? [])
        .map((c) => c.hex?.value)
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase());
      if (colors.length >= 3) {
        return { colors, source: 'thecolorapi' };
      }
    } catch (err) {
      this.logger.warn(
        `The Color API failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return null;
  }
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}
