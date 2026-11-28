/**
 * Clipdrop API — cleanup / uncrop / reimagine (Stability AI Clipdrop).
 * Docs: https://clipdrop.co/apis
 */
import {
  base64ToBuffer,
  bufferToDataUrl,
  envToken,
  multipartBody,
  sniffMime,
  type SyncImageResult,
} from './common';

export function clipdropKey(override?: string): string | undefined {
  return override || envToken('CLIPDROP_API_KEY');
}

async function clipdropBinary(
  path: string,
  fields: Record<string, string | { buf: Buffer; filename: string; mime: string }>,
  key: string
): Promise<SyncImageResult> {
  const { body, contentType } = multipartBody(fields);
  const res = await fetch(`https://clipdrop-api.co${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'Content-Type': contentType,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clipdrop ${path} failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const ctype = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = ctype.startsWith('image/') ? ctype.split(';')[0] : 'image/png';
  return { imageBase64: bufferToDataUrl(buf, mime), provider: 'clipdrop' };
}

function imageField(imageBase64: string) {
  const mime = sniffMime(imageBase64);
  const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  return {
    buf: base64ToBuffer(imageBase64),
    filename: `image.${ext}`,
    mime,
  };
}

/** Object cleanup / scratch removal. Optional mask = white edit region. */
export async function clipdropCleanup(options: {
  imageBase64: string;
  maskBase64?: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = clipdropKey(options.apiKey);
  if (!key) throw new Error('No CLIPDROP_API_KEY configured');

  const fields: Record<string, string | { buf: Buffer; filename: string; mime: string }> = {
    image_file: imageField(options.imageBase64),
  };
  if (options.maskBase64) {
    fields.mask_file = imageField(options.maskBase64);
  }
  return clipdropBinary('/cleanup/v1', fields, key);
}

/** Extend canvas (uncrop). */
export async function clipdropUncrop(options: {
  imageBase64: string;
  extendLeft?: number;
  extendRight?: number;
  extendUp?: number;
  extendDown?: number;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = clipdropKey(options.apiKey);
  if (!key) throw new Error('No CLIPDROP_API_KEY configured');

  return clipdropBinary(
    '/uncrop/v1',
    {
      image_file: imageField(options.imageBase64),
      extend_left: String(options.extendLeft ?? 64),
      extend_right: String(options.extendRight ?? 64),
      extend_up: String(options.extendUp ?? 64),
      extend_down: String(options.extendDown ?? 64),
    },
    key
  );
}

/** Creative reimagine / restyle. */
export async function clipdropReimagine(options: {
  imageBase64: string;
  apiKey?: string;
}): Promise<SyncImageResult> {
  const key = clipdropKey(options.apiKey);
  if (!key) throw new Error('No CLIPDROP_API_KEY configured');

  return clipdropBinary(
    '/reimagine/v1/reimagine',
    { image_file: imageField(options.imageBase64) },
    key
  );
}
