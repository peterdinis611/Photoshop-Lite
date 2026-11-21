import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StockService } from './stock.service';
import { CacheService } from '../cache/cache.service';

describe('StockService', () => {
  let service: StockService;
  let cache: CacheService;

  beforeEach(() => {
    cache = {
      wrap: (_key: string, fn: () => Promise<unknown>) => fn(),
    } as unknown as CacheService;
    service = new StockService(cache);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows catalog hosts for proxy', () => {
    expect(service.assertAllowedImageUrl('https://cdn.polyhaven.com/x.png').hostname).toBe(
      'cdn.polyhaven.com'
    );
    expect(service.assertAllowedImageUrl('https://picsum.photos/id/1/200').hostname).toBe(
      'picsum.photos'
    );
    expect(
      service.assertAllowedImageUrl('https://api.dicebear.com/9.x/shapes/svg?seed=a').hostname
    ).toBe('api.dicebear.com');
  });

  it('rejects non-allowlisted hosts (SSRF guard)', () => {
    expect(() => service.assertAllowedImageUrl('https://evil.example/x.png')).toThrow(
      BadRequestException
    );
    expect(() => service.assertAllowedImageUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => service.assertAllowedImageUrl('not-a-url')).toThrow(BadRequestException);
  });

  it('fetchImageBinary returns buffer + content type', async () => {
    const bytes = Buffer.from([137, 80, 78, 71]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      })
    );

    const result = await service.fetchImageBinary('https://cdn.polyhaven.com/thumb.png');
    expect(result.contentType).toBe('image/png');
    expect(result.buffer.equals(bytes)).toBe(true);
  });

  it('fetchImage wraps binary as data URL', async () => {
    const bytes = Buffer.from('svg-bytes');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/svg+xml' },
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      })
    );

    const result = await service.fetchImage('https://api.dicebear.com/9.x/shapes/svg?seed=x');
    expect(result.contentType).toBe('image/svg+xml');
    expect(result.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(result.byteLength).toBe(bytes.byteLength);
  });

  it('rejects upstream non-image content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        arrayBuffer: async () => new ArrayBuffer(8),
      })
    );

    await expect(
      service.fetchImageBinary('https://picsum.photos/id/1/100')
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects upstream HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(
      service.fetchImageBinary('https://cdn.polyhaven.com/missing.png')
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
