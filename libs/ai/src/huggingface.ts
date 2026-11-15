/** Hugging Face Inference helpers — sync fallback when Replicate is unavailable. */

const HF_CAPTION_MODEL = 'Salesforce/blip-image-captioning-base';
const HF_UPSCALE_MODEL = 'caidas/swin2SR-classical-sr-x2-64';

export function huggingfaceToken(override?: string): string | undefined {
  return (
    override ||
    process.env.HF_TOKEN?.trim() ||
    process.env.HUGGINGFACE_API_KEY?.trim() ||
    undefined
  );
}

function stripDataUrl(imageBase64: string): string {
  return imageBase64.replace(/^data:image\/\w+;base64,/, '');
}

function base64ToBuffer(imageBase64: string): Buffer {
  return Buffer.from(stripDataUrl(imageBase64), 'base64');
}

function sniffMime(imageBase64: string): string {
  if (imageBase64.startsWith('data:image/png')) return 'image/png';
  if (imageBase64.startsWith('data:image/webp')) return 'image/webp';
  return 'image/jpeg';
}

async function hfBinary(
  model: string,
  imageBase64: string,
  token: string
): Promise<Response> {
  return fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': sniffMime(imageBase64),
    },
    body: new Uint8Array(base64ToBuffer(imageBase64)),
  });
}

/** Sync BLIP caption → plain text. */
export async function hfCaption(imageBase64: string, token: string): Promise<string> {
  const res = await hfBinary(HF_CAPTION_MODEL, imageBase64, token);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hugging Face caption ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as Array<{ generated_text?: string }> | { generated_text?: string };
  if (Array.isArray(data)) {
    return data[0]?.generated_text?.trim() || 'No caption';
  }
  return data.generated_text?.trim() || 'No caption';
}

/**
 * Best-effort upscale via HF — returns PNG data URL or throws.
 * Many SR models return raw image bytes.
 */
export async function hfUpscale(imageBase64: string, token: string): Promise<string> {
  const res = await hfBinary(HF_UPSCALE_MODEL, imageBase64, token);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hugging Face upscale ${res.status}: ${err.slice(0, 200)}`);
  }
  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || 'Hugging Face upscale returned JSON error');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = ctype.startsWith('image/') ? ctype.split(';')[0] : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Lightweight “segment” fallback: caption the subject prompt so the UI still returns something.
 * Full mask segment remains Replicate-primary.
 */
export async function hfSegmentHint(
  imageBase64: string,
  token: string,
  prompt?: string
): Promise<string> {
  const focus = prompt?.trim() || 'main subject';
  const caption = await hfCaption(imageBase64, token);
  return `Subject hint (${focus}): ${caption}`;
}
