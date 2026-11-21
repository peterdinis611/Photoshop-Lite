import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@photoshop-lite/shared-types';

function retryAfterSeconds(exception: HttpException): number {
  const body = exception.getResponse();
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.retryAfter === 'number' && obj.retryAfter > 0) {
      return Math.ceil(obj.retryAfter);
    }
  }
  // Nest Throttler default window — surface a sane client backoff hint
  const ttlMs = Number(process.env.THROTTLE_TTL_MS) || 60_000;
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL';
    let details: unknown;
    let retryAfter: number | undefined;

    if (exception instanceof ThrottlerException || (exception instanceof HttpException && exception.getStatus() === 429)) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message =
        exception instanceof HttpException
          ? typeof exception.getResponse() === 'string'
            ? String(exception.getResponse())
            : 'Too many requests'
          : 'Too many requests';
      if (exception instanceof HttpException && typeof exception.getResponse() === 'object') {
        const obj = exception.getResponse() as Record<string, unknown>;
        if (typeof obj.message === 'string') message = obj.message;
      }
      code = 'RATE_LIMITED';
      retryAfter = retryAfterSeconds(
        exception instanceof HttpException
          ? exception
          : new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)
      );
      response.setHeader('Retry-After', String(retryAfter));
      response.setHeader('X-RateLimit-Policy', 'bucketed');
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        message = String(obj.message ?? obj.error ?? message);
        if (Array.isArray(obj.message)) {
          message = obj.message.join(', ');
        }
        details = obj.details ?? obj;
        if (typeof obj.code === 'string') code = obj.code;
      }
      code = status >= 500 ? 'UPSTREAM' : status === 404 ? 'NOT_FOUND' : 'VALIDATION';
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    // Map common upstream phrasing
    if (/replicate|remove\.bg|fetch failed|ECONNREFUSED/i.test(message)) {
      code = 'UPSTREAM';
      if (status < 500) status = HttpStatus.BAD_GATEWAY;
    }

    const payload: ApiErrorResponse = {
      statusCode: status,
      error: message,
      code,
      path: request.url,
      timestamp: new Date().toISOString(),
      details:
        process.env.NODE_ENV === 'production'
          ? retryAfter !== undefined
            ? { retryAfter }
            : undefined
          : details !== undefined
            ? details
            : retryAfter !== undefined
              ? { retryAfter }
              : undefined,
    };

    // Always include retryAfter in details for 429 so clients can back off.
    if (retryAfter !== undefined) {
      payload.details = {
        ...(typeof payload.details === 'object' && payload.details
          ? (payload.details as object)
          : {}),
        retryAfter,
      };
    }

    response.status(status).json(payload);
  }
}
