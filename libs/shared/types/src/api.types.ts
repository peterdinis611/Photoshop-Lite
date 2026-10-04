export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  timestamp: string;
}

export interface RemoveBgRequestDto {
  imageBase64: string;
  apiKey?: string;
  provider?: 'client' | 'remove.bg';
}

export interface RemoveBgResponseDto {
  success?: boolean;
  imageBase64?: string;
  fallback?: boolean;
  message?: string;
  error?: string;
}

export interface UpscaleRequestDto {
  imageBase64: string;
  apiKey?: string;
  scale?: number;
  faceEnhance?: boolean;
}

export interface UpscaleResponseDto {
  success: boolean;
  predictionId?: string;
  statusUrl?: string;
  imageBase64?: string;
  fallbackToClient?: boolean;
  message?: string;
  error?: string;
}

export interface PredictionPollRequestDto {
  predictionId?: string;
  statusUrl?: string;
  apiKey?: string;
}

export interface PredictionPollResponseDto {
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | string;
  imageBase64?: string;
  error?: string;
  outputUrl?: string;
  /** Caption / text jobs may return plain text instead of an image */
  text?: string;
}

/** Standard API error envelope returned by Nest filters. */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  code?: string;
  path?: string;
  timestamp: string;
  details?: unknown;
}

// ─── Cloud AI jobs ───────────────────────────────────────────────

export type AiJobKind =
  | 'revive'
  | 'cleanup'
  | 'inpaint'
  | 'face-restore'
  | 'style'
  | 'segment'
  | 'caption';

export type AiStylePreset = 'film' | 'sketch' | 'anime' | 'watercolor' | 'noir';

export interface AiJobRequestDto {
  imageBase64: string;
  apiKey?: string;
  /** Intensity 0–1 for cleanup / revive */
  intensity?: number;
  /** Inpaint: white = edit region */
  maskBase64?: string;
  prompt?: string;
  style?: AiStylePreset;
}

export interface AiJobResponseDto {
  success: boolean;
  predictionId?: string;
  statusUrl?: string;
  /** Sync result (rare) */
  imageBase64?: string;
  text?: string;
  fallbackToClient?: boolean;
  message?: string;
  error?: string;
}

// ─── Projects ────────────────────────────────────────────────────

export interface ProjectCreateDto {
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  layers: unknown[];
  /** Optional client id; server generates if omitted */
  id?: string;
}

export interface ProjectSummaryDto {
  id: string;
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  updatedAt: string;
  createdAt: string;
  versionCount: number;
}

export interface ProjectDetailDto extends ProjectSummaryDto {
  backgroundColor: string;
  layers: unknown[];
  savedAt: string;
}

export interface ProjectVersionSummaryDto {
  id: string;
  savedAt: string;
  title: string;
}

// ─── Assets ──────────────────────────────────────────────────────

export interface AssetUploadDto {
  /** data URL or raw base64 */
  dataBase64: string;
  fileName?: string;
  mimeType?: string;
}

export interface AssetResponseDto {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}
