import { AppError, getErrorMessage } from '@photoshop-lite/editor-core';
import type {
  PredictionPollRequestDto,
  PredictionPollResponseDto,
  RemoveBgRequestDto,
  RemoveBgResponseDto,
  UpscaleRequestDto,
  UpscaleResponseDto,
  AiJobRequestDto,
  AiJobResponseDto,
  ProjectCreateDto,
  ProjectDetailDto,
  ProjectSummaryDto,
  ProjectVersionSummaryDto,
  AssetUploadDto,
  AssetResponseDto,
} from '@photoshop-lite/shared-types';

const DEFAULT_BASE = '/api';

export class AiApiClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE) {}

  private async request<T>(
    path: string,
    body?: unknown,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST'
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
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
            : `API failed (${response.status})`;

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

  cleanup(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/cleanup', dto);
  }

  revive(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/revive', dto);
  }

  faceRestore(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/face-restore', dto);
  }

  inpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/inpaint', dto);
  }

  style(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/style', dto);
  }

  segment(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/segment', dto);
  }

  caption(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/caption', dto);
  }

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

      if (poll.status === 'succeeded' && (poll.imageBase64 || poll.text)) {
        return poll;
      }
      if (poll.status === 'failed' || poll.status === 'canceled') {
        throw new AppError(poll.error || `Job ${poll.status}`, {
          code: 'UPSTREAM',
          details: poll,
        });
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new AppError('Timed out waiting for Replicate prediction', {
      code: 'TIMEOUT',
    });
  }

  // ── Projects ───────────────────────────────────────────────────

  listProjects(): Promise<ProjectSummaryDto[]> {
    return this.request<ProjectSummaryDto[]>('/projects', undefined, 'GET');
  }

  getProject(id: string): Promise<ProjectDetailDto> {
    return this.request<ProjectDetailDto>(`/projects/${id}`, undefined, 'GET');
  }

  createProject(dto: ProjectCreateDto): Promise<ProjectDetailDto> {
    return this.request<ProjectDetailDto>('/projects', dto, 'POST');
  }

  updateProject(id: string, dto: ProjectCreateDto): Promise<ProjectDetailDto> {
    return this.request<ProjectDetailDto>(`/projects/${id}`, dto, 'PUT');
  }

  deleteProject(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/projects/${id}`, undefined, 'DELETE');
  }

  listProjectVersions(id: string): Promise<ProjectVersionSummaryDto[]> {
    return this.request<ProjectVersionSummaryDto[]>(
      `/projects/${id}/versions`,
      undefined,
      'GET'
    );
  }

  // ── Assets ─────────────────────────────────────────────────────

  uploadAsset(dto: AssetUploadDto): Promise<AssetResponseDto> {
    return this.request<AssetResponseDto>('/assets/upload', dto, 'POST');
  }

  listAssets(): Promise<AssetResponseDto[]> {
    return this.request<AssetResponseDto[]>('/assets', undefined, 'GET');
  }
}

export const aiApiClient = new AiApiClient();

export { getErrorMessage };
