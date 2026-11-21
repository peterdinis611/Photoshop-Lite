export {
  AiApiClient,
  aiApiClient,
  getErrorMessage,
} from './apiClient';
export type { WorkspaceIdProvider } from './apiClient';

export {
  ClientHttpCache,
  sharedHttpCache,
  parseCacheControl,
  defaultTtlForPath,
  DEFAULT_GET_TTL_MS,
} from './httpCache';

export {
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_HEADER,
  createWorkspaceId,
  getOrCreateWorkspaceId,
} from './workspaceId';

export {
  executeBackgroundRemoval,
  rasterizeToCanvas,
  smartSegmentBackground,
} from './backgroundRemoval';
export type { BgRemovalOptions } from './backgroundRemoval';
