import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@photoshop-lite/editor-core';
import { AiApiClient } from './apiClient';
import { WORKSPACE_HEADER } from './workspaceId';

describe('AiApiClient', () => {
  const client = new AiApiClient('/api', () => 'workspace_person_a_01');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts JSON and returns payload', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, predictionId: 'p1' }),
    });

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
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    await client.listProjects();
    expect(fetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'GET',
        headers: { [WORKSPACE_HEADER]: 'workspace_person_a_01' },
      })
    );
  });

  it('throws AppError on HTTP failure', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    });

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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'starting' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          imageBase64: 'data:image/png;base64,ok',
        }),
      });

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
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'failed', error: 'boom' }),
    });

    await expect(
      client.pollUntilComplete({ predictionId: 'p1' }, { intervalMs: 1, maxAttempts: 2 })
    ).rejects.toMatchObject({ message: 'boom', code: 'UPSTREAM' });
  });

  it('pollUntilComplete times out', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'processing' }),
    });

    await expect(
      client.pollUntilComplete({ predictionId: 'p1' }, { intervalMs: 1, maxAttempts: 2 })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('builds fonts query string', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], source: 'fallback' }),
    });

    await client.listFonts('Syne');
    expect(fetch).toHaveBeenCalledWith('/api/fonts?q=Syne', expect.any(Object));
  });
});
