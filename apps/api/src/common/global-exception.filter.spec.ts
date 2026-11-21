/**
 * Nest unit smoke: GlobalExceptionFilter shapes errors consistently.
 */
import { describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';
import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ArgumentsHost } from '@nestjs/common';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const setHeader = vi.fn();
  const response = { status, setHeader };
  const request = { url: '/api/ai/upscale' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, setHeader };
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
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('boom'), host);
    logSpy.mockRestore();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'boom',
        code: 'INTERNAL',
      })
    );
  });

  it('maps ThrottlerException to 429 RATE_LIMITED with Retry-After', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json, setHeader } = mockHost();
    filter.catch(new ThrottlerException('Too Many Requests'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMITED',
        details: expect.objectContaining({ retryAfter: expect.any(Number) }),
      })
    );
  });
});
