/**
 * Shared domain / client errors for Photoshop Lite.
 */
export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'UPSTREAM'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'INTERNAL'
  | 'CANCELLED';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status?: number;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      status?: number;
      details?: unknown;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code ?? 'INTERNAL';
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }

  static fromUnknown(error: unknown, fallback = 'Unexpected error'): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof Error) {
      return new AppError(error.message || fallback, {
        code: 'INTERNAL',
        cause: error,
      });
    }
    return new AppError(typeof error === 'string' ? error : fallback, {
      code: 'INTERNAL',
      details: error,
    });
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
    };
  }
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AppError || error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}
