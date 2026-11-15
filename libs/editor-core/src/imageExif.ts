export interface ImageExifSummary {
  fileName?: string;
  width: number;
  height: number;
  megapixels: number;
  aspectLabel: string;
  mimeType?: string;
  /** Approximate byte size of the data URL / blob when known */
  approxBytes?: number;
  /** Best-effort EXIF-ish tags parsed from JPEG APP1 */
  make?: string;
  model?: string;
  dateTime?: string;
  orientation?: number;
  software?: string;
  latitude?: number;
  longitude?: number;
  /** Filled later via Nominatim reverse geocode */
  locationLabel?: string;
  hasExif: boolean;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function aspectLabel(w: number, h: number): string {
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

function readJpegExifAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
}

/** Lightweight JPEG EXIF scan — no dependency. PNG/WebP return dimensions only. */
export async function extractImageExif(
  src: string,
  meta?: { fileName?: string; mimeType?: string; byteLength?: number }
): Promise<ImageExifSummary> {
  const img = await loadImage(src);
  const summary: ImageExifSummary = {
    fileName: meta?.fileName,
    width: img.naturalWidth,
    height: img.naturalHeight,
    megapixels: Number(((img.naturalWidth * img.naturalHeight) / 1_000_000).toFixed(2)),
    aspectLabel: aspectLabel(img.naturalWidth, img.naturalHeight),
    mimeType: meta?.mimeType || sniffMime(src),
    approxBytes: meta?.byteLength ?? approxDataUrlBytes(src),
    hasExif: false,
  };

  try {
    const buf = await fetchAsArrayBuffer(src);
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
      return summary; // not JPEG
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1 && size > 8) {
        const start = offset + 4;
        const head = readJpegExifAscii(view, start, 4);
        if (head === 'Exif') {
          summary.hasExif = true;
          parseExifTiff(view, start + 6, summary);
        }
        break;
      }
      if (marker === 0xda) break; // SOS
      offset += 2 + size;
    }
  } catch {
    /* ignore parse errors */
  }

  return summary;
}

function parseExifTiff(view: DataView, tiffStart: number, out: ImageExifSummary) {
  if (tiffStart + 8 > view.byteLength) return;
  const endian = view.getUint16(tiffStart);
  const le = endian === 0x4949;
  const get16 = (o: number) => (le ? view.getUint16(o, true) : view.getUint16(o, false));
  const get32 = (o: number) => (le ? view.getUint32(o, true) : view.getUint32(o, false));

  const ifd0 = tiffStart + get32(tiffStart + 4);
  if (ifd0 + 2 > view.byteLength) return;
  const entries = get16(ifd0);
  let gpsOffset = 0;

  for (let i = 0; i < entries; i++) {
    const e = ifd0 + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = get16(e);
    const type = get16(e + 2);
    const count = get32(e + 4);
    const valueOffset = e + 8;
    const typeSize = type === 3 ? 2 : type === 4 ? 4 : type === 2 ? 1 : 0;
    const byteLen = typeSize * count;
    const dataPos =
      byteLen <= 4 ? valueOffset : tiffStart + get32(valueOffset);

    if (tag === 0x010f && type === 2) {
      out.make = readJpegExifAscii(view, dataPos, count);
    } else if (tag === 0x0110 && type === 2) {
      out.model = readJpegExifAscii(view, dataPos, count);
    } else if (tag === 0x0132 && type === 2) {
      out.dateTime = readJpegExifAscii(view, dataPos, count);
    } else if (tag === 0x0112 && type === 3) {
      out.orientation = get16(dataPos);
    } else if (tag === 0x0131 && type === 2) {
      out.software = readJpegExifAscii(view, dataPos, count);
    } else if (tag === 0x8825 && type === 4) {
      gpsOffset = get32(valueOffset);
    }
  }

  if (gpsOffset) {
    parseGpsIfd(view, tiffStart, tiffStart + gpsOffset, get16, get32, out);
  }
}

function readRational(
  view: DataView,
  tiffStart: number,
  offset: number,
  get32: (o: number) => number
): number {
  const num = get32(offset);
  const den = get32(offset + 4);
  return den ? num / den : 0;
}

function parseGpsIfd(
  view: DataView,
  tiffStart: number,
  ifd: number,
  get16: (o: number) => number,
  get32: (o: number) => number,
  out: ImageExifSummary
) {
  if (ifd + 2 > view.byteLength) return;
  const entries = get16(ifd);
  let latRef = 'N';
  let lonRef = 'E';
  let latVals: number[] | null = null;
  let lonVals: number[] | null = null;

  for (let i = 0; i < entries; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = get16(e);
    const type = get16(e + 2);
    const count = get32(e + 4);
    const valueOffset = e + 8;
    const dataPos = type === 2 && count <= 4 ? valueOffset : tiffStart + get32(valueOffset);

    if (tag === 1 && type === 2) {
      latRef = readJpegExifAscii(view, dataPos, count) || 'N';
    } else if (tag === 2 && type === 5 && count >= 3) {
      latVals = [
        readRational(view, tiffStart, dataPos, get32),
        readRational(view, tiffStart, dataPos + 8, get32),
        readRational(view, tiffStart, dataPos + 16, get32),
      ];
    } else if (tag === 3 && type === 2) {
      lonRef = readJpegExifAscii(view, dataPos, count) || 'E';
    } else if (tag === 4 && type === 5 && count >= 3) {
      lonVals = [
        readRational(view, tiffStart, dataPos, get32),
        readRational(view, tiffStart, dataPos + 8, get32),
        readRational(view, tiffStart, dataPos + 16, get32),
      ];
    }
  }

  if (latVals && lonVals) {
    const lat = dmsToDecimal(latVals) * (latRef.toUpperCase() === 'S' ? -1 : 1);
    const lon = dmsToDecimal(lonVals) * (lonRef.toUpperCase() === 'W' ? -1 : 1);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      out.latitude = Number(lat.toFixed(6));
      out.longitude = Number(lon.toFixed(6));
    }
  }
}

function dmsToDecimal(dms: number[]): number {
  return (dms[0] || 0) + (dms[1] || 0) / 60 + (dms[2] || 0) / 3600;
}

function sniffMime(src: string): string | undefined {
  if (src.startsWith('data:')) {
    const m = /^data:([^;,]+)/.exec(src);
    return m?.[1];
  }
  return undefined;
}

function approxDataUrlBytes(src: string): number | undefined {
  if (!src.startsWith('data:')) return undefined;
  const comma = src.indexOf(',');
  if (comma < 0) return undefined;
  const b64 = src.slice(comma + 1);
  return Math.round((b64.length * 3) / 4);
}

async function fetchAsArrayBuffer(src: string): Promise<ArrayBuffer> {
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const b64 = src.slice(comma + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(src);
  return res.arrayBuffer();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
