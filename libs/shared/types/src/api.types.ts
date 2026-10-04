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
