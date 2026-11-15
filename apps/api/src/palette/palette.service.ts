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
    const key = `palette:harmony:${seed}`;
    return this.cache.wrap(key, () => this.fetchColormind(seed), TTL_MS);
  }

  private async fetchColormind(seed: string): Promise<PaletteHarmonyResponseDto> {
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
    return { colors: FALLBACK, source: 'fallback' };
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
