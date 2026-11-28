/**
 * fal.ai — free-tier friendly sync image jobs (inpaint / upscale / rembg).
 * Docs: https://fal.ai/docs
 */
import {
  ensureDataUrl,
  envToken,
  fetchImageAsDataUrl,
  type SyncImageResult,
} from './common';

export function falKey(override?: string): string | undefined {
  return override || envToken('FAL_KEY', 'FAL_API_KEY');
}

async function falRun(
  modelId: string,
  input: Record<string, unknown>,
  key: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as Record<string, unknown> & { detail?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.detail || data.error || `fal.ai ${modelId} failed (${res.status})`);
  }
  return data;
}

function pickImageUrl(data: Record<string, unknown>): string | undefined {
  const image = data.image as { url?: string } | undefined;
  if (image?.url) return image.url;
  const images = data.images as Array<{ url?: string }> | undefined;
  if (images?.[0]?.url) return images[0].url;
  if (typeof data.image === 'string') return data.image as string;
  if (typeof data.output === 'string') return data.output as string;
  return undefined;
}

/** SDXL / Flux-style inpaint. White = edit region. */
export async function falInpaint(options: {
  imageBase64: string;
  maskBase64: string;
  prompt?: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = falKey(options.apiKey);
  if (!key) throw new Error('No FAL_KEY configured');

  const data = await falRun(
    'fal-ai/flux-lora-fill',
    {
      image_url: ensureDataUrl(options.imageBase64),
      mask_url: ensureDataUrl(options.maskBase64),
      prompt:
        options.prompt ||
        'seamless photorealistic fill, match lighting and texture, high quality',
    },
    key
  );

  const url = pickImageUrl(data);
  if (!url) throw new Error('fal.ai inpaint returned no image');
  return { imageBase64: await fetchImageAsDataUrl(url), provider: 'fal' };
}

export async function falUpscale(options: {
  imageBase64: string;
  scale?: number;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = falKey(options.apiKey);
  if (!key) throw new Error('No FAL_KEY configured');

  const scale = Math.max(2, Math.min(4, Math.round(options.scale ?? 2)));
  const data = await falRun(
    'fal-ai/esrgan',
    {
      image_url: ensureDataUrl(options.imageBase64),
      scale,
    },
    key
  );

  const url = pickImageUrl(data);
  if (!url) throw new Error('fal.ai upscale returned no image');
  return { imageBase64: await fetchImageAsDataUrl(url), provider: 'fal' };
}

export async function falRemoveBg(options: {
  imageBase64: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = falKey(options.apiKey);
  if (!key) throw new Error('No FAL_KEY configured');

  const data = await falRun(
    'fal-ai/imageutils/rembg',
    { image_url: ensureDataUrl(options.imageBase64) },
    key
  );
  const url = pickImageUrl(data);
  if (!url) throw new Error('fal.ai rembg returned no image');
  return { imageBase64: await fetchImageAsDataUrl(url), provider: 'fal' };
}
