import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { StockService } from '../stock/stock.service';

describe('CatalogController', () => {
  let controller: CatalogController;
  let catalog: { list: ReturnType<typeof vi.fn> };
  let stock: { fetchImageBinary: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    catalog = { list: vi.fn() };
    stock = { fetchImageBinary: vi.fn() };
    controller = new CatalogController(
      catalog as unknown as CatalogService,
      stock as unknown as StockService
    );
  });

  it('defaults kind to textures when invalid', async () => {
    catalog.list.mockResolvedValue({ kind: 'textures', items: [], source: 'polyhaven' });
    await controller.list('nope', undefined, '1');
    expect(catalog.list).toHaveBeenCalledWith('textures', undefined, 1);
  });

  it('parses page and forwards query', async () => {
    catalog.list.mockResolvedValue({ kind: 'placeholders', items: [], source: 'picsum' });
    await controller.list('placeholders', 'wood', '3');
    expect(catalog.list).toHaveBeenCalledWith('placeholders', 'wood', 3);
  });

  it('streams media via stock binary proxy', async () => {
    const buf = Buffer.from('png');
    stock.fetchImageBinary.mockResolvedValue({ buffer: buf, contentType: 'image/png' });
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    await controller.media('https://cdn.polyhaven.com/x.png', res as never);
    expect(stock.fetchImageBinary).toHaveBeenCalledWith('https://cdn.polyhaven.com/x.png');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.send).toHaveBeenCalledWith(buf);
  });

  it('propagates SSRF rejection from stock proxy', async () => {
    stock.fetchImageBinary.mockRejectedValue(new BadRequestException('Host not allowed'));
    const res = { setHeader: vi.fn(), send: vi.fn() };
    await expect(controller.media('https://evil.test/x', res as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
