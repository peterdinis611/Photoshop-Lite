import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  StockFetchResponseDto,
  StockPhotoItem,
  StockProvider,
  StockSearchResponseDto,
} from '@photoshop-lite/shared-types';
import { CacheKeys, CacheService } from '../cache/cache.service';

const STOCK_TTL_MS = 1000 * 60 * 30; // 30m
const STOCK_FETCH_TTL_MS = 1000 * 60 * 60; // 1h
const FETCH_MAX_BYTES = 12 * 1024 * 1024;

/** Hosts we will proxy for canvas place (Unsplash / Pexels / common CC CDNs). */
const FETCH_HOST_ALLOW = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'images.pexels.com',
  'www.pexels.com',
  'api.openverse.org',
  'upload.wikimedia.org',
  'live.staticflickr.com',
  'farm1.staticflickr.com',
  'farm2.staticflickr.com',
  'farm3.staticflickr.com',
  'farm4.staticflickr.com',
  'farm5.staticflickr.com',
  'farm6.staticflickr.com',
  'farm7.staticflickr.com',
  'farm8.staticflickr.com',
  'farm9.staticflickr.com',
  'c1.staticflickr.com',
  'c2.staticflickr.com',
  'i.imgur.com',
  'cdn.pixabay.com',
  'images.rawpixel.com',
  'openverse.org',
];

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly cache: CacheService) {}

  async search(query: string, page = 1): Promise<StockSearchResponseDto> {
    const q = query.trim() || 'nature';
    const pageSafe = Math.max(1, Math.min(10, page));
    const providers: StockProvider[] = ['unsplash', 'pexels', 'openverse', 'pixabay'];
    const sources: StockSearchResponseDto['sources'] = {};
    const buckets = await Promise.all(
      providers.map(async (provider) => {
        try {
          const items = await this.searchProvider(provider, q, pageSafe);
          sources[provider] = items === null ? 'missing-key' : 'ok';
          return items ?? [];
        } catch (err) {
          this.logger.warn(
            `${provider} search failed: ${err instanceof Error ? err.message : String(err)}`
          );
          sources[provider] = 'error';
          return [] as StockPhotoItem[];
        }
      })
    );

    // Interleave providers so the grid feels mixed
    const items: StockPhotoItem[] = [];
    const maxLen = Math.max(...buckets.map((b) => b.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (bucket[i]) items.push(bucket[i]);
      }
    }

    return { items, query: q, providers, sources };
  }

  async fetchImage(rawUrl: string): Promise<StockFetchResponseDto> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid image URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Only http(s) image URLs are allowed');
    }
    const host = parsed.hostname.toLowerCase();
    const allowed =
      FETCH_HOST_ALLOW.some((h) => host === h || host.endsWith(`.${h}`)) ||
      host.endsWith('.unsplash.com') ||
      host.endsWith('.pexels.com') ||
      host.endsWith('.staticflickr.com') ||
      host.endsWith('.wikimedia.org') ||
      host.endsWith('.openverse.org');
    if (!allowed) {
      throw new BadRequestException(`Host not allowed for stock fetch: ${host}`);
    }

    const cacheKey = CacheKeys.stockFetch(parsed.toString());
    return this.cache.wrap(
      cacheKey,
      async () => {
        const res = await fetch(parsed.toString(), {
          headers: {
            Accept: 'image/*,*/*;q=0.8',
            'User-Agent': 'PhotoshopLiteStockProxy/1.0',
          },
          redirect: 'follow',
        });
        if (!res.ok) {
          throw new BadRequestException(`Upstream image HTTP ${res.status}`);
        }
        const contentType = (res.headers.get('content-type') || 'image/jpeg')
          .split(';')[0]
          .trim();
        if (!contentType.startsWith('image/')) {
          throw new BadRequestException(`Not an image (${contentType})`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > FETCH_MAX_BYTES) {
          throw new BadRequestException('Image too large to proxy');
        }
        return {
          dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
          contentType,
          byteLength: buf.byteLength,
        };
      },
      STOCK_FETCH_TTL_MS
    );
  }

  private async searchProvider(
    provider: StockProvider,
    q: string,
    page: number
  ): Promise<StockPhotoItem[] | null> {
    return this.cache.wrap(
      CacheKeys.stockQuery(provider, q.toLowerCase(), page),
      () => {
        if (provider === 'unsplash') return this.searchUnsplash(q, page);
        if (provider === 'pexels') return this.searchPexels(q, page);
        if (provider === 'pixabay') return this.searchPixabay(q, page);
        return this.searchOpenverse(q, page);
      },
      STOCK_TTL_MS
    );
  }

  private async searchUnsplash(q: string, page: number): Promise<StockPhotoItem[] | null> {
    const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
    if (!key) return null;

    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', q);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '12');
    url.searchParams.set('orientation', 'landscape');

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
    });
    if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        id: string;
        description?: string | null;
        alt_description?: string | null;
        width: number;
        height: number;
        urls: { thumb: string; small: string; regular: string };
        user: { name: string; links?: { html?: string } };
        links?: { html?: string };
      }>;
    };

    return (data.results ?? []).map((p) => ({
      id: `unsplash_${p.id}`,
      provider: 'unsplash' as const,
      title: p.description || p.alt_description || 'Unsplash photo',
      author: p.user?.name || 'Unknown',
      authorUrl: p.user?.links?.html,
      thumbUrl: p.urls.thumb || p.urls.small,
      fullUrl: p.urls.regular,
      width: p.width,
      height: p.height,
      license: 'Unsplash License',
      sourcePageUrl: p.links?.html,
    }));
  }

  private async searchPexels(q: string, page: number): Promise<StockPhotoItem[] | null> {
    const key = process.env.PEXELS_API_KEY?.trim();
    if (!key) return null;

    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', q);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '12');

    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
    const data = (await res.json()) as {
      photos?: Array<{
        id: number;
        width: number;
        height: number;
        alt?: string;
        url: string;
        photographer: string;
        photographer_url?: string;
        src: { medium: string; large: string; original: string };
      }>;
    };

    return (data.photos ?? []).map((p) => ({
      id: `pexels_${p.id}`,
      provider: 'pexels' as const,
      title: p.alt || 'Pexels photo',
      author: p.photographer || 'Unknown',
      authorUrl: p.photographer_url,
      thumbUrl: p.src.medium,
      fullUrl: p.src.large || p.src.original,
      width: p.width,
      height: p.height,
      license: 'Pexels License',
      sourcePageUrl: p.url,
    }));
  }

  private async searchPixabay(q: string, page: number): Promise<StockPhotoItem[] | null> {
    const key = process.env.PIXABAY_API_KEY?.trim();
    if (!key) return null;

    const url = new URL('https://pixabay.com/api/');
    url.searchParams.set('key', key);
    url.searchParams.set('q', q);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '12');
    url.searchParams.set('image_type', 'photo');
    url.searchParams.set('safesearch', 'true');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}`);
    const data = (await res.json()) as {
      hits?: Array<{
        id: number;
        pageURL: string;
        previewURL: string;
        webformatURL: string;
        largeImageURL?: string;
        imageWidth: number;
        imageHeight: number;
        user: string;
        user_id: number;
        tags?: string;
      }>;
    };

    return (data.hits ?? []).map((p) => ({
      id: `pixabay_${p.id}`,
      provider: 'pixabay' as const,
      title: p.tags || 'Pixabay photo',
      author: p.user || 'Unknown',
      authorUrl: `https://pixabay.com/users/${encodeURIComponent(p.user)}-${p.user_id}/`,
      thumbUrl: p.previewURL || p.webformatURL,
      fullUrl: p.largeImageURL || p.webformatURL,
      width: p.imageWidth,
      height: p.imageHeight,
      license: 'Pixabay License',
      sourcePageUrl: p.pageURL,
    }));
  }

  private async searchOpenverse(q: string, page: number): Promise<StockPhotoItem[]> {
    const url = new URL('https://api.openverse.org/v1/images/');
    url.searchParams.set('q', q);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', '12');
    url.searchParams.set('license_type', 'commercial');
    url.searchParams.set('filter_dead', 'true');

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        id: string;
        title?: string;
        creator?: string | null;
        creator_url?: string | null;
        url: string;
        thumbnail?: string | null;
        foreign_landing_url?: string | null;
        license?: string | null;
        license_version?: string | null;
        width?: number | null;
        height?: number | null;
      }>;
    };

    return (data.results ?? [])
      .filter((p) => Boolean(p.url || p.thumbnail))
      .map((p) => ({
        id: `openverse_${p.id}`,
        provider: 'openverse' as const,
        title: p.title || 'CC image',
        author: p.creator || 'Unknown',
        authorUrl: p.creator_url || undefined,
        thumbUrl: p.thumbnail || p.url,
        fullUrl: p.url,
        width: p.width || 1200,
        height: p.height || 800,
        license: [p.license, p.license_version].filter(Boolean).join(' ') || 'CC',
        sourcePageUrl: p.foreign_landing_url || undefined,
      }));
  }
}
