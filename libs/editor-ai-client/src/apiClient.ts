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
  GoogleFontsResponseDto,
  HealthCheckResponse,
  StockFetchResponseDto,
  StockSearchResponseDto,
  GeocodeResponseDto,
  PaletteHarmonyResponseDto,
  CatalogKind,
  CatalogListResponseDto,
} from '@photoshop-lite/shared-types';
import {
  ClientHttpCache,
  defaultTtlForPath,
  parseCacheControl,
  sharedHttpCache,
} from './httpCache';
import { getOrCreateWorkspaceId, WORKSPACE_HEADER } from './workspaceId';

const DEFAULT_BASE = '/api';
const MAX_429_RETRY_MS = 4_000;

export type WorkspaceIdProvider = () => string | null | undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readRetryAfterMs(response: Response, payload: unknown): number {
  const header = response.headers?.get?.('Retry-After');
  if (header) {
    const asNum = Number(header);
    if (Number.isFinite(asNum) && asNum >= 0) return Math.min(asNum * 1000, MAX_429_RETRY_MS);
  }
  if (payload && typeof payload === 'object') {
    const details = (payload as { details?: { retryAfter?: unknown } }).details;
    const sec = details?.retryAfter;
    if (typeof sec === 'number' && sec > 0) return Math.min(sec * 1000, MAX_429_RETRY_MS);
  }
  return 750;
}

export class AiApiClient {
  constructor(
    private readonly baseUrl: string = DEFAULT_BASE,
    private readonly getWorkspaceId: WorkspaceIdProvider = () => getOrCreateWorkspaceId(),
    private readonly httpCache: ClientHttpCache = sharedHttpCache
  ) {}

