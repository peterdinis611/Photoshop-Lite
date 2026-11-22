import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FontsController } from './fonts.controller';
import { FontsService } from './fonts.service';

describe('FontsController', () => {
  let controller: FontsController;
  let fonts: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fonts = { list: vi.fn() };
    controller = new FontsController(fonts as unknown as FontsService);
  });

  it('forwards query to the service', async () => {
    fonts.list.mockResolvedValue({ source: 'fallback', items: [] });
    await controller.list('Syne');
    expect(fonts.list).toHaveBeenCalledWith('Syne');
  });

  it('allows empty query', async () => {
    fonts.list.mockResolvedValue({ source: 'fallback', items: [{ family: 'A', category: 'sans-serif', variants: ['400'] }] });
    const res = await controller.list(undefined);
    expect(fonts.list).toHaveBeenCalledWith(undefined);
    expect(res.items).toHaveLength(1);
  });
});
