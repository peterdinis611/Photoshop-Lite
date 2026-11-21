import { Injectable, Logger } from '@nestjs/common';
import type {
  CatalogItem,
  CatalogKind,
  CatalogListResponseDto,
} from '@photoshop-lite/shared-types';
import { CacheService } from '../cache/cache.service';

const TTL_MS = 1000 * 60 * 60; // 1h

const AVATAR_STYLES = [
  'shapes',
  'bottts',
  'identicon',
  'notionists',
  'thumbs',
  'rings',
] as const;

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly cache: CacheService) {}

  async list(kind: CatalogKind, query?: string, page = 1): Promise<CatalogListResponseDto> {
    const q = (query || '').trim().toLowerCase();
    const pageSafe = Math.max(1, Math.min(20, page));
    const key = `catalog:${kind}:v2:${q || '_'}:${pageSafe}`;
    const raw = await this.cache.wrap(key, () => this.fetchKind(kind, q, pageSafe), TTL_MS);
    return this.withProxiedThumbs(raw);
  }

  /** Thumbs go through /api/catalog/media — browser never hits CDNs directly. */
  private withProxiedThumbs(res: CatalogListResponseDto): CatalogListResponseDto {
    return {
      ...res,
      items: res.items.map((item) => ({
        ...item,
        thumbUrl: `/api/catalog/media?url=${encodeURIComponent(item.thumbUrl)}`,
      })),
    };
  }

  private async fetchKind(
    kind: CatalogKind,
    query: string,
    page: number
  ): Promise<CatalogListResponseDto> {
    switch (kind) {
      case 'textures':
        return this.fetchPolyHaven(query);
      case 'placeholders':
        return this.fetchPicsum(page);
      case 'avatars':
        return this.fetchDiceBear(query || 'darkroom', page);
      default:
        return { kind, items: [], source: 'empty' };
    }
  }

  /** CC0 PBR textures — Poly Haven public API (no key). */
  private async fetchPolyHaven(query: string): Promise<CatalogListResponseDto> {
    try {
      const res = await fetch('https://api.polyhaven.com/assets?t=textures', {
        headers: { Accept: 'application/json', 'User-Agent': 'PhotoshopLite/1.0' },
      });
      if (!res.ok) throw new Error(`Poly Haven HTTP ${res.status}`);
      const data = (await res.json()) as Record<
        string,
        {
          name?: string;
          categories?: string[];
          tags?: string[];
          download_count?: number;
        }
      >;
      let entries = Object.entries(data);
      if (query) {
        entries = entries.filter(([id, meta]) => {
          const hay = [id, meta.name, ...(meta.categories ?? []), ...(meta.tags ?? [])]
            .join(' ')
            .toLowerCase();
          return hay.includes(query);
        });
      }
      entries.sort(
        (a, b) => (b[1].download_count ?? 0) - (a[1].download_count ?? 0)
      );
      const items: CatalogItem[] = entries.slice(0, 48).map(([id, meta]) => ({
        id: `ph-${id}`,
        kind: 'textures',
        title: meta.name || id.replace(/_/g, ' '),
        author: 'Poly Haven',
        thumbUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
        fullUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=1024`,
        license: 'CC0',
        tags: [...(meta.categories ?? []), ...(meta.tags ?? [])].slice(0, 8),
      }));
      return { kind: 'textures', items, query: query || undefined, source: 'polyhaven' };
    } catch (err) {
      this.logger.warn(
        `Poly Haven failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return { kind: 'textures', items: [], query: query || undefined, source: 'error' };
    }
  }

  /** Lorem Picsum placeholder photos — no key. */
  private async fetchPicsum(page: number): Promise<CatalogListResponseDto> {
    try {
      const res = await fetch(
        `https://picsum.photos/v2/list?page=${page}&limit=24`,
        { headers: { Accept: 'application/json', 'User-Agent': 'PhotoshopLite/1.0' } }
      );
      if (!res.ok) throw new Error(`Picsum HTTP ${res.status}`);
      const data = (await res.json()) as Array<{
        id: string;
        author: string;
        width: number;
        height: number;
        url: string;
        download_url: string;
      }>;
      const items: CatalogItem[] = data.map((row) => ({
        id: `picsum-${row.id}`,
        kind: 'placeholders',
        title: `Plate ${row.id}`,
        author: row.author,
        thumbUrl: `https://picsum.photos/id/${row.id}/320/320`,
        fullUrl: `https://picsum.photos/id/${row.id}/1200/900`,
        width: row.width,
        height: row.height,
        license: 'Unsplash (Picsum)',
      }));
      return { kind: 'placeholders', items, source: 'picsum' };
    } catch (err) {
      this.logger.warn(`Picsum failed: ${err instanceof Error ? err.message : String(err)}`);
      return { kind: 'placeholders', items: [], source: 'error' };
    }
  }

  /** DiceBear avatar/illustration SVGs — no key. */
  private async fetchDiceBear(seed: string, page: number): Promise<CatalogListResponseDto> {
    const base = seed.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'darkroom';
    const items: CatalogItem[] = AVATAR_STYLES.map((style, i) => {
      const s = `${base}-${page}-${i}`;
      const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(s)}&size=512`;
      return {
        id: `dice-${style}-${s}`,
        kind: 'avatars' as const,
        title: `${style} · ${s}`,
        author: 'DiceBear',
        thumbUrl: url,
        fullUrl: url,
        width: 512,
        height: 512,
        license: 'CC0 / DiceBear',
        tags: [style],
      };
    });
    return { kind: 'avatars', items, query: base, source: 'dicebear' };
  }
}