  /** Drop client GET cache (tests / workspace switch). */
  clearHttpCache(): void {
    this.httpCache.clear();
  }

  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    const workspaceId = this.getWorkspaceId()?.trim();
    if (workspaceId) headers[WORKSPACE_HEADER] = workspaceId;
    return headers;
  }

  private invalidateAfterMutation(path: string): void {
    if (path.startsWith('/assets')) this.httpCache.invalidatePath('/assets');
    if (path.startsWith('/projects')) this.httpCache.invalidatePath('/projects');
  }

  private async request<T>(
    path: string,
    body?: unknown,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    options: { skipCache?: boolean; _retried429?: boolean } = {}
  ): Promise<T> {
    const workspaceId = this.getWorkspaceId()?.trim() || null;
    const cacheKey = this.httpCache.key(workspaceId, method, path);
    const cacheable = method === 'GET' && !options.skipCache;

    if (cacheable) {
      const peek = this.httpCache.peek<T>(cacheKey);
      if (peek.state === 'fresh' && peek.value !== undefined) {
        return peek.value;
      }
      if (peek.state === 'stale' && peek.value !== undefined) {
        // Stale-while-revalidate: return stale, refresh in background.
        void this.httpCache.singleFlight(cacheKey, () =>
          this.fetchAndCache<T>(path, method, body, cacheKey, true)
        );
        return peek.value;
      }
    }

    if (cacheable) {
      return this.httpCache.singleFlight(cacheKey, () =>
        this.fetchAndCache<T>(path, method, body, cacheKey, false)
      );
    }

    return this.fetchRaw<T>(path, method, body, options);
  }

  private async fetchAndCache<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body: unknown,
    _cacheKey: string,
    background: boolean
  ): Promise<T> {
    // fetchRaw applies Cache-Control / path-default TTLs (skips no-store).
    return this.fetchRaw<T>(path, method, body, { background });
  }

  private async fetchRaw<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body: unknown,
    options: { skipCache?: boolean; _retried429?: boolean; background?: boolean } = {}
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.buildHeaders(body !== undefined),
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

    if (response.status === 429) {
      const waitMs = readRetryAfterMs(response, payload);
      if (!options._retried429) {
        await sleep(waitMs);
        return this.fetchRaw<T>(path, method, body, { ...options, _retried429: true });
      }
      throw new AppError(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : 'Too many requests',
        {
          code: 'RATE_LIMITED',
          status: 429,
          details: { retryAfterMs: waitMs, ...(payload as object) },
        }
      );
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

    if (method === 'GET') {
      const cc = parseCacheControl(response.headers?.get?.('Cache-Control') ?? null);
      if (!cc.noStore) {
        const workspaceId = this.getWorkspaceId()?.trim() || null;
        const cacheKey = this.httpCache.key(workspaceId, method, path);
        this.httpCache.set(cacheKey, payload, {
          maxAgeMs: cc.maxAgeMs ?? defaultTtlForPath(path),
          staleWhileRevalidateMs: cc.swrMs ?? defaultTtlForPath(path),
        });
      }
    } else {
      this.invalidateAfterMutation(path);
    }

    return payload as T;
  }

  getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/health', undefined, 'GET');
  }

  removeBackground(dto: RemoveBgRequestDto): Promise<RemoveBgResponseDto> {
    return this.request<RemoveBgResponseDto>('/ai/remove-bg', dto);
  }

  upscale(dto: UpscaleRequestDto): Promise<UpscaleResponseDto> {
    return this.request<UpscaleResponseDto>('/ai/upscale', dto);
  }

  predictionStatus(dto: PredictionPollRequestDto): Promise<PredictionPollResponseDto> {
    return this.request<PredictionPollResponseDto>('/ai/prediction-status', dto, 'POST', {
      skipCache: true,
    });
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

  objectRemove(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/object-remove', dto);
  }

  outpaint(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/outpaint', dto);
  }

  style(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/style', dto);
  }

  relight(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/relight', dto);
  }

  segment(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/segment', dto);
  }

  caption(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/caption', dto);
  }

  colorize(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/colorize', dto);
  }

  uncrop(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/uncrop', dto);
  }

  reimagine(dto: AiJobRequestDto): Promise<AiJobResponseDto> {
    return this.request<AiJobResponseDto>('/ai/reimagine', dto);
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

  getProjectVersion(id: string, versionId: string): Promise<ProjectDetailDto> {
    return this.request<ProjectDetailDto>(
      `/projects/${id}/versions/${encodeURIComponent(versionId)}`,
      undefined,
      'GET'
    );
  }

  restoreProjectVersion(id: string, versionId: string): Promise<ProjectDetailDto> {
    return this.request<ProjectDetailDto>(
      `/projects/${id}/versions/${encodeURIComponent(versionId)}/restore`,
      undefined,
      'POST'
    );
  }

  // ── Assets ─────────────────────────────────────────────────────

  uploadAsset(dto: AssetUploadDto): Promise<AssetResponseDto> {
    return this.request<AssetResponseDto>('/assets/upload', dto, 'POST');
  }

  listAssets(): Promise<AssetResponseDto[]> {
    return this.request<AssetResponseDto[]>('/assets', undefined, 'GET');
  }

  deleteAsset(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/assets/${id}`, undefined, 'DELETE');
  }

  /** Binary GET with workspace header → object URL (revoke when done). */
  async fetchAssetObjectUrl(id: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/assets/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: this.buildHeaders(false),
      });
    } catch (e: unknown) {
      throw new AppError(getErrorMessage(e, 'Network error fetching asset'), {
        code: 'NETWORK',
        cause: e,
      });
    }
    if (response.status === 429) {
      throw new AppError('Too many requests fetching asset', {
        code: 'RATE_LIMITED',
        status: 429,
      });
    }
    if (!response.ok) {
      throw new AppError(`Asset fetch failed (${response.status})`, { code: 'UPSTREAM' });
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  // ── Fonts ──────────────────────────────────────────────────────

  listFonts(query?: string): Promise<GoogleFontsResponseDto> {
    const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return this.request<GoogleFontsResponseDto>(`/fonts${q}`, undefined, 'GET');
  }

  // ── Stock / CC photos ──────────────────────────────────────────

  searchStock(query: string, page = 1): Promise<StockSearchResponseDto> {
    const q = encodeURIComponent(query.trim() || 'nature');
    return this.request<StockSearchResponseDto>(
      `/stock/search?q=${q}&page=${Math.max(1, page)}`,
      undefined,
      'GET'
    );
  }

  /** Proxy remote stock/CC image through API → data URL (CORS-safe). */
  fetchStockImage(url: string): Promise<StockFetchResponseDto> {
    return this.request<StockFetchResponseDto>(
      `/stock/fetch?url=${encodeURIComponent(url)}`,
      undefined,
      'GET'
    );
  }

  reverseGeocode(lat: number, lon: number): Promise<GeocodeResponseDto> {
    return this.request<GeocodeResponseDto>(
      `/geo/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      undefined,
      'GET'
    );
  }

  paletteHarmony(seedHex?: string): Promise<PaletteHarmonyResponseDto> {
    const q = seedHex?.replace(/^#/, '')
      ? `?seed=${encodeURIComponent(seedHex.replace(/^#/, ''))}`
      : '';
    return this.request<PaletteHarmonyResponseDto>(`/palette/harmony${q}`, undefined, 'GET');
  }

  /** Free catalog: Poly Haven textures, Picsum plates, DiceBear avatars. */
  listCatalog(
    kind: CatalogKind,
    opts?: { q?: string; page?: number }
  ): Promise<CatalogListResponseDto> {
    const params = new URLSearchParams({ kind });
    if (opts?.q?.trim()) params.set('q', opts.q.trim());
    if (opts?.page && opts.page > 1) params.set('page', String(opts.page));
    return this.request<CatalogListResponseDto>(
      `/catalog?${params.toString()}`,
      undefined,
      'GET'
    );
  }

  /**
   * Same-origin media proxy URL for catalog thumbs.
   * Prefer item.thumbUrl from listCatalog (already rewritten by API).
   */
  catalogMediaUrl(upstreamUrl: string): string {
    if (upstreamUrl.startsWith('/api/') || upstreamUrl.startsWith('data:')) {
      return upstreamUrl;
    }
    return `${this.baseUrl}/catalog/media?url=${encodeURIComponent(upstreamUrl)}`;
  }

  /** Place catalog item via backend stock proxy → data URL. */
  fetchCatalogImage(upstreamUrl: string): Promise<StockFetchResponseDto> {
    return this.fetchStockImage(upstreamUrl);
  }
}

export const aiApiClient = new AiApiClient();

export { getErrorMessage };
