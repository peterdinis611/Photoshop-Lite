/** Shared helpers for free/freemium AI provider clients. */

export function envToken(...names: string[]): string | undefined {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function stripDataUrl(imageBase64: string): string {
  return imageBase64.replace(/^data:image\/\w+;base64,/, '');
}

export function ensureDataUrl(imageBase64: string, mime = 'image/png'): string {
  if (imageBase64.startsWith('data:')) return imageBase64;
  return `data:${mime};base64,${imageBase64}`;
}

export function sniffMime(imageBase64: string): string {
  if (imageBase64.startsWith('data:image/png')) return 'image/png';
  if (imageBase64.startsWith('data:image/webp')) return 'image/webp';
  if (imageBase64.startsWith('data:image/jpeg') || imageBase64.startsWith('data:image/jpg')) {
    return 'image/jpeg';
  }
  return 'image/png';
}

export function base64ToBuffer(imageBase64: string): Buffer {
  return Buffer.from(stripDataUrl(imageBase64), 'base64');
}

export function bufferToDataUrl(buf: Buffer, mime = 'image/png'): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/** Build a Blob/File-like multipart body without browser File. */
export function multipartBody(
  fields: Record<string, string | { buf: Buffer; filename: string; mime: string }>
): { body: Buffer; contentType: string } {
  const boundary = `----px${Date.now().toString(36)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
        )
      );
    } else {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${value.filename}"\r\nContent-Type: ${value.mime}\r\n\r\n`
        )
      );
      chunks.push(value.buf);
      chunks.push(Buffer.from('\r\n'));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download result (${res.status})`);
  const ctype = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = ctype.startsWith('image/') ? ctype.split(';')[0] : 'image/png';
  return bufferToDataUrl(buf, mime);
}

export type SyncImageResult = { imageBase64: string; provider: string };
