/**
 * Smoke: AI controller DTO validation paths via AiService wrappers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service';
import { BadRequestException } from '@nestjs/common';

describe('AiService validation', () => {
  let service: AiService;

  beforeEach(() => {
    service = new AiService();
  });

  it('rejects empty cleanup body with BadRequest', async () => {
    await expect(service.cleanup({} as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inpaint without mask', async () => {
    await expect(
      service.inpaint({ imageBase64: 'data:image/png;base64,x' } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes through engine result for revive', async () => {
    const engine = (service as unknown as { aiEngine: { revive: ReturnType<typeof vi.fn> } })
      .aiEngine;
    const revive = vi.fn().mockResolvedValue({
      success: true,
      predictionId: 'p1',
      statusUrl: 'https://example.com/p1',
    });
    engine.revive = revive;

    const result = await service.revive({
      imageBase64: 'data:image/png;base64,abc',
    });
    expect(result.predictionId).toBe('p1');
    expect(revive).toHaveBeenCalled();
  });
});
