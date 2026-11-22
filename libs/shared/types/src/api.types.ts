export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  timestamp: string;
  /** Server has REPLICATE_API_TOKEN — cloud Lab jobs can run without a client key */
  replicateConfigured?: boolean;
  /** Server has REMOVE_BG_API_KEY */
  removeBgConfigured?: boolean;
  /** Server has UNSPLASH_ACCESS_KEY */
  unsplashConfigured?: boolean;
  /** Server has PEXELS_API_KEY */
  pexelsConfigured?: boolean;
  /** Server has PIXABAY_API_KEY */
  pixabayConfigured?: boolean;
  /** Openverse needs no key — always available when API is up */
  openverseAvailable?: boolean;
  /** Server has HF_TOKEN / HUGGINGFACE_API_KEY — AI fallback without Replicate */
  huggingfaceConfigured?: boolean;
  /** Cache + throttle backend: redis when REDIS_URL connects, else memory */
  redis?: 'connected' | 'memory';
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
  | 'object-remove'
  | 'outpaint'
  | 'face-restore'
  | 'style'
  | 'relight'
  | 'segment'
  | 'caption';

export type AiStylePreset = 'film' | 'sketch' | 'anime' | 'watercolor' | 'noir';

export type AiRelightPreset = 'softbox' | 'rim' | 'golden';

export interface AiJobRequestDto {
  imageBase64: string;
  apiKey?: string;
  /** Intensity 0–1 for cleanup / revive / relight */
  intensity?: number;
  /** Inpaint / object-remove: white = edit region */
  maskBase64?: string;
  prompt?: string;
  style?: AiStylePreset;
  relight?: AiRelightPreset;
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
  /** Snapshot reason: create | before-update | before-restore | … */
  reason?: string;
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

// ─── Google Fonts ────────────────────────────────────────────────

export interface GoogleFontItem {
  family: string;
  category: string;
  variants: string[];
}

export interface GoogleFontsResponseDto {
  items: GoogleFontItem[];
  source: 'google-api' | 'fallback';
}

// ─── Stock / CC photos ───────────────────────────────────────────

export type StockProvider = 'unsplash' | 'pexels' | 'openverse' | 'pixabay';

export interface StockPhotoItem {
  id: string;
  provider: StockProvider;
  title: string;
  author: string;
  authorUrl?: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  license?: string;
  sourcePageUrl?: string;
}

export interface StockSearchResponseDto {
  items: StockPhotoItem[];
  query: string;
  providers: StockProvider[];
  sources: Partial<Record<StockProvider, 'ok' | 'missing-key' | 'error' | 'skipped'>>;
}

/** Server-proxied image bytes as data URL (avoids browser CORS on place). */
export interface StockFetchResponseDto {
  dataUrl: string;
  contentType: string;
  byteLength: number;
}

/** Reverse-geocode result (Nominatim). */
export interface GeocodeResponseDto {
  label: string | null;
  latitude: number;
  longitude: number;
  raw?: string;
}

/** Colormind / The Color API / harmony palette (5 hex colors). */
export interface PaletteHarmonyResponseDto {
  colors: string[];
  source: 'colormind' | 'thecolorapi' | 'fallback';
}

// ─── Free catalog (textures / placeholders / avatars) ────────────

export type CatalogKind = 'textures' | 'placeholders' | 'avatars';

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  title: string;
  author?: string;
  thumbUrl: string;
  fullUrl: string;
  width?: number;
  height?: number;
  license?: string;
  tags?: string[];
}

export interface CatalogListResponseDto {
  kind: CatalogKind;
  items: CatalogItem[];
  query?: string;
  source: string;
}
