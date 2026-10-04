/**
 * AiEngineService model routing — mock fetch, assert Replicate URLs/inputs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiEngineService, REPLICATE_MODEL_REFS } from '@photoshop-lite/ai';

describe('AiEngineService routing', () => {
  const engine = new AiEngineService();
  const prevToken = process.env.REPLICATE_API_TOKEN;

  beforeEach(() => {
    process.env.REPLICATE_API_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'pred_123',
          urls: { get: 'https://api.replicate.com/v1/predictions/pred_123' },
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevToken === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = prevToken;
  });

  async function lastFetchCall() {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
    return fetchMock.mock.calls.at(-1) as [string, RequestInit];
  }

  it('returns fallback when no token', async () => {
    delete process.env.REPLICATE_API_TOKEN;
    const result = await engine.cleanup({ imageBase64: 'data:image/png;base64,abc' });
    expect(result.success).toBe(false);
    expect(result.fallbackToClient).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes cleanup to SwinIR model', async () => {
    const result = await engine.cleanup({
      imageBase64: 'data:image/png;base64,abc',
      intensity: 0.8,
    });
    expect(result.predictionId).toBe('pred_123');
    const [url, init] = await lastFetchCall();
    expect(url).toBe(
      `https://api.replicate.com/v1/models/${REPLICATE_MODEL_REFS.cleanup}/predictions`
    );
    const body = JSON.parse(String(init.body));
    expect(body.input.noise).toBe(12);
  });

  it('routes revive to DDColor', async () => {
    await engine.revive({ imageBase64: 'data:image/png;base64,abc' });
    const [url] = await lastFetchCall();
    expect(url).toContain(REPLICATE_MODEL_REFS.revive);
  });

  it('routes face-restore to CodeFormer', async () => {
    await engine.faceRestore({ imageBase64: 'data:image/png;base64,abc', intensity: 0.7 });
    const [url, init] = await lastFetchCall();
    expect(url).toContain(REPLICATE_MODEL_REFS.faceRestore);
    const body = JSON.parse(String(init.body));
    expect(body.input.codeformer_fidelity).toBeCloseTo(0.65);
  });

  it('requires mask for inpaint', async () => {
    await expect(
      engine.inpaint({ imageBase64: 'data:image/png;base64,abc' })
    ).rejects.toThrow(/maskBase64/);
  });

  it('routes inpaint with mask + prompt', async () => {
    await engine.inpaint({
      imageBase64: 'data:image/png;base64,img',
      maskBase64: 'data:image/png;base64,mask',
      prompt: 'fill sky',
    });
    const [url, init] = await lastFetchCall();
    expect(url).toContain(REPLICATE_MODEL_REFS.inpaint);
    const body = JSON.parse(String(init.body));
    expect(body.input.prompt).toBe('fill sky');
    expect(body.input.mask).toContain('data:image/png');
  });

  it('routes style with film prompt', async () => {
    await engine.styleTransfer({
      imageBase64: 'data:image/png;base64,abc',
      style: 'film',
    });
    const [url, init] = await lastFetchCall();
    expect(url).toContain(REPLICATE_MODEL_REFS.style);
    const body = JSON.parse(String(init.body));
    expect(body.input.prompt).toMatch(/film/i);
  });

  it('routes segment and caption models', async () => {
    await engine.segment({ imageBase64: 'data:image/png;base64,abc' });
    let [url] = await lastFetchCall();
    expect(url).toContain(REPLICATE_MODEL_REFS.segment);

    await engine.caption({ imageBase64: 'data:image/png;base64,abc' });
    [url] = await lastFetchCall();
    expect(url).toContain(REPLICATE_MODEL_REFS.caption);
  });

  it('rejects missing imageBase64', async () => {
    await expect(engine.cleanup({} as { imageBase64: string })).rejects.toThrow(
      /imageBase64/
    );
  });

  it('pollPrediction returns text captions without downloading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          output: 'a portrait of a woman',
        }),
      })
    );

    const poll = await engine.pollPrediction({ predictionId: 'pred_cap' });
    expect(poll.status).toBe('succeeded');
    expect(poll.text).toBe('a portrait of a woman');
    expect(poll.imageBase64).toBeUndefined();
  });

  it('pollPrediction downloads image outputs as data URLs', async () => {
    const pngBytes = Uint8Array.from([137, 80, 78, 71]); // PNG magic
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'succeeded',
            output: 'https://cdn.example.com/out.png',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'image/png' },
          arrayBuffer: async () => pngBytes.buffer,
        })
    );

    const poll = await engine.pollPrediction({ predictionId: 'pred_img' });
    expect(poll.status).toBe('succeeded');
    expect(poll.imageBase64).toMatch(/^data:image\/png;base64,/);
    expect(poll.outputUrl).toBe('https://cdn.example.com/out.png');
  });

  it('pollPrediction surfaces failed status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'failed', error: 'gpu OOM' }),
      })
    );

    const poll = await engine.pollPrediction({ predictionId: 'pred_fail' });
    expect(poll.status).toBe('failed');
    expect(poll.error).toMatch(/gpu OOM/);
  });
});
