/**
 * DeepAI — colorize, super-resolution, style-ish (free tier with API key).
 * Docs: https://deepai.org/apis
 */
import {
  ensureDataUrl,
  envToken,
  fetchImageAsDataUrl,
  multipartBody,
  type SyncImageResult,
} from './common';

export function deepAiKey(override?: string): string | undefined {
  return override || envToken('DEEPAI_API_KEY');
}

async function deepAiJob(
  endpoint: string,
  imageBase64: string,
  key: string,
  extra?: Record<string, string>
): Promise<SyncImageResult> {
  const fields: Record<string, string> = {
    image: ensureDataUrl(imageBase64),
    ...extra,
  };
  const { body, contentType } = multipartBody(fields);
  const res = await fetch(`https://api.deepai.org/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': contentType,
    },
    body: new Uint8Array(body),
  });
  const data = (await res.json()) as { output_url?: string; err?: string; status?: string };
  if (!res.ok || !data.output_url) {
    throw new Error(data.err || `DeepAI ${endpoint} failed (${res.status})`);
  }
  return {
    imageBase64: await fetchImageAsDataUrl(data.output_url),
    provider: 'deepai',
  };
}

export async function deepAiColorize(options: {
  imageBase64: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = deepAiKey(options.apiKey);
  if (!key) throw new Error('No DEEPAI_API_KEY configured');
  return deepAiJob('colorizer', options.imageBase64, key);
}

export async function deepAiSuperRes(options: {
  imageBase64: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = deepAiKey(options.apiKey);
  if (!key) throw new Error('No DEEPAI_API_KEY configured');
  return deepAiJob('torch-srgan', options.imageBase64, key);
}

/** Cartoon / stylize fallback (toonify) — closest free DeepAI style transform. */
export async function deepAiStyle(options: {
  imageBase64: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = deepAiKey(options.apiKey);
  if (!key) throw new Error('No DEEPAI_API_KEY configured');
  return deepAiJob('toonify', options.imageBase64, key);
}
