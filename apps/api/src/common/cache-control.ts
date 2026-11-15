import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

export const CACHE_CONTROL_KEY = 'cache_control';

/** Set HTTP Cache-Control on the response (handler or controller). */
export const CacheControl = (value: string) => SetMetadata(CACHE_CONTROL_KEY, value);

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const value =
      this.reflector.getAllAndOverride<string | undefined>(CACHE_CONTROL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? undefined;

    return next.handle().pipe(
      tap(() => {
        if (!value) return;
        const res = context.switchToHttp().getResponse<Response>();
        if (!res.getHeader('Cache-Control')) {
          res.setHeader('Cache-Control', value);
        }
      })
    );
  }
}
