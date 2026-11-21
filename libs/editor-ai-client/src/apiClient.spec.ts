import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@photoshop-lite/editor-core';
import { AiApiClient } from './apiClient';
import { ClientHttpCache } from './httpCache';
import { WORKSPACE_HEADER } from './workspaceId';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; cacheControl?: string } = {}) {
  const status = init.status ?? (init.ok === false ? 400 : 200);
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'cache-control' ? init.cacheControl ?? null : null,
    },
    json: async () => body,
  };
}

describe('AiApiClient', () => {
  let cache: ClientHttpCache;
  let client: AiApiClient;

  beforeEach(() => {
    cache = new ClientHttpCache();
    client = new AiApiClient('/api', () => 'workspace_person_a_01', cache);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cache.clear();
    vi.unstubAllGlobals();
  });

  it('posts JSON and returns payload', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ success: true, predictionId: 'p1' })
    );

    const result = await client.revive({ imageBase64: 'data:image/png;base64,x' });
    expect(result.predictionId).toBe('p1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/revive',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WORKSPACE_HEADER]: 'workspace_person_a_01',
        },
      })
    );
  });

  it('sends workspace header on GET project list', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse([], { cacheControl: 'private, no-store' })
    );
    await client.listProjects();
    expect(fetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'GET',
        headers: { [WORKSPACE_HEADER]: 'workspace_person_a_01' },
      })
    );
  });

  it('caches catalog GET and serves second call from cache', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse(
        { kind: 'textures', items: [{ id: '1' }], source: 'polyhaven' },
        { cacheControl: 'public, max-age=1800, stale-while-revalidate=60' }
      )
    );
    const a = await client.listCatalog('textures');
    const b = await client.listCatalog('textures');
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on 429 then succeeds', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'Too many requests', details: { retryAfter: 0 } },
          { ok: false, status: 429 }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ items: [], source: 'fallback' }));

    const result = await client.listFonts();
    expect(result.source).toBe('fallback');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws RATE_LIMITED after exhausted 429 retry', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'slow down', details: { retryAfter: 0 } }, { ok: false, status: 429 })
    );
    await expect(client.listFonts()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
  });

  it('throws AppError on HTTP failure', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: 'bad request' }, { ok: false, status: 400 })
    );

    await expect(client.cleanup({ imageBase64: 'x' })).rejects.toBeInstanceOf(AppError);
    await expect(client.cleanup({ imageBase64: 'x' })).rejects.toMatchObject({
      message: 'bad request',
      code: 'VALIDATION',
    });
  });

  it('throws NETWORK AppError when fetch fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    await expect(client.listProjects()).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('pollUntilComplete resolves on succeeded image', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'starting' }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'succeeded',
          imageBase64: 'data:image/png;base64,ok',
        })
      );

    const progress: string[] = [];
    const result = await client.pollUntilComplete(
      { predictionId: 'p1' },
      {
        intervalMs: 1,
        onProgress: (_n, status) => progress.push(status),
      }
    );

    expect(result.imageBase64).toContain('data:image/png');
    expect(progress).toContain('starting');
    expect(progress).toContain('succeeded');
  });

  it('pollUntilComplete throws on failed job', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ status: 'failed', error: 'boom' })
    );

    await expect(
      client.pollUntilComplete({ predictionId: 'p1' }, { intervalMs: 1, maxAttempts: 2 })
    ).rejects.toMatchObject({ message: 'boom', code: 'UPSTREAM' });
  });

  it('pollUntilComplete times out', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ status: 'processing' })
    );

    await expect(
      client.pollUntilComplete({ predictionId: 'p1' }, { intervalMs: 1, maxAttempts: 2 })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('builds fonts query string', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ items: [], source: 'fallback' })
    );

    await client.listFonts('Syne');
    expect(fetch).toHaveBeenCalledWith('/api/fonts?q=Syne', expect.any(Object));
  });

  it('lists free catalog with kind + query', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ kind: 'textures', items: [], source: 'polyhaven' })
    );

    await client.listCatalog('textures', { q: 'wood', page: 2 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/catalog?kind=textures&q=wood&page=2',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('builds catalog media proxy URL and passes through API paths', () => {
    expect(client.catalogMediaUrl('https://cdn.polyhaven.com/a.png')).toBe(
      '/api/catalog/media?url=https%3A%2F%2Fcdn.polyhaven.com%2Fa.png'
    );
    expect(client.catalogMediaUrl('/api/catalog/media?url=x')).toBe('/api/catalog/media?url=x');
  });

  it('fetchCatalogImage proxies via stock fetch', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        dataUrl: 'data:image/png;base64,aa',
        contentType: 'image/png',
        byteLength: 2,
      })
    );

    const result = await client.fetchCatalogImage('https://picsum.photos/id/1/100');
    expect(result.dataUrl).toContain('data:image/png');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/stock/fetch?url='),
      expect.any(Object)
    );
  });

  it('requests palette harmony with seed', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ colors: ['#d4923a'], source: 'fallback' })
    );
    await client.paletteHarmony('#d4923a');
    expect(fetch).toHaveBeenCalledWith('/api/palette/harmony?seed=d4923a', expect.any(Object));
  });

  it('searches stock with encoded query + page', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ items: [], query: 'portrait', providers: [], sources: {} })
    );
    await client.searchStock('portrait light', 2);
    expect(fetch).toHaveBeenCalledWith(
      '/api/stock/search?q=portrait%20light&page=2',
      expect.any(Object)
    );
  });

  it('lists avatars catalog kind', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ kind: 'avatars', items: [], source: 'dicebear' })
    );
    await client.listCatalog('avatars', { q: 'lab' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/catalog?kind=avatars&q=lab',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
