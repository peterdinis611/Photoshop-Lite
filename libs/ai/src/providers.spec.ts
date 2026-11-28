import { afterEach, describe, expect, it, vi } from 'vitest';
import { falKey, togetherKey, clipdropKey, deepAiKey, photoroomKey } from './providers';

describe('provider env tokens', () => {
  const keys = [
    'FAL_KEY',
    'FAL_API_KEY',
    'TOGETHER_API_KEY',
    'FIREWORKS_API_KEY',
    'CLIPDROP_API_KEY',
    'DEEPAI_API_KEY',
    'PHOTOROOM_API_KEY',
  ];
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('reads provider keys from env', () => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    expect(falKey()).toBeUndefined();
    expect(togetherKey()).toBeUndefined();
    expect(clipdropKey()).toBeUndefined();
    expect(deepAiKey()).toBeUndefined();
    expect(photoroomKey()).toBeUndefined();

    process.env.FAL_KEY = 'fal_test';
    process.env.TOGETHER_API_KEY = 'tg_test';
    process.env.CLIPDROP_API_KEY = 'cd_test';
    process.env.DEEPAI_API_KEY = 'da_test';
    process.env.PHOTOROOM_API_KEY = 'pr_test';

    expect(falKey()).toBe('fal_test');
    expect(togetherKey()).toBe('tg_test');
    expect(clipdropKey()).toBe('cd_test');
    expect(deepAiKey()).toBe('da_test');
    expect(photoroomKey()).toBe('pr_test');
  });
});

describe('falInpaint routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FAL_KEY;
  });

  it('posts to fal.run when FAL_KEY is set', async () => {
    process.env.FAL_KEY = 'fal_test';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ image: { url: 'https://v3.fal.media/files/test.png' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'image/png' },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        })
    );

    const { falInpaint } = await import('./providers/fal');
    const result = await falInpaint({
      imageBase64: 'data:image/png;base64,aaa',
      maskBase64: 'data:image/png;base64,bbb',
      prompt: 'fill',
    });
    expect(result.provider).toBe('fal');
    expect(result.imageBase64.startsWith('data:image/png;base64,')).toBe(true);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls[0][0]).toContain('fal.run/fal-ai/flux-lora-fill');
  });
});
