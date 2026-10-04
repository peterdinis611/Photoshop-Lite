/**
 * Nest unit smoke: GlobalExceptionFilter shapes errors consistently.
 */
import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url: '/api/ai/upscale' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  it('maps HttpException to ApiErrorResponse', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(new BadRequestException({ error: 'Missing imageBase64', code: 'VALIDATION' }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: expect.stringContaining('Missing imageBase64'),
        path: '/api/ai/upscale',
      })
    );
  });

  it('maps unknown Error to 500', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'boom',
        code: 'INTERNAL',
      })
    );
  });
});
