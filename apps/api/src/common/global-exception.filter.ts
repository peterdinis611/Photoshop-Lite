import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@photoshop-lite/shared-types';

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

    if (exception instanceof HttpException) {
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
      details: process.env.NODE_ENV === 'production' ? undefined : details,
    };

    response.status(status).json(payload);
  }
}
