/**
 * Together AI / Fireworks — text→image for Generative Fill prompts.
 * Prefer Together; fall back to Fireworks when configured.
 */
import { envToken, fetchImageAsDataUrl, type SyncImageResult } from './common';

export function togetherKey(override?: string): string | undefined {
  return override || envToken('TOGETHER_API_KEY');
}

export function fireworksKey(override?: string): string | undefined {
  return override || envToken('FIREWORKS_API_KEY');
}

/** Generate an image from a text prompt (used when Fill has a prompt but no mask-aware model). */
export async function togetherTextToImage(options: {
  prompt: string;
  width?: number;
  height?: number;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = togetherKey(options.apiKey);
  if (!key) throw new Error('No TOGETHER_API_KEY configured');

  const res = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      prompt: options.prompt,
      width: options.width ?? 1024,
      height: options.height ?? 1024,
      n: 1,
      response_format: 'url',
    }),
  });

  const data = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || `Together text→image failed (${res.status})`;
    throw new Error(msg);
  }

  const item = data.data?.[0];
  if (item?.b64_json) {
    return { imageBase64: `data:image/png;base64,${item.b64_json}`, provider: 'together' };
  }
  if (item?.url) {
    return { imageBase64: await fetchImageAsDataUrl(item.url), provider: 'together' };
  }
  throw new Error('Together returned no image');
}

/** Fireworks FLUX-style generation (OpenAI-compatible images endpoint when available). */
export async function fireworksTextToImage(options: {
  prompt: string;
  width?: number;
  height?: number;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = fireworksKey(options.apiKey);
  if (!key) throw new Error('No FIREWORKS_API_KEY configured');

  const res = await fetch('https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'image/jpeg',
    },
    body: JSON.stringify({
      prompt: options.prompt,
      aspect_ratio: '1:1',
      guidance_scale: 3.5,
      num_inference_steps: 4,
    }),
  });

  if (!res.ok) {
    // Fallback: OpenAI-compatible generations if workflow path fails
    const alt = await fetch('https://api.fireworks.ai/inference/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/flux-1-schnell-fp8',
        prompt: options.prompt,
        n: 1,
        size: `${options.width ?? 1024}x${options.height ?? 1024}`,
      }),
    });
    const data = (await alt.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    };
    if (!alt.ok) {
      throw new Error(data.error?.message || `Fireworks text→image failed (${res.status})`);
    }
    const item = data.data?.[0];
    if (item?.b64_json) {
      return { imageBase64: `data:image/png;base64,${item.b64_json}`, provider: 'fireworks' };
    }
    if (item?.url) {
      return { imageBase64: await fetchImageAsDataUrl(item.url), provider: 'fireworks' };
    }
    throw new Error('Fireworks returned no image');
  }

  const ctype = res.headers.get('content-type') || '';
  if (ctype.startsWith('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = ctype.split(';')[0];
    return { imageBase64: `data:${mime};base64,${buf.toString('base64')}`, provider: 'fireworks' };
  }

  const data = (await res.json()) as { image?: string; url?: string };
  if (data.image?.startsWith('data:')) {
    return { imageBase64: data.image, provider: 'fireworks' };
  }
  if (data.url) {
    return { imageBase64: await fetchImageAsDataUrl(data.url), provider: 'fireworks' };
  }
  throw new Error('Fireworks returned no image');
}

export async function textToImageFill(options: {
  prompt: string;
  width?: number;
  height?: number;
}): Promise<SyncImageResult> {
  if (togetherKey()) {
    try {
      return await togetherTextToImage(options);
    } catch {
      /* try fireworks */
    }
  }
  if (fireworksKey()) {
    return fireworksTextToImage(options);
  }
  throw new Error('No TOGETHER_API_KEY or FIREWORKS_API_KEY configured');
}
