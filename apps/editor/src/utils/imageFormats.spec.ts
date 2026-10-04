import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  extensionOf,
  isImageFile,
  isSvgFile,
  likelyHasAlpha,
  listExportFormats,
  mimeToExtension,
  preferEncodeMime,
  shouldNormalizeToPng,
  IMAGE_EXTENSIONS,
  IMAGE_ACCEPT,
} from './imageFormats';

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

describe('imageFormats catalog', () => {
  it('lists a broad set of extensions', () => {
    expect(IMAGE_EXTENSIONS).toEqual(
      expect.arrayContaining(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'heic', 'tiff', 'ico', 'jxl', 'bmp'])
    );
  });

  it('builds an accept string with MIME + extensions', () => {
    expect(IMAGE_ACCEPT).toContain('image/*');
    expect(IMAGE_ACCEPT).toContain('.heic');
    expect(IMAGE_ACCEPT).toContain('image/avif');
  });
});

describe('isImageFile / isSvgFile', () => {
  it('accepts any image/* MIME', () => {
    expect(isImageFile(makeFile('x.bin', 'image/jxl'))).toBe(true);
  });

  it('accepts all catalog extensions without MIME', () => {
    for (const ext of IMAGE_EXTENSIONS) {
      expect(isImageFile(makeFile(`shot.${ext}`, ''))).toBe(true);
    }
  });

  it('detects SVG', () => {
    expect(isSvgFile(makeFile('logo.svg', ''))).toBe(true);
    expect(isSvgFile(makeFile('logo.svgz', 'image/svg+xml'))).toBe(true);
    expect(isSvgFile(makeFile('photo.jpg', 'image/jpeg'))).toBe(false);
  });
});

describe('shouldNormalizeToPng / preferEncodeMime', () => {
  it('marks exotic formats for PNG bake', () => {
    expect(shouldNormalizeToPng(makeFile('a.heic', ''))).toBe(true);
    expect(shouldNormalizeToPng(makeFile('a.tiff', 'image/tiff'))).toBe(true);
    expect(shouldNormalizeToPng(makeFile('a.ico', ''))).toBe(true);
    expect(shouldNormalizeToPng(makeFile('a.jpg', 'image/jpeg'))).toBe(false);
    expect(shouldNormalizeToPng(makeFile('a.png', 'image/png'))).toBe(false);
  });

  it('preserves format / alpha appropriately', () => {
    expect(preferEncodeMime('photo.png', 100, 100)).toBe('image/png');
    expect(preferEncodeMime('shot.webp', 100, 100)).toBe('image/webp');
    expect(preferEncodeMime('image/jpeg', 100, 100)).toBe('image/jpeg');
    expect(preferEncodeMime('icon.ico', 64, 64)).toBe('image/png');
  });

  it('uses JPEG for huge opaque bitmaps', () => {
    expect(preferEncodeMime('raw.bin', 5000, 5000)).toBe('image/jpeg');
  });
});

describe('mimeToExtension / extensionOf', () => {
  it('maps MIME types', () => {
    expect(mimeToExtension('image/jpeg')).toBe('jpg');
    expect(mimeToExtension('image/avif')).toBe('avif');
    expect(mimeToExtension('image/tiff')).toBe('tiff');
    expect(mimeToExtension('image/x-icon')).toBe('ico');
  });

  it('parses extension', () => {
    expect(extensionOf('Photo.JPEG')).toBe('jpeg');
    expect(extensionOf('noext')).toBe('');
  });

  it('detects alpha hints', () => {
    expect(likelyHasAlpha('image/png')).toBe(true);
    expect(likelyHasAlpha('photo.jpg')).toBe(false);
  });
});

describe('listExportFormats', () => {
  it('includes avif when supported', () => {
    expect(listExportFormats(true)).toContain('avif');
    expect(listExportFormats(false)).not.toContain('avif');
  });
});

describe('isAvifEncodeSupported', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when toBlob yields nothing', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      cb: BlobCallback
    ) {
      cb(null);
    } as never);

    const { isAvifEncodeSupported } = await import('./imageFormats');
    await expect(isAvifEncodeSupported()).resolves.toBe(false);
  });
});
