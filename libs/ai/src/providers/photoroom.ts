/**
 * PhotoRoom Segment API — cutout alternative to remove.bg.
 * Docs: https://docs.photoroom.com/image-editing-api-plus-plan/remove-background
 */
import {
  base64ToBuffer,
  bufferToDataUrl,
  envToken,
  multipartBody,
  sniffMime,
  type SyncImageResult,
} from './common';

export function photoroomKey(override?: string): string | undefined {
  return override || envToken('PHOTOROOM_API_KEY');
}

export async function photoroomRemoveBg(options: {
  imageBase64: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = photoroomKey(options.apiKey);
  if (!key) throw new Error('No PHOTOROOM_API_KEY configured');

  const mime = sniffMime(options.imageBase64);
  const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  const { body, contentType } = multipartBody({
    image_file: {
      buf: base64ToBuffer(options.imageBase64),
      filename: `image.${ext}`,
      mime,
    },
  });

  const res = await fetch('https://sdk.photoroom.com/v1/segment', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'Content-Type': contentType,
      Accept: 'image/png, application/json',
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PhotoRoom segment failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const ctype = res.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const data = (await res.json()) as { result_b64?: string; error?: string };
    if (data.result_b64) {
      return {
        imageBase64: `data:image/png;base64,${data.result_b64}`,
        provider: 'photoroom',
      };
    }
    throw new Error(data.error || 'PhotoRoom returned JSON without image');
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { imageBase64: bufferToDataUrl(buf, 'image/png'), provider: 'photoroom' };
}
