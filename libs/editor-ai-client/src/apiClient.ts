import { AppError, getErrorMessage } from '@photoshop-lite/editor-core';
import type {
  PredictionPollRequestDto,
  PredictionPollResponseDto,
  RemoveBgRequestDto,
  RemoveBgResponseDto,
  UpscaleRequestDto,
  UpscaleResponseDto,
} from '@photoshop-lite/shared-types';

const DEFAULT_BASE = '/api';

export class AiApiClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new AppError('Network error talking to AI API', {
        code: 'NETWORK',
        cause,
      });
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : payload && typeof payload === 'object' && 'message' in payload
            ? String((payload as { message: unknown }).message)
            : `AI API failed (${response.status})`;

      throw new AppError(message, {
        code: response.status >= 500 ? 'UPSTREAM' : 'VALIDATION',
        status: response.status,
        details: payload,
      });
    }

    return payload as T;
  }

  removeBackground(dto: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    return this.request<RemoveBgResponseDto>('/ai/remove-bg', dto);
  }

  upscale(dto: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    return this.request<UpscaleResponseDto>('/ai/upscale', dto);
  }

  predictionStatus(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    return this.request<PredictionPollResponseDto>('/ai/prediction-status', dto);
  }

  /**
   * Poll Replicate prediction until success / failure / timeout.
   */
  async pollUntilComplete(
    dto: PredictionPollRequestDto,
    options: {
      maxAttempts?: number;
      intervalMs?: number;
      onProgress?: (attempt: number, status: string) => void;
    } = {}
  ): Promise<PredictionPollResponseDto> {
    const maxAttempts = options.maxAttempts ?? 60;
    const intervalMs = options.intervalMs ?? 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const poll = await this.predictionStatus(dto);
      options.onProgress?.(attempt, poll.status);

      if (poll.status === 'succeeded' && poll.imageBase64) {
        return poll;
      }
      if (poll.status === 'failed' || poll.status === 'canceled') {
        throw new AppError(poll.error || `Upscale ${poll.status}`, {
          code: 'UPSTREAM',
          details: poll,
        });
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new AppError('Upscale timed out waiting for Replicate', {
      code: 'TIMEOUT',
    });
  }
}

export const aiApiClient = new AiApiClient();

export { getErrorMessage };
